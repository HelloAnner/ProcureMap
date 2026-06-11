use crate::db::tasks;
use crate::error::{AppError, Result};
use crate::models::events::ProgressEvent;
use crate::models::task::Task;
use crate::services::analysis_service::run_analysis_pipeline;
use crate::state::AppState;
use tauri::{Emitter, State, Window};

/// Create a new analysis task and start it asynchronously.
#[tauri::command]
pub async fn create_analysis(
    state: State<'_, AppState>,
    window: Window,
    task_id: String,
    config_json: String,
) -> Result<Task> {
    let config: crate::models::config::RunConfig =
        serde_json::from_str(&config_json).map_err(|e| {
            AppError::ConfigError(format!("无法解析配置 JSON: {}", e))
        })?;

    // Create the task record
    let task = tasks::create_task(
        &state.pool,
        &task_id,
        &config_json,
        &config.origin_name,
        &config.material_label,
        config.radius_km,
    )
    .await?;

    // Spawn the analysis pipeline in a background tokio task
    let app_state = state.inner().clone();
    let task_id_clone = task_id.clone();
    let config_clone = config;
    let window_clone = window.clone();

    tokio::spawn(async move {
        match run_analysis_pipeline(&app_state, &task_id_clone, &config_clone, &window_clone).await
        {
            Ok(()) => {
                // Success - already emitted TaskCompleted in the pipeline
            }
            Err(e) => {
                if matches!(e, AppError::Cancelled) {
                    let _ = tasks::cancel_task_db(&app_state.pool, &task_id_clone).await;
                } else {
                    let _ = tasks::fail_task(&app_state.pool, &task_id_clone, &e.to_string())
                        .await;
                }
                let _ = window_clone.emit(
                    "progress",
                    ProgressEvent::TaskError {
                        task_id: task_id_clone,
                        error: e.to_string(),
                    },
                );
            }
        }
    });

    Ok(task)
}

/// Get a single task by ID.
#[tauri::command]
pub async fn get_task(state: State<'_, AppState>, task_id: String) -> Result<Task> {
    tasks::get_task(&state.pool, &task_id).await
}

/// List all tasks (most recent first).
#[tauri::command]
pub async fn list_tasks(state: State<'_, AppState>) -> Result<Vec<Task>> {
    tasks::list_tasks(&state.pool).await
}

/// Cancel a running task.
#[tauri::command]
pub async fn cancel_task(state: State<'_, AppState>, task_id: String) -> Result<()> {
    // Get the task to check it exists
    tasks::get_task(&state.pool, &task_id).await?;

    // Trigger cancellation
    if let Some(token) = state.cancel_tokens.get(&task_id) {
        token.cancel();
    }

    tasks::cancel_task_db(&state.pool, &task_id).await?;
    Ok(())
}

/// Delete a task and its related data.
#[tauri::command]
pub async fn delete_task(state: State<'_, AppState>, task_id: String) -> Result<()> {
    tasks::delete_task(&state.pool, &task_id).await
}

/// Get recent completed analyses for quick reference.
#[tauri::command]
pub async fn get_recent_analyses(state: State<'_, AppState>) -> Result<Vec<Task>> {
    let all = tasks::list_tasks(&state.pool).await?;
    Ok(all
        .into_iter()
        .filter(|t| t.status == "done" || t.status == "error")
        .take(10)
        .collect())
}

/// Add a task to favorites.
#[tauri::command]
pub async fn add_to_favorites(state: State<'_, AppState>, task_id: String) -> Result<()> {
    tasks::set_favorite(&state.pool, &task_id, true).await
}

/// Remove a task from favorites.
#[tauri::command]
pub async fn remove_from_favorites(state: State<'_, AppState>, task_id: String) -> Result<()> {
    tasks::set_favorite(&state.pool, &task_id, false).await
}

/// Get all favorite tasks.
#[tauri::command]
pub async fn get_favorites(state: State<'_, AppState>) -> Result<Vec<Task>> {
    tasks::get_favorites(&state.pool).await
}
