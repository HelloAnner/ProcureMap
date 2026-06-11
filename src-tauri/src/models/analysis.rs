use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AnalysisSummary {
    pub company_count: i32,
    pub factory_count: i32,
    pub agent_count: i32,
    pub average_score: f64,
    pub top_score: f64,
    pub with_contact: i32,
    pub with_risk_signal: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ChartsData {
    pub role_counts: HashMap<String, i32>,
    pub province_counts: HashMap<String, i32>,
    pub city_counts: HashMap<String, i32>,
    pub status_counts: HashMap<String, i32>,
    pub distance_buckets: HashMap<String, i32>,
    pub risk_totals: HashMap<String, i64>,
    pub coverage_totals: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct EnrichScope {
    pub mode: String,
    pub limit: i32,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AnalysisSnapshot {
    pub generated_at: String,
    pub duration_seconds: f64,
    pub api_calls: i32,
    pub api_failures: Option<String>,
    pub origin_name: String,
    pub origin_lat: f64,
    pub origin_lng: f64,
    pub origin_note: String,
    pub radius_km: i32,
    pub material_label: String,
    pub material_keywords: Vec<String>,
    pub enrich_scope: Option<EnrichScope>,
    pub summary: AnalysisSummary,
    pub charts: ChartsData,
}
