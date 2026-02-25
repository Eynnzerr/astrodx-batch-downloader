use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionManifestMeta {
  pub id: String,
  pub name: String,
  pub path: String,
  pub relative_path: String,
  pub level_count: usize,
  pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadTaskInput {
  pub selected_manifest_paths: Vec<String>,
  pub output_dir: String,
  pub connect_sid: String,
  pub auth_mode: String,
  pub key: Option<String>,
  pub captcha: Option<String>,
  pub download_no_bga: bool,
  pub output_format: String,
  pub auto_bundle: bool,
  pub bundle_output_path: Option<String>,
  pub retries: Option<u32>,
  pub request_interval_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FailItem {
  pub id: String,
  pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskState {
  pub task_id: String,
  pub status: String,
  pub total_ids: usize,
  pub processed_ids: usize,
  pub ok_count: usize,
  pub skip_count: usize,
  pub fail_count: usize,
  pub new_files_count: usize,
  pub bundle_output_path: Option<String>,
  pub fail_items: Vec<FailItem>,
  pub logs: Vec<String>,
  pub started_at: Option<String>,
  pub ended_at: Option<String>,
  pub message: Option<String>,
}

impl TaskState {
  pub fn new(task_id: String) -> Self {
    Self {
      task_id,
      status: "pending".to_string(),
      total_ids: 0,
      processed_ids: 0,
      ok_count: 0,
      skip_count: 0,
      fail_count: 0,
      new_files_count: 0,
      bundle_output_path: None,
      fail_items: Vec::new(),
      logs: Vec::new(),
      started_at: None,
      ended_at: None,
      message: None,
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskEvent {
  pub task_id: String,
  pub level: String,
  pub event: String,
  pub message: String,
  pub status: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ParsedManifest {
  pub name: String,
  pub level_ids: Vec<String>,
}
