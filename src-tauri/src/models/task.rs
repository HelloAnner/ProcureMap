use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    Queued,
    Running,
    Done,
    Error,
    Cancelled,
}

impl TaskStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            TaskStatus::Queued => "queued",
            TaskStatus::Running => "running",
            TaskStatus::Done => "done",
            TaskStatus::Error => "error",
            TaskStatus::Cancelled => "cancelled",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "running" => TaskStatus::Running,
            "done" => TaskStatus::Done,
            "error" => TaskStatus::Error,
            "cancelled" => TaskStatus::Cancelled,
            _ => TaskStatus::Queued,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PipelineStep {
    Token,
    Search,
    Detail,
    Enrich,
    Scoring,
    Building,
    Done,
}

impl PipelineStep {
    pub fn as_str(&self) -> &'static str {
        match self {
            PipelineStep::Token => "token",
            PipelineStep::Search => "search",
            PipelineStep::Detail => "detail",
            PipelineStep::Enrich => "enrich",
            PipelineStep::Scoring => "scoring",
            PipelineStep::Building => "building",
            PipelineStep::Done => "done",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "token" => PipelineStep::Token,
            "search" => PipelineStep::Search,
            "detail" => PipelineStep::Detail,
            "enrich" => PipelineStep::Enrich,
            "scoring" => PipelineStep::Scoring,
            "building" => PipelineStep::Building,
            _ => PipelineStep::Done,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub status: String,
    pub step: String,
    pub progress: i32,
    pub config_json: String,
    pub origin_name: String,
    pub material_label: String,
    pub radius_km: i32,
    pub company_count: i32,
    pub factory_count: i32,
    pub agent_count: i32,
    pub avg_score: f64,
    pub top_score: f64,
    pub api_calls: i32,
    pub api_failures: i32,
    pub duration_seconds: f64,
    pub error_message: Option<String>,
    pub cancelled: bool,
    pub favorite: bool,
    pub notes: Option<String>,
    pub created_at: NaiveDateTime,
    pub completed_at: Option<NaiveDateTime>,
}

impl Task {
    pub fn status_enum(&self) -> TaskStatus {
        TaskStatus::from_str(&self.status)
    }

    pub fn step_enum(&self) -> PipelineStep {
        PipelineStep::from_str(&self.step)
    }
}
