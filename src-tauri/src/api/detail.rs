use crate::api::client::XilaClient;
use crate::api::search::payload_dict;
use crate::error::Result;
use crate::models::company::{CandidateRow, CompanyDetail, RoleEvidence};
use crate::models::config::{Origin, DETAIL_PATH, MATERIAL_KEYWORDS};
use crate::models::events::ProgressEvent;
use crate::services::geo::{contains_any, haversine, infer_area};
use std::collections::HashMap;
use tauri::Emitter;

/// Fetch detail for the top-ranked candidates.
/// EXACT replica of Python fetch_detail_companies.
pub async fn fetch_detail_companies(
    client: &XilaClient,
    candidates: &[CandidateRow],
    max_details: usize,
    origin: &Origin,
    radius_km: f64,
    material_keywords: &[String],
    window: &tauri::Window,
) -> Result<Vec<CompanyDetail>> {
    // Sort by rough_priority descending, take top max_details
    let mut ranked: Vec<&CandidateRow> = candidates.iter().collect();
    ranked.sort_by(|a, b| {
        rough_priority(b)
            .partial_cmp(&rough_priority(a))
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    ranked.truncate(max_details);

    let mut companies: Vec<CompanyDetail> = Vec::new();
    let total = ranked.len();

    for (index, base) in ranked.iter().enumerate() {
        let code = base.credit_code.as_deref().unwrap_or("");
        if code.is_empty() {
            continue;
        }

        let resp = client
            .post(
                DETAIL_PATH,
                serde_json::json!({"credit_code": code}),
            )
            .await?;
        let detail = payload_dict(&resp);

        if let Some(company) =
            normalize_company(base, &detail, origin, radius_km, material_keywords)
        {
            companies.push(company);
        }

        if (index + 1) % 25 == 0 {
            let _ = window.emit(
                "progress",
                ProgressEvent::DetailProgress {
                    processed: (index + 1) as i32,
                    total: total as i32,
                    kept: companies.len() as i32,
                },
            );
        }
    }

    // Sort by distance ascending, then registered capital descending
    companies.sort_by(|a, b| {
        a.distance_km
            .partial_cmp(&b.distance_km)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| {
                let cap_a = a.registered_capital_wan.unwrap_or(0);
                let cap_b = b.registered_capital_wan.unwrap_or(0);
                cap_b.cmp(&cap_a)
            })
    });

    Ok(companies)
}

/// Normalize a single company from base (search result) + detail (API response).
/// EXACT replica of Python normalize_company.
pub fn normalize_company(
    base: &CandidateRow,
    detail: &serde_json::Map<String, serde_json::Value>,
    origin: &Origin,
    radius_km: f64,
    material_keywords: &[String],
) -> Option<CompanyDetail> {
    // Extract address
    let address = first_non_empty_str(
        detail.get("business_address"),
        detail.get("reg_address"),
        base.business_address.as_deref(),
        base.reg_address.as_deref(),
    )
    .unwrap_or("")
    .to_string();

    // Extract lat/lng
    let mut lat: Option<f64> = detail
        .get("latitude")
        .or_else(|| detail.get("lat"))
        .and_then(as_f64);
    let mut lng: Option<f64> = detail
        .get("longitude")
        .or_else(|| detail.get("lng"))
        .or_else(|| detail.get("lon"))
        .and_then(as_f64);

    // Try location field as "lat,lng"
    if lat.is_none() || lng.is_none() {
        if let Some(loc) = detail.get("location").and_then(|v| v.as_str()) {
            let parts: Vec<&str> = loc.split(',').collect();
            if parts.len() >= 2 {
                lat = parts[0].trim().parse::<f64>().ok();
                lng = parts[1].trim().parse::<f64>().ok();
            }
        }
    }

    // Skip if no coordinates
    let lat = lat?;
    let lng = lng?;

    // Check distance
    let dist = haversine(origin.lat, origin.lng, lat, lng);
    if dist > radius_km {
        return None;
    }

    let (province, city) = infer_area(&address);

    // Extract products
    let main_product: Vec<String> = detail
        .get("main_product")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();

    // Extract industrial chain
    let chain = detail
        .get("industrial_chain")
        .and_then(|v| v.as_array())
        .unwrap_or(&vec![])
        .clone();
    let chain_names: Vec<String> = chain
        .iter()
        .filter_map(|x| x.as_object())
        .filter_map(|x| x.get("name"))
        .filter_map(|v| v.as_str())
        .map(|s| s.to_string())
        .take(12)
        .collect();

    // Keywords (tags)
    let keywords: Vec<String> = detail
        .get("keywords")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();

    let scope = first_non_empty_str(
        detail.get("scope"),
        detail.get("business_scope"),
        None,
        None,
    )
    .unwrap_or("")
    .to_string();

    let name = first_non_empty_str(
        detail.get("name"),
        Some(&serde_json::Value::String(base.name.clone().unwrap_or_default())),
        None,
        None,
    )
    .unwrap_or("")
    .to_string();

    // Build blob for keyword matching
    let blob = format!(
        "{} {} {} {} {}",
        name,
        scope,
        main_product.join(" "),
        chain_names.join(" "),
        detail
            .get("industry_name_3")
            .and_then(|v| v.as_str())
            .unwrap_or("")
    );

    // Filter by material keywords (convert Vec<String> to Vec<&str> for contains_any check)
    let kw_strs: Vec<&str> = material_keywords.iter().map(|s| s.as_str()).collect();
    if !contains_any(&blob, &kw_strs) {
        return None;
    }

    // Classify as M (factory) or A (agent)
    let factory_evidence = contains_any(
        &blob,
        &[
            "制造", "生产", "加工", "压延", "轧制", "挤压", "熔铸", "型材", "板带", "铝箔", "铝棒",
            "铝合金",
        ],
    ) || detail
        .get("industry_name_1")
        .and_then(|v| v.as_str())
        .map_or(false, |s| s == "制造业");

    let agent_evidence = contains_any(
        &blob,
        &["销售", "批发", "商贸", "贸易", "经销", "代理"],
    );

    let category = if factory_evidence { "M" } else { "A" };

    let industry_str = [
        detail.get("industry_name_1"),
        detail.get("industry_name_2"),
        detail.get("industry_name_3"),
        detail.get("industry_name_4"),
    ]
    .iter()
    .filter_map(|v| v.and_then(|v| v.as_str()))
    .collect::<Vec<&str>>()
    .join(" / ");

    let mut detail_map = HashMap::new();
    for key in &[
        "belong_org",
        "econ_kind_std",
        "term_start",
        "term_end",
        "county_code",
        "city_code",
        "province_code",
        "is_real",
        "is_equity",
        "have_project_clue",
    ] {
        if let Some(val) = detail.get(*key) {
            detail_map.insert(key.to_string(), val.clone());
        }
    }

    Some(CompanyDetail {
        name,
        short_name: detail
            .get("name_short")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        credit_code: first_non_empty_str(
            detail.get("credit_code"),
            Some(&serde_json::Value::String(
                base.credit_code.clone().unwrap_or_default(),
            )),
            None,
            None,
        )
        .unwrap_or("")
        .to_string(),
        enterprise_code: first_non_empty_str(
            detail.get("EnterpriseCode"),
            base.enterprise_code.as_deref().map(|s| serde_json::Value::String(s.to_string())).as_ref(),
            None,
            None,
        )
        .unwrap_or("")
        .to_string(),
        operator: first_non_empty_str(
            detail.get("oper_name"),
            base.oper_name.as_deref().map(|s| serde_json::Value::String(s.to_string())).as_ref(),
            None,
            None,
        )
        .unwrap_or("")
        .to_string(),
        category: category.to_string(),
        role_label: if category == "M" {
            "原厂/加工厂"
        } else {
            "疑似一级代理/贸易商"
        }
        .to_string(),
        role_evidence: RoleEvidence {
            factory: factory_evidence,
            agent: agent_evidence,
            industry: industry_str,
        },
        province,
        city,
        distance_km: (dist * 10.0).round() / 10.0,
        lat,
        lng,
        registered_capital_wan: first_non_empty_i64(
            detail.get("reg_capi_num"),
            base.reg_capi_num.map(|v| serde_json::Value::Number(serde_json::Number::from_f64(v).unwrap_or(serde_json::Number::from(0)))),
        ),
        registered_capital: first_non_empty_str(
            detail.get("reg_capi"),
            base.reg_capi.as_deref().map(|s| serde_json::Value::String(s.to_string())).as_ref(),
            None,
            None,
        )
        .unwrap_or("")
        .to_string(),
        paid_capital_wan: first_non_empty_i64(
            detail.get("actual_capi_num"),
            detail.get("paid_capital_num").cloned(),
        ),
        paid_capital: detail
            .get("paid_capital")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        social_security_num: detail
            .get("social_security_num")
            .and_then(as_i64)
            .unwrap_or(0),
        enterprise_class: detail
            .get("enterprise_class")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        enterprise_above_class: detail
            .get("enterprise_above_class")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        status: detail
            .get("status")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        status_code: detail.get("status_code").and_then(|v| v.as_str()).map(|s| s.to_string()),
        start_date: first_non_empty_str(
            detail.get("start_date"),
            base.start_date.as_deref().map(|s| serde_json::Value::String(s.to_string())).as_ref(),
            None,
            None,
        )
        .unwrap_or("")
        .to_string(),
        change_date: detail
            .get("change_date")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        check_date: detail
            .get("check_date")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        last_update_time: detail
            .get("last_update_time")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        address,
        reg_address: detail
            .get("reg_address")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        business_address: detail
            .get("business_address")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        scope,
        main_product,
        industrial_chain: chain_names,
        keywords,
        group_name: detail
            .get("group_name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        park_name: first_non_empty_str(
            detail.get("park_name"),
            detail.get("dev_park_name"),
            None,
            None,
        )
        .unwrap_or("")
        .to_string(),
        listed_state: detail
            .get("listedstate")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        tel: detail
            .get("tel")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        emails: detail
            .get("emails")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        domain: first_non_empty_str(
            detail.get("domain"),
            detail.get("website"),
            None,
            None,
        )
        .unwrap_or("")
        .to_string(),
        website_num: detail
            .get("website_num")
            .and_then(as_i64)
            .unwrap_or(0),
        patent_num: detail
            .get("patent_num")
            .and_then(as_i64)
            .unwrap_or(0),
        trademark_num: detail
            .get("trademark_num")
            .and_then(as_i64)
            .unwrap_or(0),
        certificates_num: detail
            .get("certificates_num")
            .and_then(as_i64)
            .unwrap_or(0),
        recruit_num: detail
            .get("recruit_num")
            .and_then(as_i64)
            .unwrap_or(0),
        tax_revenue_growth_rate: detail
            .get("tax_revenue_growth_rate")
            .and_then(as_f64),
        main_income_growth_label: detail
            .get("main_income_growth_label")
            .and_then(as_f64),
        classifications_ys: detail
            .get("classifications_ys")
            .and_then(|v| v.as_object())
            .map(|o| {
                o.iter()
                    .map(|(k, v)| (k.clone(), v.clone()))
                    .collect::<HashMap<_, _>>()
            })
            .unwrap_or_default(),
        detail: detail_map,
        enrich: HashMap::new(),
        risk_counts: HashMap::new(),
        risk_rows: HashMap::new(),
        coverage: HashMap::new(),
        score: 0.0,
        score_parts: HashMap::new(),
        decision: String::new(),
        source_queries: base.source_queries.clone(),
    })
}

/// Rough priority scoring for candidate ranking (before detail fetch).
/// EXACT replica of Python rough_priority.
fn rough_priority(row: &CandidateRow) -> f64 {
    let text = format!(
        "{} {} {} {} {}",
        row.name.as_deref().unwrap_or(""),
        row.reg_address.as_deref().unwrap_or(""),
        row.business_address.as_deref().unwrap_or(""),
        row.keywords.as_deref().unwrap_or(""),
        row.oper_name.as_deref().unwrap_or("")
    );

    let mut score = 0.0;

    let kw_strs: Vec<&str> = MATERIAL_KEYWORDS.iter().copied().collect();
    if contains_any(&text, &kw_strs) {
        score += 40.0;
    }
    if contains_any(&text, &["门窗", "装饰", "幕墙"]) {
        score -= 15.0;
    }
    let nearby: Vec<&str> = vec!["芜湖", "安徽", "南京", "苏州", "无锡", "常州", "上海", "湖州", "杭州", "嘉兴"];
    if contains_any(&text, &nearby) {
        score += 12.0;
    }

    let cap = row.reg_capi_num.unwrap_or(0.0);
    score += (25.0_f64).min((cap.max(0.0) + 1.0).log10() * 5.0);

    if contains_any(&text, &["高新", "专精特新", "规上"]) {
        score += 8.0;
    }

    score
}

// --- Helper functions (mirror Python first(), as_float(), as_int()) ---

pub fn first_non_empty_str<'a>(
    a: Option<&'a serde_json::Value>,
    b: Option<&'a serde_json::Value>,
    c: Option<&'a str>,
    d: Option<&'a str>,
) -> Option<&'a str> {
    if let Some(v) = a {
        if let Some(s) = v.as_str() {
            if !s.is_empty() {
                return Some(s);
            }
        }
    }
    if let Some(v) = b {
        if let Some(s) = v.as_str() {
            if !s.is_empty() {
                return Some(s);
            }
        }
    }
    if let Some(s) = c {
        if !s.is_empty() {
            return Some(s);
        }
    }
    if let Some(s) = d {
        if !s.is_empty() {
            return Some(s);
        }
    }
    None
}

pub fn as_f64(value: &serde_json::Value) -> Option<f64> {
    match value {
        serde_json::Value::Number(n) => n.as_f64(),
        serde_json::Value::String(s) => s.parse::<f64>().ok(),
        _ => None,
    }
}

pub fn as_i64(value: &serde_json::Value) -> Option<i64> {
    match value {
        serde_json::Value::Number(n) => n.as_i64(),
        serde_json::Value::String(s) => s.parse::<i64>().ok(),
        _ => None,
    }
}

fn first_non_empty_i64(a: Option<&serde_json::Value>, b: Option<serde_json::Value>) -> Option<i64> {
    if let Some(v) = a {
        if let Some(n) = v.as_f64() {
            return Some(n as i64);
        }
        if let Some(s) = v.as_str() {
            if let Ok(n) = s.parse::<i64>() {
                return Some(n);
            }
        }
    }
    if let Some(v) = b {
        if let Some(n) = v.as_f64() {
            return Some(n as i64);
        }
        if let Some(s) = v.as_str() {
            if let Ok(n) = s.parse::<i64>() {
                return Some(n);
            }
        }
    }
    None
}
