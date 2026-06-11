use crate::error::Result;
use crate::models::analysis::AnalysisSnapshot;
use sqlx::SqlitePool;

pub async fn insert_analysis_result(
    pool: &SqlitePool,
    task_id: &str,
    snapshot: &AnalysisSnapshot,
) -> Result<()> {
    let material_keywords = serde_json::to_string(&snapshot.material_keywords).unwrap_or_default();
    let enrich_scope_json = snapshot
        .enrich_scope
        .as_ref()
        .map(|s| serde_json::to_string(s).unwrap_or_default());
    let summary_json = serde_json::to_string(&snapshot.summary).unwrap_or_default();
    let charts_json = serde_json::to_string(&snapshot.charts).unwrap_or_default();
    let api_failures = snapshot.api_failures.clone();

    sqlx::query(
        r#"
        INSERT OR REPLACE INTO analysis_results (
            task_id, generated_at, duration_seconds, api_calls, api_failures,
            origin_name, origin_lat, origin_lng, origin_note, radius_km,
            material_label, material_keywords, enrich_scope_json,
            summary_json, charts_json
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
        "#,
    )
    .bind(task_id)
    .bind(&snapshot.generated_at)
    .bind(snapshot.duration_seconds)
    .bind(snapshot.api_calls)
    .bind(&api_failures)
    .bind(&snapshot.origin_name)
    .bind(snapshot.origin_lat)
    .bind(snapshot.origin_lng)
    .bind(&snapshot.origin_note)
    .bind(snapshot.radius_km)
    .bind(&snapshot.material_label)
    .bind(&material_keywords)
    .bind(&enrich_scope_json)
    .bind(&summary_json)
    .bind(&charts_json)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn get_analysis_result(
    pool: &SqlitePool,
    task_id: &str,
) -> Result<AnalysisSnapshot> {
    let row = sqlx::query_as::<_, AnalysisRow>(
        r#"
        SELECT task_id, generated_at, duration_seconds, api_calls, api_failures,
               origin_name, origin_lat, origin_lng, origin_note, radius_km,
               material_label, material_keywords, enrich_scope_json,
               summary_json, charts_json
        FROM analysis_results WHERE task_id = ?1
        "#,
    )
    .bind(task_id)
    .fetch_one(pool)
    .await
    .map_err(|_| crate::error::AppError::TaskNotFound(format!("分析结果未找到: {}", task_id)))?;

    Ok(AnalysisSnapshot {
        generated_at: row.generated_at,
        duration_seconds: row.duration_seconds,
        api_calls: row.api_calls,
        api_failures: row.api_failures,
        origin_name: row.origin_name,
        origin_lat: row.origin_lat,
        origin_lng: row.origin_lng,
        origin_note: row.origin_note,
        radius_km: row.radius_km,
        material_label: row.material_label,
        material_keywords: serde_json::from_str(&row.material_keywords).unwrap_or_default(),
        enrich_scope: row
            .enrich_scope_json
            .and_then(|s| serde_json::from_str(&s).ok()),
        summary: serde_json::from_str(&row.summary_json).unwrap_or_default(),
        charts: serde_json::from_str(&row.charts_json).unwrap_or_default(),
    })
}

#[derive(Debug, sqlx::FromRow)]
#[allow(dead_code)]
struct AnalysisRow {
    task_id: String,
    generated_at: String,
    duration_seconds: f64,
    api_calls: i32,
    api_failures: Option<String>,
    origin_name: String,
    origin_lat: f64,
    origin_lng: f64,
    origin_note: String,
    radius_km: i32,
    material_label: String,
    material_keywords: String,
    enrich_scope_json: Option<String>,
    summary_json: String,
    charts_json: String,
}
