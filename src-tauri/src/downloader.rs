use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::{
  atomic::{AtomicBool, Ordering},
  Arc,
};

use anyhow::{anyhow, Context, Result};
use chrono::Local;
use futures_util::StreamExt;
use reqwest::Client;
use serde::Deserialize;
use tauri::{AppHandle, Emitter};
use tokio::fs;
use tokio::io::AsyncWriteExt;
use tokio::time::{sleep, Duration};

use crate::bundler;
use crate::collections;
use crate::models::{DownloadTaskInput, FailItem, TaskEvent};
use crate::{push_log, set_task_message, update_task, InnerState};

const API_BASE: &str = "https://api.milkbot.cn/server/api";

#[derive(Debug, Deserialize)]
struct VerifyResp {
  success: bool,
  key: Option<String>,
  message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct LinkResp {
  success: bool,
  url: Option<String>,
  message: Option<String>,
}

fn now_str() -> String {
  Local::now().format("%Y-%m-%d %H:%M:%S").to_string()
}

fn truncate_for_log(input: &str, max_chars: usize) -> String {
  let chars: Vec<char> = input.chars().collect();
  if chars.len() <= max_chars {
    return input.to_string();
  }
  let keep = max_chars.saturating_sub(3);
  let mut out = chars.into_iter().take(keep).collect::<String>();
  out.push_str("...");
  out
}

fn mask_secret(input: &str) -> String {
  let chars: Vec<char> = input.chars().collect();
  let len = chars.len();
  if len == 0 {
    return "<empty>".to_string();
  }
  if len <= 8 {
    return format!("len={} [{}]", len, "*".repeat(len));
  }
  let head = chars.iter().take(4).collect::<String>();
  let tail = chars.iter().skip(len - 4).collect::<String>();
  format!("len={} {}****{}", len, head, tail)
}

fn sanitize_id_for_filename(id: &str) -> String {
  let mut normalized = String::with_capacity(id.len());
  for ch in id.chars() {
    let invalid = ch.is_control() || matches!(ch, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*');
    normalized.push(if invalid { '_' } else { ch });
  }

  let mut cleaned = normalized.trim_matches(|c: char| c == ' ' || c == '.').to_string();
  if cleaned.is_empty() {
    cleaned = "unknown".to_string();
  }

  let stem_upper = cleaned
    .split('.')
    .next()
    .unwrap_or_default()
    .to_ascii_uppercase();
  let is_reserved = matches!(stem_upper.as_str(), "CON" | "PRN" | "AUX" | "NUL")
    || (stem_upper.len() == 4
      && (stem_upper.starts_with("COM") || stem_upper.starts_with("LPT"))
      && stem_upper[3..].chars().all(|c| ('1'..='9').contains(&c)));

  if is_reserved {
    cleaned.push_str("_file");
  }

  cleaned
}

fn emit_event(app: &AppHandle, task_id: &str, level: &str, event: &str, message: String, status: Option<String>) {
  let payload = TaskEvent {
    task_id: task_id.to_string(),
    level: level.to_string(),
    event: event.to_string(),
    message,
    status,
  };
  let _ = app.emit("task_event", payload);
}

async fn verify_key(client: &Client, connect_sid: &str, code: &str) -> Result<String> {
  let resp = client
    .post(format!("{}/verify_captcha", API_BASE))
    .header("Content-Type", "application/json")
    .header("Cookie", format!("connect.sid={}", connect_sid))
    .json(&serde_json::json!({ "code": code }))
    .send()
    .await
    .context("verify_captcha request failed")?;

  let status = resp.status();
  let body = resp.text().await.context("verify_captcha read body failed")?;
  let data: VerifyResp = serde_json::from_str(&body).with_context(|| {
    format!(
      "verify_captcha parse failed (status={}, body={})",
      status,
      truncate_for_log(&body, 300)
    )
  })?;

  if !status.is_success() {
    return Err(anyhow!(
      "verify_captcha http {}: {}",
      status,
      data
        .message
        .unwrap_or_else(|| truncate_for_log(&body, 200))
    ));
  }

  if data.success {
    data.key.ok_or_else(|| anyhow!("verify_captcha success but key is empty"))
  } else {
    Err(anyhow!(
      "verify_captcha failed: {}",
      data.message.unwrap_or_else(|| "unknown".to_string())
    ))
  }
}

async fn get_download_link(
  client: &Client,
  connect_sid: &str,
  key: &str,
  id: &str,
  kind: &str,
) -> Result<String> {
  let resp = client
    .get(format!("{}/get_download_link", API_BASE))
    .header("Cookie", format!("connect.sid={}", connect_sid))
    .query(&[("id", id), ("key", key), ("type", kind)])
    .send()
    .await
    .context("get_download_link request failed")?;

  let status = resp.status();
  let body = resp.text().await.context("get_download_link read body failed")?;
  let data: LinkResp = serde_json::from_str(&body).with_context(|| {
    format!(
      "get_download_link parse failed (status={}, body={})",
      status,
      truncate_for_log(&body, 300)
    )
  })?;

  if !status.is_success() {
    return Err(anyhow!(
      "get_download_link http {} for {}: {}",
      status,
      id,
      data
        .message
        .unwrap_or_else(|| truncate_for_log(&body, 200))
    ));
  }

  if data.success {
    data.url.ok_or_else(|| anyhow!("get_download_link success but url is empty"))
  } else {
    Err(anyhow!(
      "get_download_link failed for {}: {}",
      id,
      data.message.unwrap_or_else(|| "unknown".to_string())
    ))
  }
}

async fn download_file(client: &Client, url: &str, out_path: &PathBuf) -> Result<()> {
  if let Some(parent) = out_path.parent() {
    fs::create_dir_all(parent).await?;
  }

  let tmp = out_path.with_extension(format!(
    "{}.part",
    out_path.extension().and_then(|e| e.to_str()).unwrap_or("tmp")
  ));

  let resp = client
    .get(url)
    .send()
    .await
    .with_context(|| format!("download request failed: {}", url))?;

  if !resp.status().is_success() {
    return Err(anyhow!("download response status: {}", resp.status()));
  }

  let mut file = fs::File::create(&tmp).await?;
  let mut stream = resp.bytes_stream();
  while let Some(chunk) = stream.next().await {
    let bytes = chunk?;
    file.write_all(&bytes).await?;
  }
  file.flush().await?;
  fs::rename(&tmp, out_path).await?;

  Ok(())
}

async fn with_retry<T, F, Fut>(retries: u32, interval_ms: u64, mut f: F) -> Result<T>
where
  F: FnMut(u32) -> Fut,
  Fut: std::future::Future<Output = Result<T>>,
{
  let mut last_err: Option<anyhow::Error> = None;
  for attempt in 1..=retries {
    match f(attempt).await {
      Ok(v) => return Ok(v),
      Err(e) => {
        last_err = Some(e);
        if attempt < retries {
          let backoff = interval_ms.saturating_mul(attempt as u64).max(50);
          sleep(Duration::from_millis(backoff)).await;
        }
      }
    }
  }
  Err(last_err.unwrap_or_else(|| anyhow!("retry exhausted")))
}

fn merge_ids_from_manifests(paths: &[String]) -> Result<Vec<String>> {
  let mut set = HashSet::new();
  let mut out = Vec::new();

  for p in paths {
    let path = PathBuf::from(p);
    let manifest = collections::parse_manifest_file(&path).map_err(|e| anyhow!(e))?;
    for id in manifest.level_ids {
      if set.insert(id.clone()) {
        out.push(id);
      }
    }
  }

  out.sort();
  Ok(out)
}

pub async fn run_task(
  app: AppHandle,
  state: Arc<InnerState>,
  task_id: String,
  input: DownloadTaskInput,
  cancel_flag: Arc<AtomicBool>,
) {
  let retries = input.retries.unwrap_or(3).max(1);
  let interval_ms = input.request_interval_ms.unwrap_or(1000);

  update_task(&state, &task_id, |t| {
    t.status = "running".to_string();
    t.started_at = Some(now_str());
    t.message = Some("任务启动".to_string());
  });
  emit_event(&app, &task_id, "info", "start", format!("任务启动: {}", task_id), Some("running".to_string()));

  let client = Client::builder().build();
  let client = match client {
    Ok(c) => c,
    Err(e) => {
      set_task_message(&state, &task_id, "failed", format!("HTTP 客户端初始化失败: {}", e));
      emit_event(&app, &task_id, "error", "fatal", format!("HTTP 客户端初始化失败: {}", e), Some("failed".to_string()));
      return;
    }
  };

  let merged_ids = match merge_ids_from_manifests(&input.selected_manifest_paths) {
    Ok(v) => v,
    Err(e) => {
      set_task_message(&state, &task_id, "failed", format!("读取 manifest 失败: {}", e));
      emit_event(&app, &task_id, "error", "fatal", format!("读取 manifest 失败: {}", e), Some("failed".to_string()));
      return;
    }
  };

  update_task(&state, &task_id, |t| {
    t.total_ids = merged_ids.len();
    t.message = Some(format!("合并后待下载 ID 数: {}", merged_ids.len()));
  });

  if merged_ids.is_empty() {
    set_task_message(&state, &task_id, "failed", "没有可下载的 ID".to_string());
    emit_event(&app, &task_id, "error", "fatal", "没有可下载的 ID".to_string(), Some("failed".to_string()));
    return;
  }

  let key = if input.auth_mode == "key" {
    match input.key.clone() {
      Some(k) if !k.trim().is_empty() => k,
      _ => {
        set_task_message(&state, &task_id, "failed", "auth_mode=key 但 key 为空".to_string());
        emit_event(&app, &task_id, "error", "fatal", "auth_mode=key 但 key 为空".to_string(), Some("failed".to_string()));
        return;
      }
    }
  } else {
    let code = match input.captcha.clone() {
      Some(c) if !c.trim().is_empty() => c,
      _ => {
        set_task_message(&state, &task_id, "failed", "auth_mode=captcha 但验证码为空".to_string());
        emit_event(&app, &task_id, "error", "fatal", "auth_mode=captcha 但验证码为空".to_string(), Some("failed".to_string()));
        return;
      }
    };

    match verify_key(&client, &input.connect_sid, &code).await {
      Ok(k) => {
        emit_event(&app, &task_id, "info", "auth", "验证码校验成功，已获取 key".to_string(), Some("running".to_string()));
        k
      }
      Err(e) => {
        set_task_message(&state, &task_id, "failed", format!("验证码校验失败: {}", e));
        emit_event(&app, &task_id, "error", "fatal", format!("验证码校验失败: {}", e), Some("failed".to_string()));
        return;
      }
    }
  };

  let output_dir = PathBuf::from(input.output_dir.clone());
  if let Err(e) = fs::create_dir_all(&output_dir).await {
    set_task_message(&state, &task_id, "failed", format!("输出目录不可写: {}", e));
    emit_event(&app, &task_id, "error", "fatal", format!("输出目录不可写: {}", e), Some("failed".to_string()));
    return;
  }

  let kind = if input.download_no_bga { "nobga" } else { "bga" };
  let ext = if input.output_format.to_ascii_lowercase() == "zip" {
    "zip"
  } else {
    "adx"
  };

  push_log(
    &state,
    &task_id,
    format!(
      "任务参数: auth_mode={}, connect.sid={}, key={}, type={}, format={}, retries={}, interval_ms={}, output_dir={}",
      input.auth_mode,
      mask_secret(&input.connect_sid),
      mask_secret(&key),
      kind,
      ext,
      retries,
      interval_ms,
      input.output_dir
    ),
  );

  let mut new_files: Vec<PathBuf> = Vec::new();

  for id in merged_ids {
    if cancel_flag.load(Ordering::Relaxed) {
      set_task_message(&state, &task_id, "cancelled", "任务已取消".to_string());
      emit_event(&app, &task_id, "warn", "cancelled", "任务已取消".to_string(), Some("cancelled".to_string()));
      return;
    }

    let safe_id = sanitize_id_for_filename(&id);
    let out_path = output_dir.join(format!("{}.{}", safe_id, ext));

    let processed_delta = 1usize;
    if let Ok(meta) = fs::metadata(&out_path).await {
      if meta.len() > 0 {
        update_task(&state, &task_id, |t| {
          t.skip_count += 1;
          t.processed_ids += processed_delta;
        });
        let line = format!("SKIP {}", id);
        push_log(&state, &task_id, line.clone());
        emit_event(&app, &task_id, "info", "skip", line, Some("running".to_string()));
        sleep(Duration::from_millis(interval_ms)).await;
        continue;
      }
    }

    let link_result = with_retry(retries, interval_ms, |_: u32| {
      let client = client.clone();
      let sid = input.connect_sid.clone();
      let key = key.clone();
      let id = id.clone();
      async move { get_download_link(&client, &sid, &key, &id, kind).await }
    })
    .await;

    let url = match link_result {
      Ok(v) => v,
      Err(e) => {
        let reason = truncate_for_log(&e.to_string(), 280);
        update_task(&state, &task_id, |t| {
          t.fail_count += 1;
          t.processed_ids += processed_delta;
          t.fail_items.push(FailItem {
            id: id.clone(),
            reason: format!("link_fail: {}", reason),
          });
        });
        let line = format!("FAIL {}: 获取下载链接失败 | {}", id, reason);
        push_log(&state, &task_id, line.clone());
        emit_event(&app, &task_id, "error", "fail", line, Some("running".to_string()));
        sleep(Duration::from_millis(interval_ms)).await;
        continue;
      }
    };

    let download_result = with_retry(retries, interval_ms, |_: u32| {
      let client = client.clone();
      let out = out_path.clone();
      let url = url.clone();
      async move { download_file(&client, &url, &out).await }
    })
    .await;

    match download_result {
      Ok(_) => {
        new_files.push(out_path.clone());
        update_task(&state, &task_id, |t| {
          t.ok_count += 1;
          t.new_files_count += 1;
          t.processed_ids += processed_delta;
        });
        let line = format!("OK {}", id);
        push_log(&state, &task_id, line.clone());
        emit_event(&app, &task_id, "info", "ok", line, Some("running".to_string()));
      }
      Err(e) => {
        let reason = truncate_for_log(&e.to_string(), 280);
        update_task(&state, &task_id, |t| {
          t.fail_count += 1;
          t.processed_ids += processed_delta;
          t.fail_items.push(FailItem {
            id: id.clone(),
            reason: format!("download_fail: {}", reason),
          });
        });
        let line = format!("FAIL {}: 下载失败 | {}", id, reason);
        push_log(&state, &task_id, line.clone());
        emit_event(&app, &task_id, "error", "fail", line, Some("running".to_string()));
      }
    }

    sleep(Duration::from_millis(interval_ms)).await;
  }

  if input.auto_bundle {
    if new_files.is_empty() {
      let line = "自动整合已跳过: 本次无新增下载文件".to_string();
      push_log(&state, &task_id, line.clone());
      emit_event(&app, &task_id, "info", "bundle_skip", line, Some("running".to_string()));
    } else {
      let output = input.bundle_output_path.clone().unwrap_or_else(|| {
        output_dir
          .join(format!("bundle_merged_{}.adx", Local::now().format("%Y%m%d_%H%M%S")))
          .to_string_lossy()
          .to_string()
      });

      let output_path = PathBuf::from(output.clone());
      emit_event(
        &app,
        &task_id,
        "info",
        "bundle_start",
        "开始自动整合（仅本次新下载文件）".to_string(),
        Some("running".to_string()),
      );

      let bundle_result = tauri::async_runtime::spawn_blocking(move || {
        bundler::build_bundle_from_files(&new_files, &output_path)
      })
      .await;

      match bundle_result {
        Ok(Ok(summary)) => {
          update_task(&state, &task_id, |t| {
            t.bundle_output_path = Some(summary.output_path.clone());
          });
          let line = format!(
            "自动整合完成: {}（源文件 {}，处理 {}）",
            summary.output_path, summary.source_file_count, summary.processed_count
          );
          push_log(&state, &task_id, line.clone());
          emit_event(&app, &task_id, "info", "bundle_done", line, Some("running".to_string()));
        }
        Ok(Err(e)) => {
          set_task_message(&state, &task_id, "failed", format!("自动整合失败: {}", e));
          emit_event(
            &app,
            &task_id,
            "error",
            "fatal",
            format!("自动整合失败: {}", e),
            Some("failed".to_string()),
          );
          return;
        }
        Err(e) => {
          set_task_message(&state, &task_id, "failed", format!("自动整合任务异常: {}", e));
          emit_event(
            &app,
            &task_id,
            "error",
            "fatal",
            format!("自动整合任务异常: {}", e),
            Some("failed".to_string()),
          );
          return;
        }
      }
    }
  }

  update_task(&state, &task_id, |t| {
    t.status = "completed".to_string();
    t.ended_at = Some(now_str());
    t.message = Some("任务完成".to_string());
  });

  emit_event(
    &app,
    &task_id,
    "info",
    "done",
    "下载任务完成".to_string(),
    Some("completed".to_string()),
  );
}
