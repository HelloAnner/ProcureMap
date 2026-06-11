use crate::api::client::XilaClient;
use crate::api::search::{payload_dict, rows_and_total};
use crate::error::Result;
use crate::models::company::CompanyDetail;
use crate::models::events::ProgressEvent;
use crate::services::scoring::pre_enrich_score;
use tauri::Emitter;

/// Enrich endpoint specifications matching Python ENRICH_ENDPOINTS exactly.
#[derive(Clone)]
pub struct EnrichEndpoint {
    pub path: &'static str,
    pub paged: bool,
    pub label: &'static str,
}

pub fn enrich_endpoints() -> Vec<EnrichEndpoint> {
    vec![
        EnrichEndpoint { path: "/api/company/shareholderPubList", paged: false, label: "股东" },
        EnrichEndpoint { path: "/api/company/entAnnualReports", paged: false, label: "年报" },
        EnrichEndpoint { path: "/adminapi/Company/getAsyncReportList", paged: false, label: "财务/社保" },
        EnrichEndpoint { path: "/adminapi/Company/getCertificatesList", paged: false, label: "资质证书" },
        EnrichEndpoint { path: "/api/Company/getPatentList", paged: true, label: "专利" },
        EnrichEndpoint { path: "/api/Company/getTrademarkList", paged: true, label: "商标" },
        EnrichEndpoint { path: "/api/Company/getCompanyBranches", paged: false, label: "分支机构" },
        EnrichEndpoint { path: "/adminapi/Company/outwardInvestmentList", paged: true, label: "对外投资" },
        EnrichEndpoint { path: "/adminapi/EnterprisePortrait/leaderPositions", paged: true, label: "董监高任职" },
        EnrichEndpoint { path: "/adminapi/EnterprisePortrait/getHireList", paged: true, label: "招聘" },
        EnrichEndpoint { path: "/adminapi/Company/getMobile", paged: false, label: "关键联系人" },
        EnrichEndpoint { path: "/adminapi/Company/getCompanyNews", paged: false, label: "企业新闻/舆情" },
        EnrichEndpoint { path: "/adminapi/Company/getCompanyPolicyList", paged: false, label: "可申报政策" },
        EnrichEndpoint { path: "/adminapi/Company/getApprovedPolicyList", paged: false, label: "已获政策" },
        EnrichEndpoint { path: "/adminapi/project/entProjectMatch", paged: true, label: "补贴匹配" },
        EnrichEndpoint { path: "/adminapi/Business/newRelationChain", paged: false, label: "关系链" },
        EnrichEndpoint { path: "/adminapi/Bidding/getBiddingList", paged: true, label: "招投标" },
        EnrichEndpoint { path: "/api/Company/getCopyrightSoftwareList", paged: false, label: "软件著作权" },
        EnrichEndpoint { path: "/api/Company/getCopyrightWorksList", paged: false, label: "作品著作权" },
        EnrichEndpoint { path: "/api/ListedCompany/getFinancialData", paged: false, label: "上市财务" },
        EnrichEndpoint { path: "/adminapi/ManagementRisk/getOperAbnormList", paged: false, label: "经营异常" },
        EnrichEndpoint { path: "/adminapi/ManagementRisk/getPunishmentBSPubList", paged: false, label: "行政处罚" },
        EnrichEndpoint { path: "/adminapi/ManagementRisk/getTaxArrearsInfoList", paged: false, label: "欠税" },
        EnrichEndpoint { path: "/adminapi/ManagementRisk/getAbnormalEnterprisesList", paged: false, label: "税务非正常户" },
        EnrichEndpoint { path: "/adminapi/ManagementRisk/getMajorTaxIllegalList", paged: false, label: "重大税收违法" },
        EnrichEndpoint { path: "/adminapi/ManagementRisk/getIllegalInfoList", paged: false, label: "严重违法失信" },
        EnrichEndpoint { path: "/adminapi/ManagementRisk/getSimpleCancelList", paged: false, label: "简易注销" },
        EnrichEndpoint { path: "/adminapi/ManagementRisk/getClearInfolList", paged: false, label: "清算" },
        EnrichEndpoint { path: "/adminapi/ManagementRisk/getEquityPledgelList", paged: false, label: "股权出质" },
        EnrichEndpoint { path: "/adminapi/ManagementRisk/getMortgageInfolList", paged: false, label: "动产抵押" },
    ]
}

