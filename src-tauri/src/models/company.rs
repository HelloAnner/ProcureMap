use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// A candidate row returned from the search API before detail enrichment.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CandidateRow {
    pub name: Option<String>,
    pub credit_code: Option<String>,
    pub credit_code_alt: Option<String>,
    pub reg_address: Option<String>,
    pub business_address: Option<String>,
    pub reg_capi: Option<String>,
    pub reg_capi_num: Option<f64>,
    pub oper_name: Option<String>,
    pub keywords: Option<String>,
    pub start_date: Option<String>,
    pub status: Option<String>,
    pub enterprise_code: Option<String>,
    #[serde(default)]
    pub source_queries: Vec<HashMap<String, serde_json::Value>>,
}

/// Full company detail after normalize_company(). Must match ALL fields from the Python version.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CompanyDetail {
    pub name: String,
    pub short_name: String,
    pub credit_code: String,
    pub enterprise_code: String,
    pub operator: String,
    pub category: String,
    pub role_label: String,
    pub role_evidence: RoleEvidence,
    pub province: String,
    pub city: String,
    pub distance_km: f64,
    pub lat: f64,
    pub lng: f64,
    pub registered_capital_wan: Option<i64>,
    pub registered_capital: String,
    pub paid_capital_wan: Option<i64>,
    pub paid_capital: String,
    pub social_security_num: i64,
    pub enterprise_class: String,
    pub enterprise_above_class: String,
    pub status: String,
    pub status_code: Option<String>,
    pub start_date: String,
    pub change_date: String,
    pub check_date: String,
    pub last_update_time: String,
    pub address: String,
    pub reg_address: String,
    pub business_address: String,
    pub scope: String,
    pub main_product: Vec<String>,
    pub industrial_chain: Vec<String>,
    pub keywords: Vec<String>,
    pub group_name: String,
    pub park_name: String,
    pub listed_state: String,
    pub tel: String,
    pub emails: String,
    pub domain: String,
    pub website_num: i64,
    pub patent_num: i64,
    pub trademark_num: i64,
    pub certificates_num: i64,
    pub recruit_num: i64,
    pub tax_revenue_growth_rate: Option<f64>,
    pub main_income_growth_label: Option<f64>,
    pub classifications_ys: HashMap<String, serde_json::Value>,
    pub detail: HashMap<String, serde_json::Value>,
    pub enrich: HashMap<String, serde_json::Value>,
    pub risk_counts: HashMap<String, i64>,
    pub risk_rows: HashMap<String, serde_json::Value>,
    pub coverage: HashMap<String, serde_json::Value>,
    pub score: f64,
    pub score_parts: HashMap<String, f64>,
    pub decision: String,
    pub source_queries: Vec<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RoleEvidence {
    pub factory: bool,
    pub agent: bool,
    pub industry: String,
}

/// Abbreviated company info for list views.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CompanySummary {
    pub id: Option<i64>,
    pub task_id: String,
    pub name: String,
    pub credit_code: String,
    pub category: String,
    pub role_label: String,
    pub province: String,
    pub city: String,
    pub distance_km: f64,
    pub registered_capital_wan: Option<i64>,
    pub social_security_num: i64,
    pub status: String,
    pub score: f64,
    pub decision: String,
    pub risk_total: i64,
}
