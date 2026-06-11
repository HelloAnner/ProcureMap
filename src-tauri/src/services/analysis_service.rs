use crate::api::client::XilaClient;
use crate::api::detail::fetch_detail_companies;
use crate::api::enrich::enrich_companies;
use crate::api::search::collect_candidates;
use crate::api::token::resolve_internal_token;
use crate::db::analysis::insert_analysis_result;
use crate::db::companies::bulk_insert_companies;
use crate::db::tasks::{complete_task, update_task_status};
use crate::error::{AppError, Result};
use crate::models::analysis::{AnalysisSnapshot, AnalysisSummary, ChartsData, EnrichScope};
use crate::models::config::{Origin, RunConfig};
use crate::models::events::ProgressEvent;
use crate::services::scoring::score_company;
use crate::services::search_query_builder::build_search_queries;
use crate::state::AppState;
use std::collections::HashMap;
use std::time::Instant;
use tauri::Emitter;

/// Full pipeline orchestration matching Python run_analysis().
pub async fn run_analysis_pipeline(
    state: &AppState,
    task_id: &str,
    config: &RunConfig,
    window: &tauri::Window,
) -> Result<()> {
    let started = Instant::now();
    let cancel_token = {
        let tokens = &state.cancel_tokens;
        let ct = tokio_util::sync::CancellationToken::new();
        tokens.insert(task_id.to_string(), ct.clone());
        ct
    };

    // Helper to check cancellation
    let check_cancel = || -> Result<()> {
        if cancel_token.is_cancelled() {
            return Err(AppError::Cancelled);
        }
        Ok(())
    };

    // Helper to emit log lines
    let emit_log = |window: &tauri::Window, line: &str| {
        let _ = window.emit(
            "progress",
            ProgressEvent::LogLine {
                line: line.to_string(),
            },
        );
    };

    // Helper to emit step change
    let emit_step = |window: &tauri::Window, step: &str, label: &str| {
        let _ = window.emit(
            "progress",
            ProgressEvent::StepChanged {
                step: step.to_string(),
                label: label.to_string(),
            },
        );
    };

    // --- Step 1: Resolve tokens and create client ---
    emit_step(window, "token", "正在解析平台 Token...");
    emit_log(window, "[token] 正在解析平台 Token...");

    let internal_token = resolve_internal_token(Some(&config.internal_token)).await?;

    let client = XilaClient::with_defaults(
        state.platform_token_url.clone(),
        state.xila_base_url.clone(),
    );
    client.set_internal_token(internal_token);
    client.resolve_token(true).await?;
    emit_log(window, "[token] Token 解析完成");

    update_task_status(&state.pool, task_id, "running", "search").await?;
    check_cancel()?;

    // --- Step 2: Build search queries and collect candidates ---
    emit_step(window, "search", "正在检索候选企业...");
    emit_log(window, "[search] 正在构建检索条件...");

    let keywords: Vec<String> = if config.keywords.is_empty() {
        crate::services::search_query_builder::default_keywords()
    } else {
        config.keywords.clone()
    };
    let areas: Vec<String> = if config.areas.is_empty() {
        crate::services::search_query_builder::default_areas()
    } else {
        config.areas.clone()
    };
    let industry = if config.industry_name3.is_empty() {
        Some("有色金属压延加工")
    } else {
        Some(config.industry_name3.as_str())
    };

    let queries = build_search_queries(&keywords, &areas, industry);
    emit_log(
        window,
        &format!(
            "[search] queries={} areas={} keywords={}",
            queries.len(),
            areas.len(),
            keywords.join(",")
        ),
    );

    let candidates = collect_candidates(
        &client,
        &queries,
        config.pages,
        config.search_limit,
        window,
        queries.len() as i32,
    )
    .await?;
    emit_log(
        window,
        &format!("[search] 去重后候选企业数={}", candidates.len()),
    );

    check_cancel()?;
    update_task_status(&state.pool, task_id, "running", "detail").await?;

    // --- Step 3: Resolve origin ---
    let origin = crate::services::search_query_builder::resolve_origin(
        &config.origin_name,
        config.lat,
        config.lng,
    )?;
    emit_log(
        window,
        &format!(
            "[origin] {} {:.5},{:.5} radius={}km",
            origin.name, origin.lat, origin.lng, config.radius_km
        ),
    );

    // --- Step 4: Fetch detail for top-ranked candidates ---
    emit_step(window, "detail", "正在获取企业工商详情...");

    let material_keywords: Vec<String> = keywords.clone();

    let mut companies = fetch_detail_companies(
        &client,
        &candidates,
        config.max_details as usize,
        &origin,
        config.radius_km as f64,
        &material_keywords,
        window,
    )
    .await?;
    emit_log(
        window,
        &format!("[detail] 半径内铝相关企业数={}", companies.len()),
    );

    check_cancel()?;
    update_task_status(&state.pool, task_id, "running", "enrich").await?;

    // --- Step 5: Enrich top companies ---
    emit_step(window, "enrich", "正在深度补充企业信息...");

    enrich_companies(&client, &mut companies, config.enrich_limit as usize, window).await?;
    emit_log(
        window,
        &format!("[enrich] 深度补充完成，API 调用次数={}", client.get_calls()),
    );

    check_cancel()?;
    update_task_status(&state.pool, task_id, "running", "scoring").await?;

    // --- Step 6: Score all companies ---
    emit_step(window, "scoring", "正在计算综合指数...");
    for company in &mut companies {
        score_company(company);
    }
    // Sort by score descending, then distance ascending
    companies.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| {
                a.distance_km
                    .partial_cmp(&b.distance_km)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
    });

    check_cancel()?;
    update_task_status(&state.pool, task_id, "running", "building").await?;

    // --- Step 7: Build analysis ---
    emit_step(window, "building", "正在生成分析报告...");
    let analysis = build_analysis(&companies, &client, started, &origin, config);

    // --- Step 8: Save to DB ---
    bulk_insert_companies(&state.pool, task_id, &companies).await?;
    insert_analysis_result(&state.pool, task_id, &analysis).await?;

    let duration = started.elapsed().as_secs_f64();
    complete_task(
        &state.pool,
        task_id,
        companies.len() as i32,
        analysis.summary.factory_count,
        analysis.summary.agent_count,
        analysis.summary.average_score,
        analysis.summary.top_score,
        client.get_calls(),
        client.get_failures().values().sum(),
        duration,
    )
    .await?;

    // Emit completion
    let _ = window.emit(
        "progress",
        ProgressEvent::TaskCompleted {
            task_id: task_id.to_string(),
            company_count: companies.len() as i32,
            duration_seconds: duration,
        },
    );

    update_task_status(&state.pool, task_id, "done", "done").await?;

    // Clean up cancel token
    state.cancel_tokens.remove(task_id);

    Ok(())
}

