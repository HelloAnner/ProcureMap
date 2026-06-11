use crate::error::Result;
use crate::models::task::Task;
use chrono::NaiveDateTime;
use sqlx::SqlitePool;

/// Create a new task record.
pub async fn create_task(
    pool: &SqlitePool,
    id: &str,
    config_json: &str,
    origin_name: &str,
    material_label: &str,
    radius_km: i32,
) -> Result<Task> {
    sqlx::query(
        r#"
        INSERT INTO tasks (id, status, step, progress, config_json, origin_name, material_label, radius_km)
        VALUES (?1, 'queued', 'token', 0, ?2, ?3, ?4, ?5)
        "#,
    )
    .bind(id)
    .bind(config_json)
    .bind(origin_name)
    .bind(material_label)
    .bind(radius_km)
    .execute(pool)
    .await?;

    get_task(pool, id).await
}

/// Fetch a single task by ID.
pub async fn get_task(pool: &SqlitePool, id: &str) -> Result<Task> {
    sqlx::query_as::<_, TaskRow>(
        r#"
        SELECT id, status, step, progress, config_json, origin_name, material_label,
               radius_km, company_count, factory_count, agent_count, avg_score, top_score,
               api_calls, api_failures, duration_seconds, error_message, cancelled, favorite,
               notes, created_at, completed_at
        FROM tasks WHERE id = ?1
        "#,
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map(|row| row.into_task())
    .map_err(|e| crate::error::AppError::TaskNotFound(format!("任务 {} 未找到: {}", id, e)))
}

/// Update a task's status and step.
pub async fn update_task_status(
    pool: &SqlitePool,
    id: &str,
    status: &str,
    step: &str,
) -> Result<()> {
    sqlx::query("UPDATE tasks SET status = ?1, step = ?2 WHERE id = ?3")
        .bind(status)
        .bind(step)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Update a task's progress percentage.
pub async fn update_task_progress(pool: &SqlitePool, id: &str, progress: i32) -> Result<()> {
    sqlx::query("UPDATE tasks SET progress = ?1 WHERE id = ?2")
        .bind(progress)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Mark a task as completed with final statistics.
pub async fn complete_task(
    pool: &SqlitePool,
    id: &str,
    company_count: i32,
    factory_count: i32,
    agent_count: i32,
    avg_score: f64,
    top_score: f64,
    api_calls: i32,
    api_failures: i32,
    duration_seconds: f64,
) -> Result<()> {
    sqlx::query(
        r#"
        UPDATE tasks SET
            status = 'done', step = 'done', progress = 100,
            company_count = ?1, factory_count = ?2, agent_count = ?3,
            avg_score = ?4, top_score = ?5, api_calls = ?6, api_failures = ?7,
            duration_seconds = ?8, completed_at = datetime('now', 'localtime')
        WHERE id = ?9
        "#,
    )
    .bind(company_count)
    .bind(factory_count)
    .bind(agent_count)
    .bind(avg_score)
    .bind(top_score)
    .bind(api_calls)
    .bind(api_failures)
    .bind(duration_seconds)
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

/// Mark a task as errored.
pub async fn fail_task(pool: &SqlitePool, id: &str, error_message: &str) -> Result<()> {
    sqlx::query(
        r#"
        UPDATE tasks SET
            status = 'error', step = 'done', error_message = ?1,
            completed_at = datetime('now', 'localtime')
        WHERE id = ?2
        "#,
    )
    .bind(error_message)
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

/// Mark a task as cancelled.
pub async fn cancel_task_db(pool: &SqlitePool, id: &str) -> Result<()> {
    sqlx::query(
        "UPDATE tasks SET status = 'cancelled', cancelled = 1, completed_at = datetime('now', 'localtime') WHERE id = ?1",
    )
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

/// List all tasks, most recent first.
pub async fn list_tasks(pool: &SqlitePool) -> Result<Vec<Task>> {
    let rows = sqlx::query_as::<_, TaskRow>(
        r#"
        SELECT id, status, step, progress, config_json, origin_name, material_label,
               radius_km, company_count, factory_count, agent_count, avg_score, top_score,
               api_calls, api_failures, duration_seconds, error_message, cancelled, favorite,
               notes, created_at, completed_at
        FROM tasks ORDER BY created_at DESC LIMIT 50
        "#,
    )
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|r| r.into_task()).collect())
}

/// Delete a task and its related data.
pub async fn delete_task(pool: &SqlitePool, id: &str) -> Result<()> {
    sqlx::query("DELETE FROM analysis_results WHERE task_id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    sqlx::query("DELETE FROM companies WHERE task_id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    sqlx::query("DELETE FROM tasks WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Toggle favorite status.
pub async fn set_favorite(pool: &SqlitePool, id: &str, favorite: bool) -> Result<()> {
    sqlx::query("UPDATE tasks SET favorite = ?1 WHERE id = ?2")
        .bind(favorite)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Get favorite tasks.
pub async fn get_favorites(pool: &SqlitePool) -> Result<Vec<Task>> {
    let rows = sqlx::query_as::<_, TaskRow>(
        r#"
        SELECT id, status, step, progress, config_json, origin_name, material_label,
               radius_km, company_count, factory_count, agent_count, avg_score, top_score,
               api_calls, api_failures, duration_seconds, error_message, cancelled, favorite,
               notes, created_at, completed_at
        FROM tasks WHERE favorite = 1 ORDER BY created_at DESC LIMIT 50
        "#,
    )
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|r| r.into_task()).collect())
}

// --- Internal row struct for sqlx query_as ---

#[derive(Debug, sqlx::FromRow)]
struct TaskRow {
    id: String,
    status: String,
    step: String,
    progress: i32,
    config_json: String,
    origin_name: String,
    material_label: String,
    radius_km: i32,
    company_count: i32,
    factory_count: i32,
    agent_count: i32,
    avg_score: f64,
    top_score: f64,
    api_calls: i32,
    api_failures: i32,
    duration_seconds: f64,
    error_message: Option<String>,
    cancelled: i32,
    favorite: i32,
    notes: Option<String>,
    created_at: String,
    completed_at: Option<String>,
}

fn parse_datetime(s: &str) -> NaiveDateTime {
    NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S")
        .unwrap_or_else(|_| chrono::Utc::now().naive_utc())
}

impl TaskRow {
    fn into_task(self) -> Task {
        Task {
            id: self.id,
            status: self.status,
            step: self.step,
            progress: self.progress,
            config_json: self.config_json,
            origin_name: self.origin_name,
            material_label: self.material_label,
            radius_km: self.radius_km,
            company_count: self.company_count,
            factory_count: self.factory_count,
            agent_count: self.agent_count,
            avg_score: self.avg_score,
            top_score: self.top_score,
            api_calls: self.api_calls,
            api_failures: self.api_failures,
            duration_seconds: self.duration_seconds,
            error_message: self.error_message,
            cancelled: self.cancelled != 0,
            favorite: self.favorite != 0,
            notes: self.notes,
            created_at: parse_datetime(&self.created_at),
            completed_at: self.completed_at.as_deref().map(parse_datetime),
        }
    }
}
