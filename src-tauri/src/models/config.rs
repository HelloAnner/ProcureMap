use serde::{Deserialize, Serialize};
use std::collections::HashMap;

lazy_static::lazy_static! {
    pub static ref CITY_COORDS: HashMap<&'static str, (f64, f64)> = {
        let mut m = HashMap::new();
        m.insert("芜湖", (31.35246, 118.43313));
        m.insert("合肥", (31.82057, 117.22724));
        m.insert("马鞍山", (31.67067, 118.50611));
        m.insert("宣城", (30.94078, 118.75868));
        m.insert("铜陵", (30.94543, 117.81154));
        m.insert("池州", (30.6648, 117.49142));
        m.insert("滁州", (32.30181, 118.31683));
        m.insert("南京", (32.06025, 118.79687));
        m.insert("苏州", (31.29834, 120.58319));
        m.insert("无锡", (31.49117, 120.31191));
        m.insert("常州", (31.81072, 119.97365));
        m.insert("上海", (31.23037, 121.47370));
        m.insert("杭州", (30.27415, 120.15515));
        m.insert("湖州", (30.89305, 120.08805));
        m.insert("嘉兴", (30.74613, 120.75550));
        m.insert("宁波", (29.86834, 121.54399));
        m.insert("武汉", (30.59276, 114.30525));
        m.insert("南昌", (28.68202, 115.85794));
        m
    };
}

pub static DEFAULT_AREAS: &[&str] = &[
    "安徽", "江苏", "浙江", "上海", "江西", "湖北", "河南",
    "芜湖", "合肥", "马鞍山", "宣城", "铜陵", "滁州",
    "南京", "苏州", "无锡", "常州", "湖州", "杭州", "嘉兴",
];

pub const PLATFORM_TOKEN_URL: &str = "http://47.97.154.221:8119/api/v1/internal/xila-token/resolve";
pub const XILA_BASE_URL: &str = "https://api-dev.qiliance.com";
pub const SEARCH_PATH: &str = "/api/Company/getCompanyList";
pub const DETAIL_PATH: &str = "/adminapi/Business/getCompanyDetail";

pub const MATERIAL_KEYWORDS: &[&str] = &[
    "铝", "铝业", "铝材", "铝型材", "铝合金", "铝制品", "铝板", "铝箔", "铝棒", "铝加工",
];

pub const NEARBY_AREAS: &[&str] = &[
    "芜湖", "安徽", "南京", "苏州", "无锡", "常州", "上海", "湖州", "杭州", "嘉兴",
];

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RunConfig {
    pub origin_name: String,
    pub material_label: String,
    pub keywords: Vec<String>,
    pub areas: Vec<String>,
    pub radius_km: i32,
    pub max_details: i32,
    pub enrich_limit: i32,
    pub pages: i32,
    pub search_limit: i32,
    pub output_dir: String,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub industry_name3: String,
    pub internal_token: String,
    pub pause: f64,
    pub timeout: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchQuery {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub industry_names_3: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Origin {
    pub name: String,
    pub lat: f64,
    pub lng: f64,
    pub note: String,
}