/// Build the analysis snapshot from completed companies.
/// EXACT replica of Python build_analysis.
fn build_analysis(
    companies: &[crate::models::company::CompanyDetail],
    client: &XilaClient,
    started: Instant,
    origin: &Origin,
    config: &RunConfig,
) -> AnalysisSnapshot {
    let failures = client.get_failures();

    let mut role_counts: HashMap<String, i32> = HashMap::new();
    let mut province_counts: HashMap<String, i32> = HashMap::new();
    let mut city_counts: HashMap<String, i32> = HashMap::new();
    let mut status_counts: HashMap<String, i32> = HashMap::new();
    let mut risk_totals: HashMap<String, i64> = HashMap::new();

    #[derive(Default)]
    struct CovAgg {
        ok: i32,
        total: i64,
        label: String,
    }
    let mut coverage_totals: HashMap<String, CovAgg> = HashMap::new();
    let mut buckets: HashMap<String, i32> = HashMap::new();

    let mut total_score = 0.0;
    let mut top_score = 0.0;
    let mut factory_count = 0;
    let mut agent_count = 0;
    let mut with_contact = 0;
    let mut with_risk_signal = 0;

    for c in companies {
        // Role counts
        *role_counts.entry(c.role_label.clone()).or_insert(0) += 1;
        *province_counts
            .entry(if c.province.is_empty() {
                "未知".to_string()
            } else {
                c.province.clone()
            })
            .or_insert(0) += 1;
        *city_counts
            .entry(if c.city.is_empty() {
                "未知".to_string()
            } else {
                c.city.clone()
            })
            .or_insert(0) += 1;
        *status_counts
            .entry(if c.status.is_empty() {
                "未知".to_string()
            } else {
                c.status.clone()
            })
            .or_insert(0) += 1;

        // Risk totals
        for (k, v) in &c.risk_counts {
            *risk_totals.entry(k.clone()).or_insert(0) += v;
        }

        // Coverage totals
        for (k, v) in &c.coverage {
            let agg = coverage_totals.entry(k.clone()).or_default();
            if v.get("ok").and_then(|o| o.as_bool()).unwrap_or(false) {
                agg.ok += 1;
            }
            agg.total += v.get("total").and_then(|t| t.as_i64()).unwrap_or(0);
            agg.label = v
                .get("label")
                .and_then(|l| l.as_str())
                .unwrap_or(k)
                .to_string();
        }

        // Distance buckets
        let d = c.distance_km;
        let bucket = if d <= 50.0 {
            "0-50km"
        } else if d <= 100.0 {
            "50-100km"
        } else if d <= 200.0 {
            "100-200km"
        } else {
            "200-300km"
        };
        *buckets.entry(bucket.to_string()).or_insert(0) += 1;

        total_score += c.score;
        if c.score > top_score {
            top_score = c.score;
        }
        if c.category == "M" {
            factory_count += 1;
        } else {
            agent_count += 1;
        }
        if !c.tel.is_empty()
            || !c.emails.is_empty()
            || (c.enrich.get("mobile")
                .and_then(|v| v.get("total"))
                .and_then(|v| v.as_i64())
                .unwrap_or(0) > 0)
        {
            with_contact += 1;
        }
        if c.risk_counts.values().sum::<i64>() > 0 {
            with_risk_signal += 1;
        }
    }

    let n = companies.len().max(1);

    // Sort province and city counts, take top N
    let mut province_vec: Vec<_> = province_counts.into_iter().collect();
    province_vec.sort_by(|a, b| b.1.cmp(&a.1));
    let province_counts_map: HashMap<String, i32> =
        province_vec.into_iter().take(12).collect();

    let mut city_vec: Vec<_> = city_counts.into_iter().collect();
    city_vec.sort_by(|a, b| b.1.cmp(&a.1));
    let city_counts_map: HashMap<String, i32> = city_vec.into_iter().take(16).collect();

    let coverage_map: HashMap<String, serde_json::Value> = coverage_totals
        .into_iter()
        .map(|(k, v)| {
            (
                k,
                serde_json::json!({
                    "ok": v.ok,
                    "total": v.total,
                    "label": v.label,
                }),
            )
        })
        .collect();

    AnalysisSnapshot {
        generated_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        duration_seconds: (started.elapsed().as_secs_f64() * 10.0).round() / 10.0,
        api_calls: client.get_calls(),
        api_failures: Some(serde_json::to_string(&failures).unwrap_or_default()),
        origin_name: origin.name.clone(),
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        origin_note: origin.note.clone(),
        radius_km: config.radius_km,
        material_label: config.material_label.clone(),
        material_keywords: if config.keywords.is_empty() {
            crate::services::search_query_builder::default_keywords()
        } else {
            config.keywords.clone()
        },
        enrich_scope: Some(EnrichScope {
            mode: "pre_enrich_score".to_string(),
            limit: config.enrich_limit,
            description: format!(
                "按综合预评分排序的前 {} 家供应商调用深度接口，其余企业保留基础工商与地图信息。",
                config.enrich_limit
            ),
        }),
        summary: AnalysisSummary {
            company_count: companies.len() as i32,
            factory_count,
            agent_count,
            average_score: (total_score / n as f64 * 10.0).round() / 10.0,
            top_score,
            with_contact,
            with_risk_signal,
        },
        charts: ChartsData {
            role_counts,
            province_counts: province_counts_map,
            city_counts: city_counts_map,
            status_counts,
            distance_buckets: buckets,
            risk_totals,
            coverage_totals: coverage_map,
        },
    }
}
