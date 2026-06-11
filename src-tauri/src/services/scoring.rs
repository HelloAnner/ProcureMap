use crate::models::company::CompanyDetail;
use crate::services::geo::contains_any;
use std::collections::HashMap;

/// Rough priority score for deciding which candidates to fetch detail for.
/// EXACT replica of Python rough_priority.
pub fn rough_priority(
    name: Option<&str>,
    reg_address: Option<&str>,
    business_address: Option<&str>,
    keywords: Option<&str>,
    oper_name: Option<&str>,
    reg_capi_num: Option<f64>,
) -> f64 {
    let text = format!(
        "{} {} {} {} {}",
        name.unwrap_or(""),
        reg_address.unwrap_or(""),
        business_address.unwrap_or(""),
        keywords.unwrap_or(""),
        oper_name.unwrap_or("")
    );

    let mut score = 0.0;

    // +40 if text contains any material keyword
    if contains_any(
        &text,
        &["铝", "铝业", "铝材", "铝型材", "铝合金", "铝制品", "铝板", "铝箔", "铝棒", "铝加工"],
    ) {
        score += 40.0;
    }

    // -15 if text contains decorative keywords
    if contains_any(&text, &["门窗", "装饰", "幕墙"]) {
        score -= 15.0;
    }

    // +12 if text contains any NEARBY_AREA
    if contains_any(
        &text,
        &["芜湖", "安徽", "南京", "苏州", "无锡", "常州", "上海", "湖州", "杭州", "嘉兴"],
    ) {
        score += 12.0;
    }

    // +min(25, log10(capital+1)*5)
    let cap = reg_capi_num.unwrap_or(0.0).max(0.0);
    score += (25.0_f64).min((cap + 1.0).log10() * 5.0);

    // +8 if contains prestige tags
    if contains_any(&text, &["高新", "专精特新", "规上"]) {
        score += 8.0;
    }

    score
}

/// Pre-enrich score for choosing which companies to deep-enrich.
/// EXACT replica of Python pre_enrich_score.
pub fn pre_enrich_score(c: &CompanyDetail) -> f64 {
    let mut score = 0.0;

    // +60 if M, else +35
    score += if c.category == "M" { 60.0 } else { 35.0 };

    // +max(0, 22 - distance_km/12)
    score += (22.0 - c.distance_km / 12.0).max(0.0);

    // +min(20, log10(capital+1)*4)
    let cap = c.registered_capital_wan.unwrap_or(0).max(0) as f64;
    score += (20.0_f64).min((cap + 1.0).log10() * 4.0);

    // +min(16, ssn/20)
    score += (16.0_f64).min(c.social_security_num as f64 / 20.0);

    // +10 if enterprise_above_class
    if !c.enterprise_above_class.is_empty() {
        score += 10.0;
    }

    // +6 if has keywords
    if !c.keywords.is_empty() {
        score += 6.0;
    }

    score
}

