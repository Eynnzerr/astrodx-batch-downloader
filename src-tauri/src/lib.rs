mod bundler;
mod collections;
mod downloader;
mod models;

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{
  atomic::AtomicBool,
  Arc,
};

use parking_lot::Mutex;
use tauri::Manager;

use models::{CollectionManifestMeta, DownloadTaskInput, TaskState};

pub struct InnerState {
  pub tasks: Mutex<HashMap<String, TaskState>>,
  pub cancel_flags: Mutex<HashMap<String, Arc<AtomicBool>>>,
  pub overlay_collections_dir: Mutex<Option<PathBuf>>,
}

impl Default for InnerState {
  fn default() -> Self {
    Self {
      tasks: Mutex::new(HashMap::new()),
      cancel_flags: Mutex::new(HashMap::new()),
      overlay_collections_dir: Mutex::new(None),
    }
  }
}

#[derive(Clone)]
pub struct AppRuntimeState(pub Arc<InnerState>);

impl Default for AppRuntimeState {
  fn default() -> Self {
    Self(Arc::new(InnerState::default()))
  }
}

pub fn update_task<F>(state: &Arc<InnerState>, task_id: &str, f: F)
where
  F: FnOnce(&mut TaskState),
{
  if let Some(task) = state.tasks.lock().get_mut(task_id) {
    f(task);
  }
}

pub fn push_log(state: &Arc<InnerState>, task_id: &str, line: String) {
  update_task(state, task_id, |t| {
    t.logs.push(line);
    if t.logs.len() > 400 {
      let keep_from = t.logs.len() - 400;
      t.logs = t.logs.split_off(keep_from);
    }
  });
}

pub fn set_task_message(state: &Arc<InnerState>, task_id: &str, status: &str, message: String) {
  update_task(state, task_id, |t| {
    t.status = status.to_string();
    t.message = Some(message.clone());
    t.ended_at = Some(chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string());
  });
  push_log(state, task_id, message);
}

#[tauri::command]
async fn list_builtin_collections(
  app: tauri::AppHandle,
  state: tauri::State<'_, AppRuntimeState>,
) -> Result<Vec<CollectionManifestMeta>, String> {
  let overlay = state.0.overlay_collections_dir.lock().clone();
  collections::list_collections(&app, overlay)
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct RefreshResult {
  manifest_count: usize,
  dir: String,
}

#[tauri::command]
async fn refresh_collections_from_dir(
  dir: String,
  state: tauri::State<'_, AppRuntimeState>,
) -> Result<RefreshResult, String> {
  let path = PathBuf::from(dir.trim());
  let count = collections::validate_collections_dir(&path)?;
  *state.0.overlay_collections_dir.lock() = Some(path.clone());
  Ok(RefreshResult {
    manifest_count: count,
    dir: path.to_string_lossy().to_string(),
  })
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct StartTaskResult {
  task_id: String,
}

#[tauri::command]
async fn start_download_task(
  app: tauri::AppHandle,
  state: tauri::State<'_, AppRuntimeState>,
  input: DownloadTaskInput,
) -> Result<StartTaskResult, String> {
  if input.selected_manifest_paths.is_empty() {
    return Err("selectedManifestPaths is empty".to_string());
  }

  let task_id = uuid::Uuid::new_v4().to_string();
  let task = TaskState::new(task_id.clone());
  let cancel_flag = Arc::new(AtomicBool::new(false));

  state.0.tasks.lock().insert(task_id.clone(), task);
  state
    .0
    .cancel_flags
    .lock()
    .insert(task_id.clone(), cancel_flag.clone());

  let state_arc = state.0.clone();
  let app_handle = app.clone();
  let task_id_for_run = task_id.clone();

  tauri::async_runtime::spawn(async move {
    downloader::run_task(app_handle, state_arc, task_id_for_run, input, cancel_flag).await;
  });

  Ok(StartTaskResult { task_id })
}

#[tauri::command]
async fn cancel_task(
  task_id: String,
  state: tauri::State<'_, AppRuntimeState>,
) -> Result<(), String> {
  let map = state.0.cancel_flags.lock();
  if let Some(flag) = map.get(&task_id) {
    flag.store(true, std::sync::atomic::Ordering::Relaxed);
    Ok(())
  } else {
    Err(format!("task not found: {}", task_id))
  }
}

#[tauri::command]
async fn get_task_state(
  task_id: String,
  state: tauri::State<'_, AppRuntimeState>,
) -> Result<Option<TaskState>, String> {
  Ok(state.0.tasks.lock().get(&task_id).cloned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(AppRuntimeState::default())
    .invoke_handler(tauri::generate_handler![
      list_builtin_collections,
      refresh_collections_from_dir,
      start_download_task,
      cancel_task,
      get_task_state
    ])
    .setup(|app| {
      let _ = app.get_webview_window("main");
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
