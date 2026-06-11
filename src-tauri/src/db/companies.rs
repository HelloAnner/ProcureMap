use crate::error::Result;
use crate::models::company::CompanyDetail;
use sqlx::SqlitePool;

/// Bulk insert companies with INSERT OR REPLACE semantics.
pub async fn bulk_insert_companies(
    pool: &SqlitePool,
    task_id: &str,
    companies: &[CompanyDetail],
) -> Result<()> {
    for company in companies {
        let main_product = serde_json::to_string(&company.main_product).unwrap_or_default();
        let industrial_chain = serde_json::to_string(&company.industrial_chain).unwrap_or_default();
        let keywords = serde_json::to_string(&company.keywords).unwrap_or_default();
        let risk_counts_json = serde_json::to_string(&company.risk_counts).unwrap_or_default();
        let enrich_json = serde_json::to_string(&company.enrich).unwrap_or_default();
        let coverage_json = serde_json::to_string(&company.coverage).unwrap_or_default();
        let score_parts_json = serde_json::to_string(&company.score_parts).unwrap_or_default();
        let detail_json = serde_json::to_string(&company.detail).unwrap_or_default();
        let risk_rows_json = serde_json::to_string(&company.risk_rows).unwrap_or_default();
        let source_queries_json = serde_json::to_string(&company.source_queries).unwrap_or_default();
        let classifications_ys_json =
            serde_json::to_string(&company.classifications_ys).unwrap_or_default();
        let role_evidence_json = serde_json::to_string(&company.role_evidence).unwrap_or_default();

        sqlx::query(
            r#"
            INSERT OR REPLACE INTO companies (
                task_id, name, short_name, credit_code, enterprise_code, operator,
                category, role_label, province, city, distance_km, lat, lng,
                registered_capital_wan, registered_capital, paid_capital_wan, paid_capital,
                social_security_num, enterprise_class, enterprise_above_class, status, status_code,
                start_date, change_date, check_date, last_update_time, address, reg_address,
                business_address, scope, main_product, industrial_chain, keywords,
                group_name, park_name, listed_state, tel, emails, domain, website_num,
                patent_num, trademark_num, certificates_num, recruit_num,
                tax_revenue_growth_rate, main_income_growth_label,
                score, decision, risk_counts_json, enrich_json, coverage_json,
                score_parts_json, detail_json, risk_rows_json, source_queries_json,
                classifications_ys_json, role_evidence_json
            ) VALUES (
                ?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,
                ?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24,?25,?26,?27,?28,?29,
                ?30,?31,?32,?33,?34,?35,?36,?37,?38,?39,?40,?41,?42,?43,?44,
                ?45,?46,?47,?48,?49,?50,?51,?52,?53,?54,?55,?56,?57,?58
            )
            "#,
        )
        .bind(task_id)
        .bind(&company.name)
        .bind(&company.short_name)
        .bind(&company.credit_code)
        .bind(&company.enterprise_code)
        .bind(&company.operator)
        .bind(&company.category)
        .bind(&company.role_label)
        .bind(&company.province)
        .bind(&company.city)
        .bind(company.distance_km)
        .bind(company.lat)
        .bind(company.lng)
        .bind(company.registered_capital_wan)
        .bind(&company.registered_capital)
        .bind(company.paid_capital_wan)
        .bind(&company.paid_capital)
        .bind(company.social_security_num)
        .bind(&company.enterprise_class)
        .bind(&company.enterprise_above_class)
        .bind(&company.status)
        .bind(&company.status_code)
        .bind(&company.start_date)
        .bind(&company.change_date)
        .bind(&company.check_date)
        .bind(&company.last_update_time)
        .bind(&company.address)
        .bind(&company.reg_address)
        .bind(&company.business_address)
        .bind(&company.scope)
        .bind(&main_product)
        .bind(&industrial_chain)
        .bind(&keywords)
        .bind(&company.group_name)
        .bind(&company.park_name)
        .bind(&company.listed_state)
        .bind(&company.tel)
        .bind(&company.emails)
        .bind(&company.domain)
        .bind(company.website_num)
        .bind(company.patent_num)
        .bind(company.trademark_num)
        .bind(company.certificates_num)
        .bind(company.recruit_num)
        .bind(company.tax_revenue_growth_rate)
        .bind(company.main_income_growth_label)
        .bind(company.score)
        .bind(&company.decision)
        .bind(&risk_counts_json)
        .bind(&enrich_json)
        .bind(&coverage_json)
        .bind(&score_parts_json)
        .bind(&detail_json)
        .bind(&risk_rows_json)
        .bind(&source_queries_json)
        .bind(&classifications_ys_json)
        .bind(&role_evidence_json)
        .execute(pool)
        .await?;
    }
    Ok(())
}

