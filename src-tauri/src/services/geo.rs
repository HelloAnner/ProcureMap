/// Haversine distance between two lat/lng points, in km.
/// EXACT replica of Python haversine: radius = 6371.0088
pub fn haversine(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    let radius = 6371.0088;
    let phi1 = lat1.to_radians();
    let phi2 = lat2.to_radians();
    let dphi = (lat2 - lat1).to_radians();
    let dlambda = (lon2 - lon1).to_radians();

    let a = (dphi / 2.0).sin().powi(2)
        + phi1.cos() * phi2.cos() * (dlambda / 2.0).sin().powi(2);

    radius * 2.0 * a.sqrt().atan2((1.0 - a).sqrt())
}

/// Check if text contains any of the given words.
/// EXACT replica of Python contains_any.
pub fn contains_any(text: &str, words: &[&str]) -> bool {
    words.iter().any(|word| text.contains(word))
}

/// Infer province and city from an address string.
/// EXACT replica of Python infer_area.
pub fn infer_area(address: &str) -> (String, String) {
    let province = ["安徽", "江苏", "浙江", "上海", "江西", "湖北", "河南"]
        .iter()
        .find(|&&p| address.contains(p))
        .copied()
        .unwrap_or("");

    if address.contains("上海") {
        return ("上海".to_string(), "上海".to_string());
    }

    let city_markers = [
        "芜湖", "合肥", "马鞍山", "宣城", "铜陵", "池州", "滁州", "安庆",
        "南京", "苏州", "无锡", "常州", "镇江", "扬州", "南通",
        "杭州", "湖州", "嘉兴", "宁波",
        "九江", "南昌", "武汉", "黄石", "信阳",
    ];

    let city = city_markers
        .iter()
        .find(|&&c| address.contains(c))
        .copied()
        .unwrap_or("");

    (province.to_string(), city.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_haversine() {
        // Wuhu -> Hefei is roughly 135 km
        let dist = haversine(31.35246, 118.43313, 31.82057, 117.22724);
        assert!(dist > 120.0 && dist < 150.0, "Distance was {}", dist);
    }

    #[test]
    fn test_contains_any() {
        assert!(contains_any("铝型材加工", &["铝", "铜"]));
        assert!(!contains_any("钢铁制造", &["铝", "铜"]));
    }

    #[test]
    fn test_infer_area() {
        let (p, c) = infer_area("安徽省芜湖市镜湖区");
        assert_eq!(p, "安徽");
        assert_eq!(c, "芜湖");

        let (p, c) = infer_area("上海市浦东新区");
        assert_eq!(p, "上海");
        assert_eq!(c, "上海");
    }
}
