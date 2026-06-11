use crate::error::Result;
use crate::models::company::CompanyDetail;
use std::io::Write;

/// Export companies to CSV file with BOM for Chinese characters.
/// Replicates the demo.html CSV export format.
pub fn export_csv(companies: &[CompanyDetail], path: &str) -> Result<()> {
    let mut file = std::fs::File::create(path)?;

    // Write BOM for Chinese character support
    file.write_all(&[0xEF, 0xBB, 0xBF])?;

    // Header
    let header = vec![
        "综合指数",
        "信息层级",
        "类别",
        "名称",
        "统一社会信用代码",
        "省",
        "市",
        "距离km",
        "注册资本万",
        "实缴资本万",
        "参保人数",
        "状态",
        "法定代表人",
        "地址",
        "电话",
        "邮箱",
        "主营产品",
        "产业链",
        "风险记录数",
        "经营范围",
    ];

    writeln!(file, "{}", header.join(","))?;

    // Data rows
    for c in companies {
        let risk_total: i64 = c.risk_counts.values().sum();
        let row: Vec<String> = vec![
            c.score.to_string(),
            c.decision.clone(),
            c.role_label.clone(),
            csv_escape(&c.name),
            csv_escape(&c.credit_code),
            csv_escape(&c.province),
            csv_escape(&c.city),
            c.distance_km.to_string(),
            c.registered_capital_wan.map_or("".to_string(), |v| v.to_string()),
            c.paid_capital_wan.map_or("".to_string(), |v| v.to_string()),
            c.social_security_num.to_string(),
            csv_escape(&c.status),
            csv_escape(&c.operator),
            csv_escape(&c.address),
            csv_escape(&c.tel),
            csv_escape(&c.emails),
            csv_escape(&c.main_product.join("|")),
            csv_escape(&c.industrial_chain.join("|")),
            risk_total.to_string(),
            csv_escape(&c.scope.chars().take(500).collect::<String>()),
        ];
        writeln!(file, "{}", row.join(","))?;
    }

    Ok(())
}

/// Escape a string for CSV (wrap in quotes, double any internal quotes).
fn csv_escape(s: &str) -> String {
    let escaped = s.replace('"', "\"\"");
    format!("\"{}\"", escaped)
}

/// Export companies as JSON.
pub fn export_json(companies: &[CompanyDetail], path: &str) -> Result<()> {
    let json = serde_json::to_string_pretty(companies)?;
    std::fs::write(path, json)?;
    Ok(())
}