/// Get companies for a task with optional filters and sort.
pub async fn get_companies_by_task(
    pool: &SqlitePool,
    task_id: &str,
    category: Option<&str>,
    decision: Option<&str>,
    province: Option<&str>,
    score_min: Option<f64>,
    score_max: Option<f64>,
    dist_min: Option<f64>,
    dist_max: Option<f64>,
    only_active: Option<bool>,
    only_contact: Option<bool>,
    only_risk_free: Option<bool>,
    search: Option<&str>,
    sort_by: Option<&str>,
    limit: Option<i32>,
    offset: Option<i32>,
) -> Result<Vec<CompanyDetail>> {
    let mut query = String::from(
        "SELECT name, short_name, credit_code, enterprise_code, operator,
         category, role_label, province, city, distance_km, lat, lng,
         registered_capital_wan, registered_capital, paid_capital_wan, paid_capital,
         social_security_num, enterprise_class, enterprise_above_class, status, status_code,
         start_date, change_date, check_date, last_update_time, address, reg_address,
         business_address, scope, main_product, industrial_chain, keywords,
         group_name, park_name, listed_state, tel, emails, domain, website_num,
         patent_num, trademark_num, certificates_num, recruit_num,
         tax_revenue_growth_rate, main_income_growth_label, score, decision,
         risk_counts_json, enrich_json, coverage_json, score_parts_json,
         detail_json, risk_rows_json, source_queries_json, classifications_ys_json,
         role_evidence_json FROM companies WHERE task_id = ?",
    );

    let mut where_clauses = vec!["1=1".to_string()];

    if let Some(cat) = category {
        if !cat.is_empty() {
            where_clauses.push(format!("category = '{}'", cat.replace('\'', "''")));
        }
    }
    if let Some(dec) = decision {
        if !dec.is_empty() {
            where_clauses.push(format!("decision = '{}'", dec.replace('\'', "''")));
        }
    }
    if let Some(prov) = province {
        if !prov.is_empty() {
            where_clauses.push(format!("province = '{}'", prov.replace('\'', "''")));
        }
    }
    if let Some(min_s) = score_min {
        where_clauses.push(format!("score >= {}", min_s));
    }
    if let Some(max_s) = score_max {
        where_clauses.push(format!("score <= {}", max_s));
    }
    if let Some(min_d) = dist_min {
        where_clauses.push(format!("distance_km >= {}", min_d));
    }
    if let Some(max_d) = dist_max {
        where_clauses.push(format!("distance_km <= {}", max_d));
    }
    if only_active.unwrap_or(false) {
        where_clauses.push(
            "(status LIKE '%在营%' OR status LIKE '%存续%' OR status LIKE '%开业%')".to_string(),
        );
    }
    if only_contact.unwrap_or(false) {
        where_clauses
            .push("(tel != '' OR emails != '' OR enrich_json LIKE '%\"mobile\"%')".to_string());
    }
    if only_risk_free.unwrap_or(false) {
        where_clauses.push("(risk_counts_json = '{}' OR risk_counts_json IS NULL)".to_string());
    }
    if let Some(s) = search {
        if !s.is_empty() {
            let escaped = s.replace('\'', "''");
            where_clauses.push(format!(
                "(name LIKE '%{}%' OR scope LIKE '%{}%' OR address LIKE '%{}%'
                  OR main_product LIKE '%{}%' OR industrial_chain LIKE '%{}%'
                  OR keywords LIKE '%{}%')",
                escaped, escaped, escaped, escaped, escaped, escaped
            ));
        }
    }

    query.push_str(" AND ");
    query.push_str(&where_clauses.join(" AND "));

    match sort_by.unwrap_or("score") {
        "distance" => query.push_str(" ORDER BY distance_km ASC"),
        "capital" => query.push_str(" ORDER BY registered_capital_wan DESC NULLS LAST"),
        "people" => query.push_str(" ORDER BY social_security_num DESC"),
        _ => query.push_str(" ORDER BY score DESC, distance_km ASC"),
    }

    if let Some(lim) = limit {
        query.push_str(&format!(" LIMIT {}", lim));
    } else {
        query.push_str(" LIMIT 500");
    }
    if let Some(off) = offset {
        query.push_str(&format!(" OFFSET {}", off));
    }

    // Use raw query via sqlx since we're building it dynamically
    let rows = sqlx::query_as::<_, CompanyRow>(&query)
        .bind(task_id)
        .fetch_all(pool)
        .await?;

    Ok(rows.into_iter().map(|r| r.into_company()).collect())
}