/// Full company scoring (15 components, max 100, base 18).
/// EXACT replica of Python score_company.
/// Modifies the company in place.
pub fn score_company(c: &mut CompanyDetail) {
    let mut parts: HashMap<String, f64> = HashMap::new();

    // 1. 存续状态: +12 if active (在营/存续/开业), else -36
    let status = &c.status;
    let active = contains_any(status, &["在营", "存续", "开业"]);
    parts.insert("存续状态".to_string(), if active { 12.0 } else { -36.0 });

    // 2. 距离: +max(0, 14 - distance/25)
    let distance = c.distance_km;
    parts.insert("距离".to_string(), (14.0 - distance / 25.0).max(0.0));

    // 3. 供应属性: +20 if M, +14 if A
    parts.insert(
        "供应属性".to_string(),
        if c.category == "M" { 20.0 } else { 14.0 },
    );

    // 4. 注册资本: +min(12, log10(max(1,cap)+1)*2.8)
    let cap = c.registered_capital_wan.unwrap_or(0).max(0) as f64;
    parts.insert(
        "注册资本".to_string(),
        (12.0_f64).min((cap.max(1.0) + 1.0).log10() * 2.8),
    );

    // 5. 人员规模: +min(12, sqrt(ssn)*0.75)
    let ssn = c.social_security_num.max(0) as f64;
    parts.insert(
        "人员规模".to_string(),
        (12.0_f64).min(ssn.sqrt() * 0.75),
    );

    // 6. 规上/资质: +6 enterprise_above_class, +5 if prestige tags
    let mut scale_cert = 0.0;
    if !c.enterprise_above_class.is_empty() {
        scale_cert += 6.0;
    }
    let tags = c.keywords.join(" ");
    if contains_any(&tags, &["高新", "专精特新", "创新型"]) {
        scale_cert += 5.0;
    }
    parts.insert("规上/资质".to_string(), scale_cert);

    // 7. 知识产权/证书: +min(7, patent*0.08 + cert*0.8)
    parts.insert(
        "知识产权/证书".to_string(),
        (7.0_f64).min(c.patent_num as f64 * 0.08 + c.certificates_num as f64 * 0.8),
    );

    // 8. 联系方式: +3 if tel or emails or contacts
    let has_contact = !c.tel.is_empty()
        || !c.emails.is_empty()
        || (c.enrich.get("mobile")
            .and_then(|v| v.get("total"))
            .and_then(|v| v.as_i64())
            .unwrap_or(0) > 0);
    parts.insert("联系方式".to_string(), if has_contact { 3.0 } else { 0.0 });

    // 9. 产业链匹配: +8 if chain contains 铝, else +4
    let chain_match = c.industrial_chain.iter().any(|x| x.contains("铝"));
    parts.insert(
        "产业链匹配".to_string(),
        if chain_match { 8.0 } else { 4.0 },
    );

    // 10. 经营活跃: +min(8, bidding*0.35 + hire*0.18 + news*0.12 + policy*0.45)
    let enrich = &c.enrich;
    let bidding_total = get_enrich_total(enrich, "bidding") as f64;
    let hire_total = get_enrich_total(enrich, "hire") as f64;
    let news_total = get_enrich_total(enrich, "news") as f64;
    let policy_total = get_enrich_total(enrich, "approved_policy") as f64;
    parts.insert(
        "经营活跃".to_string(),
        (8.0_f64).min(
            bidding_total * 0.35 + hire_total * 0.18 + news_total * 0.12 + policy_total * 0.45,
        ),
    );

    // 11. 年报背书: +min(5, annual_reports*0.8 + annual_sections*0.6)
    let ar_total = get_enrich_total(enrich, "annual_reports") as f64;
    let as_total = get_enrich_total(enrich, "annual_report_sections") as f64;
    parts.insert(
        "年报背书".to_string(),
        (5.0_f64).min(ar_total * 0.8 + as_total * 0.6),
    );

    // 12. 风险扣分: -min(28, red*12 + yellow*2.5)
    let red_keys = ["tax_abnormal", "major_tax_illegal", "illegal_info", "simple_cancel", "clear_info"];
    let yellow_keys = ["oper_abnorm", "punishment", "tax_arrears", "equity_pledge", "mortgage_info"];
    let red: i64 = red_keys.iter().map(|k| c.risk_counts.get(*k).copied().unwrap_or(0)).sum();
    let yellow: i64 = yellow_keys.iter().map(|k| c.risk_counts.get(*k).copied().unwrap_or(0)).sum();
    parts.insert(
        "风险扣分".to_string(),
        -(28.0_f64).min(red as f64 * 12.0 + yellow as f64 * 2.5),
    );

    // 13. 担保扣分: -min(6, external_guarantees*2)
    let mut guarant = 0;
    if let Some(sections) = enrich.get("annual_report_sections") {
        if let Some(rows) = sections.get("rows") {
            if let Some(obj) = rows.as_object() {
                for (_year, section) in obj {
                    if let Some(s) = section.as_object() {
                        if let Some(rg) = s.get("report_out_guarant") {
                            if let Some(t) = rg.get("total").and_then(|v| v.as_i64()) {
                                guarant += t;
                            }
                        }
                    }
                }
            }
        }
    }
    if guarant > 0 {
        parts.insert(
            "担保扣分".to_string(),
            -(6.0_f64).min(guarant as f64 * 2.0),
        );
    }

    // 14. 经营趋势: -4 if growth < -20%, +3 if > +10%
    let growth = c.main_income_growth_label;
    parts.insert(
        "经营趋势".to_string(),
        if growth.is_some() {
            let g = growth.unwrap();
            if g < -20.0 {
                -4.0
            } else if g > 10.0 {
                3.0
            } else {
                0.0
            }
        } else {
            0.0
        },
    );

    // 15. 实体性扣分: -6 if ssn==0 AND cap >= 10000
    if ssn == 0.0 && cap >= 10000.0 {
        parts.insert("实体性扣分".to_string(), -6.0);
    }

    // Compute final score: base 18 + sum of all parts
    let raw_score = 18.0 + parts.values().sum::<f64>();
    let score = (raw_score.max(0.0).min(100.0) * 10.0).round() / 10.0;
    c.score = score;
    c.score_parts = parts
        .into_iter()
        .map(|(k, v)| (k, (v * 10.0).round() / 10.0))
        .collect();

    // Decision bands
    c.decision = if !active {
        "主体状态异常"
    } else if score >= 82.0 {
        "信息密度高"
    } else if score >= 70.0 {
        "信息较完整"
    } else if score >= 55.0 {
        "信息一般"
    } else {
        "信息缺口较多"
    }
    .to_string();
}

/// Helper: extract "total" field from an enrich entry.
fn get_enrich_total(enrich: &HashMap<String, serde_json::Value>, key: &str) -> i64 {
    enrich
        .get(key)
        .and_then(|v| v.get("total"))
        .and_then(|v| v.as_i64())
        .unwrap_or(0)
}
