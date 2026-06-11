// Centralized API layer — wraps all Tauri invoke() calls with typed interfaces matching Rust models.

import { invoke } from '@tauri-apps/api/core';

// ---------------------------------------------------------------------------
// Types (mirrors Rust models in src-tauri/src/models/)
// ---------------------------------------------------------------------------

export interface RunConfig {
  origin_name: string;
  material_label: string;
  keywords: string[];
  areas: string[];
  radius_km: number;
  max_details: number;
  enrich_limit: number;
  pages: number;
  search_limit: number;
  output_dir: string;
  lat: number | null;
  lng: number | null;
  industry_name3: string;
  internal_token: string;
  pause: number;
  timeout: number;
}

export interface Task {
  id: string;
  status: string;
  step: string;
  progress: number;
  config_json: string;
  origin_name: string;
  material_label: string;
  radius_km: number;
  company_count: number;
  factory_count: number;
  agent_count: number;
  avg_score: number;
  top_score: number;
  api_calls: number;
  api_failures: number;
  duration_seconds: number;
  error_message: string | null;
  cancelled: boolean;
  favorite: boolean;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface RoleEvidence {
  factory: boolean;
  agent: boolean;
  industry: string;
}

export interface CompanyDetail {
  name: string;
  short_name: string;
  credit_code: string;
  enterprise_code: string;
  operator: string;
  category: string;
  role_label: string;
  role_evidence: RoleEvidence;
  province: string;
  city: string;
  distance_km: number;
  lat: number;
  lng: number;
  registered_capital_wan: number | null;
  registered_capital: string;
  paid_capital_wan: number | null;
  paid_capital: string;
  social_security_num: number;
  enterprise_class: string;
  enterprise_above_class: string;
  status: string;
  status_code: string | null;
  start_date: string;
  change_date: string;
  check_date: string;
  last_update_time: string;
  address: string;
  reg_address: string;
  business_address: string;
  scope: string;
  main_product: string[];
  industrial_chain: string[];
  keywords: string[];
  group_name: string;
  park_name: string;
  listed_state: string;
  tel: string;
  emails: string;
  domain: string;
  website_num: number;
  patent_num: number;
  trademark_num: number;
  certificates_num: number;
  recruit_num: number;
  tax_revenue_growth_rate: number | null;
  main_income_growth_label: number | null;
  classifications_ys: Record<string, unknown>;
  detail: Record<string, unknown>;
  enrich: Record<string, unknown>;
  risk_counts: Record<string, number>;
  risk_rows: Record<string, unknown>;
  coverage: Record<string, unknown>;
  score: number;
  score_parts: Record<string, number>;
  decision: string;
  source_queries: Record<string, unknown>[];
}

export interface AnalysisSummary {
  company_count: number;
  factory_count: number;
  agent_count: number;
  average_score: number;
  top_score: number;
  with_contact: number;
  with_risk_signal: number;
}

export interface ChartsData {
  role_counts: Record<string, number>;
  province_counts: Record<string, number>;
  city_counts: Record<string, number>;
  status_counts: Record<string, number>;
  distance_buckets: Record<string, number>;
  risk_totals: Record<string, number>;
  coverage_totals: Record<string, unknown>;
}

export interface EnrichScope {
  mode: string;
  limit: number;
  description: string;
}

export interface AnalysisSnapshot {
  generated_at: string;
  duration_seconds: number;
  api_calls: number;
  api_failures: string | null;
  origin_name: string;
  origin_lat: number;
  origin_lng: number;
  origin_note: string;
  radius_km: number;
  material_label: string;
  material_keywords: string[];
  enrich_scope: EnrichScope | null;
  summary: AnalysisSummary;
  charts: ChartsData;
}

// Rust ProgressEvent uses tagged enum: { type: "StepChanged", data: {...} }
export type ProgressEvent =
  | { type: 'StepChanged'; data: { step: string; label: string } }
  | { type: 'SearchProgress'; data: { query_index: number; total_queries: number; page: number; total_rows: number; candidates: number } }
  | { type: 'DetailProgress'; data: { processed: number; total: number; kept: number } }
  | { type: 'EnrichProgress'; data: { processed: number; total: number } }
  | { type: 'LogLine'; data: { line: string } }
  | { type: 'TaskCompleted'; data: { task_id: string; company_count: number; duration_seconds: number } }
  | { type: 'TaskError'; data: { task_id: string; error: string } };

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface UserSession {
  user_id: string;
  username: string;
  role: string;
  authenticated: boolean;
}

export interface AuthResponse {
  token: string;
  user: UserSession;
}

export async function apiLogin(password: string, username = 'admin'): Promise<AuthResponse> {
  return invoke('login', { username, password });
}

export async function apiLogout(token: string): Promise<void> {
  return invoke('logout', { token });
}

export async function apiValidateSession(token: string): Promise<UserSession> {
  return invoke('validate_session', { token });
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function apiCreateAnalysis(taskId: string, config: RunConfig): Promise<Task> {
  return invoke('create_analysis', {
    taskId,
    configJson: JSON.stringify(config),
  });
}

export async function apiGetTask(taskId: string): Promise<Task> {
  return invoke('get_task', { taskId });
}

export async function apiListTasks(): Promise<Task[]> {
  return invoke('list_tasks');
}

export async function apiCancelTask(taskId: string): Promise<void> {
  return invoke('cancel_task', { taskId });
}

export async function apiDeleteTask(taskId: string): Promise<void> {
  return invoke('delete_task', { taskId });
}

export async function apiGetRecentAnalyses(): Promise<Task[]> {
  return invoke('get_recent_analyses');
}

export async function apiAddToFavorites(taskId: string): Promise<void> {
  return invoke('add_to_favorites', { taskId });
}

export async function apiRemoveFromFavorites(taskId: string): Promise<void> {
  return invoke('remove_from_favorites', { taskId });
}

export async function apiGetFavorites(): Promise<Task[]> {
  return invoke('get_favorites');
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

export async function apiGetAnalysis(taskId: string): Promise<AnalysisSnapshot> {
  return invoke('get_analysis', { taskId });
}

export async function apiGetCompanyDetail(
  taskId: string,
  creditCode: string,
): Promise<CompanyDetail> {
  return invoke('get_company_detail', { taskId, creditCode });
}

export interface CompanyFilters {
  category?: string;
  decision?: string;
  province?: string;
  scoreMin?: number;
  scoreMax?: number;
  distMin?: number;
  distMax?: number;
  onlyActive?: boolean;
  onlyContact?: boolean;
  onlyRiskFree?: boolean;
  search?: string;
  sortBy?: string;
  limit?: number;
  offset?: number;
}

export async function apiGetFilteredCompanies(
  taskId: string,
  filters: CompanyFilters = {},
): Promise<CompanyDetail[]> {
  return invoke('get_filtered_companies', {
    taskId,
    ...filters,
  });
}

export async function apiExportCompaniesCsv(
  taskId: string,
  filePath: string,
): Promise<void> {
  return invoke('export_companies_csv', { taskId, filePath });
}

export async function apiExportHtmlFile(filePath: string, html: string): Promise<void> {
  return invoke('export_html_file', { filePath, html });
}

export async function apiGetChartsData(taskId: string): Promise<ChartsData> {
  return invoke('get_charts_data', { taskId });
}

// ---------------------------------------------------------------------------
// System
// ---------------------------------------------------------------------------

export async function apiGetAppVersion(): Promise<string> {
  return invoke('get_app_version');
}

export function apiGetDefaultConfig(): Promise<RunConfig> {
  return invoke('get_default_config');
}
