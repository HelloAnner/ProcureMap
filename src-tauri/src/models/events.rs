use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", content = "data")]
pub enum ProgressEvent {
    StepChanged {
        step: String,
        label: String,
    },
    SearchProgress {
        query_index: i32,
        total_queries: i32,
        page: i32,
        total_rows: i32,
        candidates: i32,
    },
    DetailProgress {
        processed: i32,
        total: i32,
        kept: i32,
    },
    EnrichProgress {
        processed: i32,
        total: i32,
    },
    LogLine {
        line: String,
    },
    TaskCompleted {
        task_id: String,
        company_count: i32,
        duration_seconds: f64,
    },
    TaskError {
        task_id: String,
        error: String,
    },
}
