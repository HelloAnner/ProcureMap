use crate::api::client::XilaClient;
use crate::error::Result;
use crate::models::company::CandidateRow;
use crate::models::config::{SearchQuery, SEARCH_PATH};
use crate::models::events::ProgressEvent;
use std::collections::HashMap;
use tauri::Emitter;

/// Collect candidate companies by paginating through search results.
/// EXACT replica of Python collect_candidates.
pub async fn collect_candidates(
    client: &XilaClient,
    queries: &[SearchQuery],
    pages: i32,
    search_limit: i32,
    window: &tauri::Window,
    total_queries: i32,
) -> Result<Vec<CandidateRow>> {
    let mut dedup: HashMap<String, CandidateRow> = HashMap::new();

    for (q_index, query) in queries.iter().enumerate() {
        let qi = q_index as i32 + 1;

        for page in 1..=pages {
            let mut params = serde_json::json!({
                "index": page.to_string(),
                "limit": search_limit.to_string(),
            });

            if let Some(ref name) = query.name {
                if let serde_json::Value::Object(ref mut map) = params {
                    map.insert("name".to_string(), serde_json::Value::String(name.clone()));
                }
            }
            if let Some(ref address) = query.address {
                if let serde_json::Value::Object(ref mut map) = params {
                    map.insert(
                        "address".to_string(),
                        serde_json::Value::String(address.clone()),
                    );
                }
            }
            if let Some(ref ind3) = query.industry_names_3 {
                if let serde_json::Value::Object(ref mut map) = params {
                    map.insert(
                        "industry_names_3".to_string(),
                        serde_json::json!(ind3),
                    );
                }
            }

            let resp = client.post(SEARCH_PATH, params).await?;
            let (rows, total) = rows_and_total(&resp);

            let _ = window.emit(
                "progress",
                ProgressEvent::SearchProgress {
                    query_index: qi,
                    total_queries,
                    page,
                    total_rows: total.unwrap_or(0) as i32,
                    candidates: dedup.len() as i32,
                },
            );

            if rows.is_empty() {
                break;
            }

            for row in &rows {
                let code = row
                    .get("credit_code")
                    .or_else(|| row.get("creditCode"))
                    .and_then(|v| v.as_str().map(|s| s.to_string()))
                    .unwrap_or_default();
                if code.is_empty() {
                    continue;
                }

                let entry = dedup.entry(code.clone()).or_insert_with(|| {
                    let mut c = CandidateRow {
                        credit_code: Some(code),
                        ..Default::default()
                    };
                    c.source_queries.push(
                        serde_json::from_value(query_to_value(query)).unwrap_or_default(),
                    );
                    c
                });

                // Merge non-empty fields from row
                merge_candidate(entry, row, query);

                if !entry.source_queries.iter().any(|q| {
                    q.get("name")
                        .and_then(|v| v.as_str())
                        .map_or(false, |n| {
                            query.name.as_deref().map_or(false, |qn| qn == n)
                        })
                }) {
                    entry
                        .source_queries
                        .push(serde_json::from_value(query_to_value(query)).unwrap_or_default());
                }
            }

            if let Some(t) = total {
                if page * search_limit >= t as i32 {
                    break;
                }
            }
        }
    }

    Ok(dedup.into_values().collect())
}

fn query_to_value(query: &SearchQuery) -> serde_json::Value {
    let mut m = serde_json::Map::new();
    if let Some(ref name) = query.name {
        m.insert("name".to_string(), serde_json::Value::String(name.clone()));
    }
    if let Some(ref address) = query.address {
        m.insert(
            "address".to_string(),
            serde_json::Value::String(address.clone()),
        );
    }
    if let Some(ref ind3) = query.industry_names_3 {
        m.insert(
            "industry_names_3".to_string(),
            serde_json::json!(ind3),
        );
    }
    serde_json::Value::Object(m)
}

fn merge_candidate(entry: &mut CandidateRow, row: &serde_json::Map<String, serde_json::Value>, _query: &SearchQuery) {
    let str_field = |key: &str| -> Option<String> {
        row.get(key)
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .filter(|s| !s.is_empty())
    };
    let num_field = |key: &str| -> Option<f64> {
        row.get(key).and_then(|v| v.as_f64())
    };

    if let Some(v) = str_field("name") { entry.name = Some(v); }
    if let Some(v) = str_field("credit_code") { entry.credit_code = Some(v); }
    if let Some(v) = str_field("creditCode") { entry.credit_code_alt = Some(v); }
    if let Some(v) = str_field("reg_address") { entry.reg_address = Some(v); }
    if let Some(v) = str_field("business_address") { entry.business_address = Some(v); }
    if let Some(v) = str_field("reg_capi") { entry.reg_capi = Some(v); }
    if let Some(v) = num_field("reg_capi_num") { entry.reg_capi_num = Some(v); }
    if let Some(v) = str_field("oper_name") { entry.oper_name = Some(v); }
    if let Some(v) = str_field("keywords") { entry.keywords = Some(v); }
    if let Some(v) = str_field("start_date") { entry.start_date = Some(v); }
    if let Some(v) = str_field("status") { entry.status = Some(v); }
    if let Some(v) = str_field("EnterpriseCode") { entry.enterprise_code = Some(v); }
}

/// Extract rows and total from API response.
/// Replicates Python rows_and_total exactly.
pub fn rows_and_total(resp: &serde_json::Value) -> (Vec<serde_json::Map<String, serde_json::Value>>, Option<usize>) {
    let data = resp.get("data").unwrap_or(resp);
    let mut total: Option<usize> = None;
    let mut rows: Vec<serde_json::Map<String, serde_json::Value>> = Vec::new();

    if let Some(obj) = data.as_object() {
        for key in &["total", "Total", "totalCount", "count"] {
            if let Some(val) = obj.get(*key) {
                if let Some(n) = val.as_i64() {
                    total = Some(n as usize);
                } else if let Some(n) = val.as_f64() {
                    total = Some(n as usize);
                } else if let Some(s) = val.as_str() {
                    if let Ok(n) = s.parse::<usize>() {
                        total = Some(n);
                    }
                }
                if total.is_some() {
                    break;
                }
            }
        }

        // Try rows / list / records / items / data
        for key in &["rows", "list", "records", "items", "data"] {
            if let Some(val) = obj.get(*key) {
                if let Some(arr) = val.as_array() {
                    rows = arr
                        .iter()
                        .filter_map(|v| v.as_object().cloned())
                        .collect();
                    break;
                }
            }
        }

        // If rows is still empty, check if data itself is the list
        if rows.is_empty() {
            if let Some(nested_data) = obj.get("data") {
                if let Some(arr) = nested_data.as_array() {
                    rows = arr
                        .iter()
                        .filter_map(|v| v.as_object().cloned())
                        .collect();
                }
            }
        }
    } else if let Some(arr) = data.as_array() {
        rows = arr
            .iter()
            .filter_map(|v| v.as_object().cloned())
            .collect();
        total = Some(rows.len());
    }

    (rows, total)
}

/// Extract the inner payload dict from a response.
/// Replicates Python payload_dict exactly.
pub fn payload_dict(resp: &serde_json::Value) -> serde_json::Map<String, serde_json::Value> {
    let data = resp.get("data").unwrap_or(resp);
    if let Some(obj) = data.as_object() {
        // Check for nested "data" key
        if let Some(nested) = obj.get("data") {
            if let Some(nested_obj) = nested.as_object() {
                return nested_obj.clone();
            }
        }
        obj.clone()
    } else {
        serde_json::Map::new()
    }
}
