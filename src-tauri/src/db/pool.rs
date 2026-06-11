use crate::error::{AppError, Result};
use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};
use tauri::Manager;

/// Initialize the SQLite connection pool and run migrations.
pub async fn init_pool(app: &tauri::AppHandle) -> Result<SqlitePool> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("无法获取应用数据目录: {}", e)))?;

    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| AppError::IoError(e))?;

    let db_path = app_data_dir.join("procuremap.db");
    let db_url = format!("sqlite:{}?mode=rwc", db_path.display());

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await
        .map_err(AppError::DatabaseError)?;

    run_migrations(&pool).await?;

    Ok(pool)
}

/// Run schema migrations inline.
async fn run_migrations(pool: &SqlitePool) -> Result<()> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY NOT NULL,
            status TEXT NOT NULL DEFAULT 'queued',
            step TEXT NOT NULL DEFAULT 'token',
            progress INTEGER NOT NULL DEFAULT 0,
            config_json TEXT NOT NULL DEFAULT '{}',
            origin_name TEXT NOT NULL DEFAULT '',
            material_label TEXT NOT NULL DEFAULT '',
            radius_km INTEGER NOT NULL DEFAULT 300,
            company_count INTEGER NOT NULL DEFAULT 0,
            factory_count INTEGER NOT NULL DEFAULT 0,
            agent_count INTEGER NOT NULL DEFAULT 0,
            avg_score REAL NOT NULL DEFAULT 0.0,
            top_score REAL NOT NULL DEFAULT 0.0,
            api_calls INTEGER NOT NULL DEFAULT 0,
            api_failures INTEGER NOT NULL DEFAULT 0,
            duration_seconds REAL NOT NULL DEFAULT 0.0,
            error_message TEXT,
            cancelled INTEGER NOT NULL DEFAULT 0,
            favorite INTEGER NOT NULL DEFAULT 0,
            notes TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
            completed_at TEXT
        );
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS companies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id TEXT NOT NULL,
            name TEXT NOT NULL DEFAULT '',
            short_name TEXT NOT NULL DEFAULT '',
            credit_code TEXT NOT NULL DEFAULT '',
            enterprise_code TEXT NOT NULL DEFAULT '',
            operator TEXT NOT NULL DEFAULT '',
            category TEXT NOT NULL DEFAULT '',
            role_label TEXT NOT NULL DEFAULT '',
            province TEXT NOT NULL DEFAULT '',
            city TEXT NOT NULL DEFAULT '',
            distance_km REAL NOT NULL DEFAULT 0.0,
            lat REAL NOT NULL DEFAULT 0.0,
            lng REAL NOT NULL DEFAULT 0.0,
            registered_capital_wan INTEGER,
            registered_capital TEXT NOT NULL DEFAULT '',
            paid_capital_wan INTEGER,
            paid_capital TEXT NOT NULL DEFAULT '',
            social_security_num INTEGER NOT NULL DEFAULT 0,
            enterprise_class TEXT NOT NULL DEFAULT '',
            enterprise_above_class TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT '',
            status_code TEXT,
            start_date TEXT NOT NULL DEFAULT '',
            change_date TEXT NOT NULL DEFAULT '',
            check_date TEXT NOT NULL DEFAULT '',
            last_update_time TEXT NOT NULL DEFAULT '',
            address TEXT NOT NULL DEFAULT '',
            reg_address TEXT NOT NULL DEFAULT '',
            business_address TEXT NOT NULL DEFAULT '',
            scope TEXT NOT NULL DEFAULT '',
            main_product TEXT NOT NULL DEFAULT '[]',
            industrial_chain TEXT NOT NULL DEFAULT '[]',
            keywords TEXT NOT NULL DEFAULT '[]',
            group_name TEXT NOT NULL DEFAULT '',
            park_name TEXT NOT NULL DEFAULT '',
            listed_state TEXT NOT NULL DEFAULT '',
            tel TEXT NOT NULL DEFAULT '',
            emails TEXT NOT NULL DEFAULT '',
            domain TEXT NOT NULL DEFAULT '',
            website_num INTEGER NOT NULL DEFAULT 0,
            patent_num INTEGER NOT NULL DEFAULT 0,
            trademark_num INTEGER NOT NULL DEFAULT 0,
            certificates_num INTEGER NOT NULL DEFAULT 0,
            recruit_num INTEGER NOT NULL DEFAULT 0,
            tax_revenue_growth_rate REAL,
            main_income_growth_label REAL,
            score REAL NOT NULL DEFAULT 0.0,
            decision TEXT NOT NULL DEFAULT '',
            risk_counts_json TEXT NOT NULL DEFAULT '{}',
            enrich_json TEXT NOT NULL DEFAULT '{}',
            coverage_json TEXT NOT NULL DEFAULT '{}',
            score_parts_json TEXT NOT NULL DEFAULT '{}',
            detail_json TEXT NOT NULL DEFAULT '{}',
            risk_rows_json TEXT NOT NULL DEFAULT '{}',
            source_queries_json TEXT NOT NULL DEFAULT '[]',
            classifications_ys_json TEXT NOT NULL DEFAULT '{}',
            role_evidence_json TEXT NOT NULL DEFAULT '{}',
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_task_credit_code
        ON companies(task_id, credit_code);
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS analysis_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id TEXT NOT NULL UNIQUE,
            generated_at TEXT NOT NULL DEFAULT '',
            duration_seconds REAL NOT NULL DEFAULT 0.0,
            api_calls INTEGER NOT NULL DEFAULT 0,
            api_failures TEXT,
            origin_name TEXT NOT NULL DEFAULT '',
            origin_lat REAL NOT NULL DEFAULT 0.0,
            origin_lng REAL NOT NULL DEFAULT 0.0,
            origin_note TEXT NOT NULL DEFAULT '',
            radius_km INTEGER NOT NULL DEFAULT 0,
            material_label TEXT NOT NULL DEFAULT '',
            material_keywords TEXT NOT NULL DEFAULT '[]',
            enrich_scope_json TEXT,
            summary_json TEXT NOT NULL DEFAULT '{}',
            charts_json TEXT NOT NULL DEFAULT '{}',
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}