/// Get a single company by credit code within a task.
pub async fn get_company_by_credit_code(
    pool: &SqlitePool,
    task_id: &str,
    credit_code: &str,
) -> Result<CompanyDetail> {
    let row = sqlx::query_as::<_, CompanyRow>(
        "SELECT name, short_name, credit_code, enterprise_code, operator,
         category, role_label, province, city, distance_km, lat, lng,
         registered_capital_wan, registered_capital, paid_capital_wan, paid_capital,
         social_security_num, enterprise_class, enterprise_above_class, status, status_code,
         start_date, change_date, check_date, last_update_time, address, reg_address,
         business_address, scope, main_product, industrial_chain, keywords,
         group_name, park_name, listed_state, tel, emails, domain, website_num,
         patent_num, trademark_num, certificates_num, recruit_num,
         tax_revenue_growth_rate, main_income_growth_label, score, decision,
         risk_counts_json, enrich_json, coverage_json, score_parts_json,
         detail_json, risk_rows_json, source_queries_json, classifications_ys_json,
         role_evidence_json FROM companies WHERE task_id = ?1 AND credit_code = ?2",
    )
    .bind(task_id)
    .bind(credit_code)
    .fetch_one(pool)
    .await
    .map_err(|_| {
        crate::error::AppError::CompanyNotFound(format!(
            "公司 {} 在任务 {} 中未找到",
            credit_code, task_id
        ))
    })?;

    Ok(row.into_company())
}

// --- Internal row struct ---

#[derive(Debug, sqlx::FromRow)]
#[allow(dead_code)]
struct CompanyRow {
    name: String,
    short_name: String,
    credit_code: String,
    enterprise_code: String,
    operator: String,
    category: String,
    role_label: String,
    province: String,
    city: String,
    distance_km: f64,
    lat: f64,
    lng: f64,
    registered_capital_wan: Option<i64>,
    registered_capital: String,
    paid_capital_wan: Option<i64>,
    paid_capital: String,
    social_security_num: i64,
    enterprise_class: String,
    enterprise_above_class: String,
    status: String,
    status_code: Option<String>,
    start_date: String,
    change_date: String,
    check_date: String,
    last_update_time: String,
    address: String,
    reg_address: String,
    business_address: String,
    scope: String,
    main_product: String,
    industrial_chain: String,
    keywords: String,
    group_name: String,
    park_name: String,
    listed_state: String,
    tel: String,
    emails: String,
    domain: String,
    website_num: i64,
    patent_num: i64,
    trademark_num: i64,
    certificates_num: i64,
    recruit_num: i64,
    tax_revenue_growth_rate: Option<f64>,
    main_income_growth_label: Option<f64>,
    score: f64,
    decision: String,
    risk_counts_json: String,
    enrich_json: String,
    coverage_json: String,
    score_parts_json: String,
    detail_json: String,
    risk_rows_json: String,
    source_queries_json: String,
    classifications_ys_json: String,
    role_evidence_json: String,
}

impl CompanyRow {
    fn into_company(self) -> CompanyDetail {
        CompanyDetail {
            name: self.name,
            short_name: self.short_name,
            credit_code: self.credit_code,
            enterprise_code: self.enterprise_code,
            operator: self.operator,
            category: self.category,
            role_label: self.role_label,
            role_evidence: serde_json::from_str(&self.role_evidence_json).unwrap_or_default(),
            province: self.province,
            city: self.city,
            distance_km: self.distance_km,
            lat: self.lat,
            lng: self.lng,
            registered_capital_wan: self.registered_capital_wan,
            registered_capital: self.registered_capital,
            paid_capital_wan: self.paid_capital_wan,
            paid_capital: self.paid_capital,
            social_security_num: self.social_security_num,
            enterprise_class: self.enterprise_class,
            enterprise_above_class: self.enterprise_above_class,
            status: self.status,
            status_code: self.status_code,
            start_date: self.start_date,
            change_date: self.change_date,
            check_date: self.check_date,
            last_update_time: self.last_update_time,
            address: self.address,
            reg_address: self.reg_address,
            business_address: self.business_address,
            scope: self.scope,
            main_product: serde_json::from_str(&self.main_product).unwrap_or_default(),
            industrial_chain: serde_json::from_str(&self.industrial_chain).unwrap_or_default(),
            keywords: serde_json::from_str(&self.keywords).unwrap_or_default(),
            group_name: self.group_name,
            park_name: self.park_name,
            listed_state: self.listed_state,
            tel: self.tel,
            emails: self.emails,
            domain: self.domain,
            website_num: self.website_num,
            patent_num: self.patent_num,
            trademark_num: self.trademark_num,
            certificates_num: self.certificates_num,
            recruit_num: self.recruit_num,
            tax_revenue_growth_rate: self.tax_revenue_growth_rate,
            main_income_growth_label: self.main_income_growth_label,
            classifications_ys: serde_json::from_str(&self.classifications_ys_json)
                .unwrap_or_default(),
            detail: serde_json::from_str(&self.detail_json).unwrap_or_default(),
            enrich: serde_json::from_str(&self.enrich_json).unwrap_or_default(),
            risk_counts: serde_json::from_str(&self.risk_counts_json).unwrap_or_default(),
            risk_rows: serde_json::from_str(&self.risk_rows_json).unwrap_or_default(),
            coverage: serde_json::from_str(&self.coverage_json).unwrap_or_default(),
            score: self.score,
            score_parts: serde_json::from_str(&self.score_parts_json).unwrap_or_default(),
            decision: self.decision,
            source_queries: serde_json::from_str(&self.source_queries_json).unwrap_or_default(),
        }
    }
}