/// Risk keys (endpoints that return risk data rather than business data).
pub fn risk_keys() -> std::collections::HashSet<&'static str> {
    [
        "oper_abnorm", "punishment", "tax_arrears", "tax_abnormal",
        "major_tax_illegal", "illegal_info", "simple_cancel", "clear_info",
        "equity_pledge", "mortgage_info",
    ]
    .iter()
    .copied()
    .collect()
}

/// Annual report sub-endpoints.
const ANNUAL_REPORT_ENDPOINTS: &[(&str, &str, &str)] = &[
    ("report_asset", "/api/Company/reportAsset", "年报资产负债"),
    ("report_social_info", "/api/Company/reportSocialInfo", "年报社保"),
    ("report_out_guarant", "/api/Company/reportOutGuarant", "年报对外担保"),
    ("report_share_tran", "/api/Company/reportShareTran", "年报股权转让"),
];

/// Enrich top companies by calling all 21 (actually 30 counting risk) endpoints.
/// EXACT replica of Python enrich_companies + enrich_nearest.
pub async fn enrich_companies(
    client: &XilaClient,
    companies: &mut [CompanyDetail],
    max_enrich: usize,
    window: &tauri::Window,
) -> Result<()> {
    // Sort by pre_enrich_score descending, take top max_enrich
    let mut indices: Vec<usize> = (0..companies.len()).collect();
    indices.sort_by(|&a, &b| {
        pre_enrich_score(&companies[b])
            .partial_cmp(&pre_enrich_score(&companies[a]))
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    let chosen_indices: Vec<usize> = indices.into_iter().take(max_enrich).collect();

    let chosen_codes: std::collections::HashSet<String> = chosen_indices
        .iter()
        .map(|&i| companies[i].credit_code.clone())
        .collect();

    let endpoints = enrich_endpoints();
    let risks = risk_keys();
    let total = chosen_indices.len();

    for (c_index, &idx) in chosen_indices.iter().enumerate() {
        let (code, _name) = {
            let c = &companies[idx];
            (c.credit_code.clone(), c.name.clone())
        };
        if code.is_empty() {
            continue;
        }

        for endpoint in &endpoints {
            let key = endpoint_key(endpoint.path);
            let mut params = serde_json::json!({"credit_code": code});

            if endpoint.paged {
                if let serde_json::Value::Object(ref mut map) = params {
                    map.insert("index".to_string(), serde_json::json!(1));
                    map.insert("limit".to_string(), serde_json::json!(20));
                }
            }

            // Special case for listed_finance
            if endpoint.path == "/api/ListedCompany/getFinancialData" {
                if let serde_json::Value::Object(ref mut map) = params {
                    map.insert("limit".to_string(), serde_json::json!(20));
                }
            }

            let resp = client.post(endpoint.path, params).await?;
            let (rows, total) = rows_and_total(&resp);
            let count = total.unwrap_or(rows.len());

            let ok = resp
                .get("code")
                .and_then(|v| v.as_i64())
                .map_or(true, |c| c == 0);

            {
                let c = &mut companies[idx];
                c.coverage.insert(
                    key.clone(),
                    serde_json::json!({
                        "ok": ok,
                        "total": count,
                        "label": endpoint.label,
                    }),
                );

                if risks.contains(key.as_str()) {
                    c.risk_counts.insert(key.clone(), count as i64);
                    c.risk_rows
                        .insert(key.clone(), serde_json::json!(rows.iter().take(5).cloned().collect::<Vec<_>>()));
                } else {
                    c.enrich.insert(
                        key.clone(),
                        serde_json::json!({
                            "total": count,
                            "rows": rows.iter().take(6).cloned().collect::<Vec<_>>(),
                        }),
                    );
                }

                // Handle annual report sub-endpoints
                if key == "annual_reports" && !rows.is_empty() {
                    annual_report_id_enrich(
                        client,
                        c,
                        &rows.iter().take(2).cloned().collect::<Vec<_>>(),
                    )
                    .await;
                }
            }
        }

        if (c_index + 1) % 10 == 0 {
            let _ = window.emit(
                "progress",
                ProgressEvent::EnrichProgress {
                    processed: (c_index + 1) as i32,
                    total: total as i32,
                },
            );
        }
    }

    // Mark non-chosen companies as not enriched
    for company in companies.iter_mut() {
        if !chosen_codes.contains(&company.credit_code) {
            company.coverage.insert(
                "not_enriched".to_string(),
                serde_json::json!({
                    "ok": false,
                    "total": 0,
                    "label": "未进入深度补充批次",
                }),
            );
        }
    }

    Ok(())
}

/// Generate a short key from an endpoint path.
fn endpoint_key(path: &str) -> String {
    // Take the last segment, convert to snake_case
    let parts: Vec<&str> = path.rsplit('/').collect();
    parts
        .first()
        .unwrap_or(&"unknown")
        .chars()
        .enumerate()
        .flat_map(|(i, c)| {
            if i > 0 && c.is_uppercase() {
                vec!['_', c.to_ascii_lowercase()]
            } else {
                vec![c.to_ascii_lowercase()]
            }
        })
        .collect()
}

/// Fetch annual report sub-sections for a company.
/// EXACT replica of Python enrich_annual_report_sections.
async fn annual_report_id_enrich(
    client: &XilaClient,
    company: &mut CompanyDetail,
    annual_rows: &[serde_json::Map<String, serde_json::Value>],
) {
    let mut sections = serde_json::Map::new();

    for row in annual_rows {
        let rid = annual_report_id(row);
        if rid.is_empty() {
            continue;
        }

        let year = row
            .get("year")
            .or_else(|| row.get("anche_year"))
            .or_else(|| row.get("report_year"))
            .or_else(|| row.get("annual_year"))
            .map(|_| rid.clone())
            .unwrap_or_else(|| rid.clone());

        let mut year_sections = serde_json::Map::new();

        for (section_key, section_path, section_label) in ANNUAL_REPORT_ENDPOINTS {
            let resp = client
                .post(
                    section_path,
                    serde_json::json!({"annual_report_id": rid}),
                )
                .await;

            if let Ok(resp) = resp {
                let (rows, total) = rows_and_total(&resp);
                let payload = payload_dict(&resp);
                let section_count = total.or_else(|| {
                    if !rows.is_empty() {
                        Some(rows.len())
                    } else if !payload.is_empty() {
                        Some(1)
                    } else {
                        None
                    }
                }).unwrap_or(0);

                year_sections.insert(
                    section_key.to_string(),
                    serde_json::json!({
                        "label": section_label,
                        "total": section_count,
                        "rows": rows.iter().take(4).cloned().collect::<Vec<_>>(),
                        "payload": if !payload.is_empty() && rows.is_empty() {
                            serde_json::Value::Object(payload)
                        } else {
                            serde_json::json!({})
                        },
                    }),
                );

                company.coverage.insert(
                    section_key.to_string(),
                    serde_json::json!({
                        "ok": resp.get("code").and_then(|v| v.as_i64()).map_or(true, |c| c == 0),
                        "total": section_count,
                        "label": section_label,
                    }),
                );
            }
        }

        sections.insert(year.to_string(), serde_json::Value::Object(year_sections));
    }

    if !sections.is_empty() {
        company.enrich.insert(
            "annual_report_sections".to_string(),
            serde_json::json!({
                "total": sections.len(),
                "rows": sections,
            }),
        );
    }
}

/// Get annual report ID from a row, trying multiple field names.
fn annual_report_id(row: &serde_json::Map<String, serde_json::Value>) -> String {
    for key in &[
        "annual_report_id",
        "annualReportId",
        "id",
        "report_id",
        "reportId",
    ] {
        if let Some(val) = row.get(*key) {
            if let Some(s) = val.as_str() {
                if !s.is_empty() {
                    return s.to_string();
                }
            }
        }
    }
    String::new()
}
