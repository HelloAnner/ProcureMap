use crate::error::{AppError, Result};
use crate::models::config::{Origin, SearchQuery, CITY_COORDS};

/// Build search queries from keywords and areas (Cartesian product).
/// EXACT replica of Python build_search_queries.
pub fn build_search_queries(
    keywords: &[String],
    areas: &[String],
    industry_name3: Option<&str>,
) -> Vec<SearchQuery> {
    let mut queries: Vec<SearchQuery> = Vec::new();

    // keyword x area Cartesian product
    for keyword in keywords {
        for area in areas {
            queries.push(SearchQuery {
                name: Some(keyword.clone()),
                address: Some(area.clone()),
                industry_names_3: None,
            });
        }
    }

    // industry x area
    if let Some(ind3) = industry_name3 {
        if !ind3.is_empty() {
            for area in areas {
                queries.push(SearchQuery {
                    name: None,
                    address: Some(area.clone()),
                    industry_names_3: Some(vec![ind3.to_string()]),
                });
            }
        }
    }

    queries
}

/// Resolve origin from name and optional coordinates.
/// EXACT replica of Python resolve_origin.
pub fn resolve_origin(name: &str, lat: Option<f64>, lng: Option<f64>) -> Result<Origin> {
    if let (Some(lat), Some(lng)) = (lat, lng) {
        return Ok(Origin {
            name: name.to_string(),
            lat,
            lng,
            note: "用户输入坐标".to_string(),
        });
    }

    for (city, (clat, clng)) in CITY_COORDS.iter() {
        if name.contains(city) || city.contains(name) {
            return Ok(Origin {
                name: name.to_string(),
                lat: *clat,
                lng: *clng,
                note: format!("内置城市坐标：{}", city),
            });
        }
    }

    Err(AppError::GeoError(
        "未能解析原点坐标。请填写经纬度，或使用内置城市名，例如 芜湖、南京、上海、杭州。".to_string(),
    ))
}

/// Default areas for search.
pub fn default_areas() -> Vec<String> {
    vec![
        "安徽", "江苏", "浙江", "上海", "江西", "湖北", "河南",
        "芜湖", "合肥", "马鞍山", "宣城", "铜陵", "滁州",
        "南京", "苏州", "无锡", "常州", "湖州", "杭州", "嘉兴",
    ]
    .into_iter()
    .map(|s| s.to_string())
    .collect()
}

/// Default keywords for aluminum industry.
pub fn default_keywords() -> Vec<String> {
    vec![
        "铝", "铝业", "铝材", "铝型材", "铝合金", "铝制品", "铝板", "铝箔", "铝棒", "铝加工",
    ]
    .into_iter()
    .map(|s| s.to_string())
    .collect()
}
