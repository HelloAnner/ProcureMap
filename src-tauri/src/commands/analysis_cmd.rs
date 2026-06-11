use crate::db::analysis::get_analysis_result;
use crate::db::companies::{get_companies_by_task, get_company_by_credit_code};
use crate::error::Result;
use crate::models::analysis::{AnalysisSnapshot, ChartsData};
use crate::models::company::CompanyDetail;
use crate::services::export::export_csv;
use crate::state::AppState;
use tauri::State;

/// Get the analysis snapshot for a task.
#[tauri::command]
pub async fn get_analysis(
    state: State<'_, AppState>,
    task_id: String,
) -> Result<AnalysisSnapshot> {
    get_analysis_result(&state.pool, &task_id).await
}

/// Get a single company's full detail by credit code within a task.
#[tauri::command]
pub async fn get_company_detail(
    state: State<'_, AppState>,
    task_id: String,
    credit_code: String,
) -> Result<CompanyDetail> {
    get_company_by_credit_code(&state.pool, &task_id, &credit_code).await
}

/// Get filtered and sorted companies for a task.
#[tauri::command]
pub async fn get_filtered_companies(
    state: State<'_, AppState>,
    task_id: String,
    category: Option<String>,
    decision: Option<String>,
    province: Option<String>,
    score_min: Option<f64>,
    score_max: Option<f64>,
    dist_min: Option<f64>,
    dist_max: Option<f64>,
    only_active: Option<bool>,
    only_contact: Option<bool>,
    only_risk_free: Option<bool>,
    search: Option<String>,
    sort_by: Option<String>,
    limit: Option<i32>,
    offset: Option<i32>,
) -> Result<Vec<CompanyDetail>> {
    get_companies_by_task(
        &state.pool,
        &task_id,
        category.as_deref(),
        decision.as_deref(),
        province.as_deref(),
        score_min,
        score_max,
        dist_min,
        dist_max,
        only_active,
        only_contact,
        only_risk_free,
        search.as_deref(),
        sort_by.as_deref(),
        limit,
        offset,
    )
    .await
}

/// Export companies to CSV file.
#[tauri::command]
pub async fn export_companies_csv(
    state: State<'_, AppState>,
    task_id: String,
    file_path: String,
) -> Result<()> {
    let companies = get_companies_by_task(
        &state.pool,
        &task_id,
        None, None, None, None, None, None, None,
        None, None, None, None, None, None, None,
    )
    .await?;

    export_csv(&companies, &file_path)
}

/// Export rendered HTML to a user-selected file path.
#[tauri::command]
pub async fn export_html_file(file_path: String, html: String) -> Result<()> {
    std::fs::write(file_path, html)?;
    Ok(())
}

/// Get charts data for a task.
#[tauri::command]
pub async fn get_charts_data(
    state: State<'_, AppState>,
    task_id: String,
) -> Result<ChartsData> {
    let analysis = get_analysis_result(&state.pool, &task_id).await?;
    Ok(analysis.charts)
}
