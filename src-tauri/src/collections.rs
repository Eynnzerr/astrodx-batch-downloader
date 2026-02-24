use std::collections::HashMap;
use std::fs::File;
use std::path::{Path, PathBuf};

use serde::Deserialize;
use serde_json::Value;
use tauri::{AppHandle, Manager};
use walkdir::WalkDir;

use crate::models::{CollectionManifestMeta, ParsedManifest};

#[derive(Debug, Deserialize)]
struct RawManifest {
  name: Option<String>,
  #[serde(rename = "levelIds")]
  level_ids: Option<Vec<Value>>,
}

fn normalize_level_id(v: &Value) -> Option<String> {
  if let Some(s) = v.as_str() {
    return Some(s.to_string());
  }
  if let Some(i) = v.as_i64() {
    return Some(i.to_string());
  }
  if let Some(u) = v.as_u64() {
    return Some(u.to_string());
  }
  if let Some(f) = v.as_f64() {
    if (f.fract() - 0.0).abs() < f64::EPSILON {
      return Some((f as i64).to_string());
    }
  }
  None
}

pub fn parse_manifest_file(path: &Path) -> Result<ParsedManifest, String> {
  let file = File::open(path).map_err(|e| format!("open manifest failed {}: {}", path.display(), e))?;
  let raw: RawManifest =
    serde_json::from_reader(file).map_err(|e| format!("parse manifest failed {}: {}", path.display(), e))?;

  let level_ids_raw = raw
    .level_ids
    .ok_or_else(|| format!("manifest missing levelIds: {}", path.display()))?;

  let mut level_ids = Vec::with_capacity(level_ids_raw.len());
  for v in &level_ids_raw {
    if let Some(id) = normalize_level_id(v) {
      level_ids.push(id);
    }
  }

  if level_ids.is_empty() {
    return Err(format!("manifest has empty levelIds: {}", path.display()));
  }

  let default_name = path
    .parent()
    .and_then(|p| p.file_name())
    .and_then(|s| s.to_str())
    .unwrap_or("Unnamed")
    .to_string();

  Ok(ParsedManifest {
    name: raw.name.unwrap_or(default_name),
    level_ids,
  })
}

fn collect_manifest_files(root: &Path) -> Vec<PathBuf> {
  let mut files = Vec::new();
  for e in WalkDir::new(root).into_iter().flatten() {
    if e.file_type().is_file() && e.file_name() == "manifest.json" {
      files.push(e.into_path());
    }
  }
  files.sort();
  files
}

fn resolve_builtin_collections_dir(app: &AppHandle) -> Option<PathBuf> {
  if let Ok(dir) = std::env::var("NICONICO_COLLECTIONS_DIR") {
    let p = PathBuf::from(dir);
    if p.exists() {
      return Some(p);
    }
  }

  if let Ok(cwd) = std::env::current_dir() {
    let p = cwd.join("collections");
    if p.exists() {
      return Some(p);
    }
  }

  if let Ok(resource) = app.path().resource_dir() {
    let p = resource.join("collections");
    if p.exists() {
      return Some(p);
    }
  }

  None
}

fn collect_from_source(root: &Path, source: &str) -> Result<Vec<CollectionManifestMeta>, String> {
  let mut out = Vec::new();
  for path in collect_manifest_files(root) {
    let parsed = parse_manifest_file(&path)?;
    let rel = path
      .strip_prefix(root)
      .ok()
      .and_then(|p| p.to_str().map(|s| s.replace('\\', "/")))
      .unwrap_or_else(|| path.to_string_lossy().to_string());

    out.push(CollectionManifestMeta {
      id: format!("{}:{}", source, rel),
      name: parsed.name,
      path: path.to_string_lossy().to_string(),
      relative_path: rel,
      level_count: parsed.level_ids.len(),
      source: source.to_string(),
    });
  }
  Ok(out)
}

pub fn list_collections(
  app: &AppHandle,
  overlay: Option<PathBuf>,
) -> Result<Vec<CollectionManifestMeta>, String> {
  let builtin_root =
    resolve_builtin_collections_dir(app).ok_or_else(|| "cannot find builtin collections directory".to_string())?;

  let mut merged: HashMap<String, CollectionManifestMeta> = HashMap::new();

  for item in collect_from_source(&builtin_root, "builtin")? {
    merged.insert(item.relative_path.clone(), item);
  }

  if let Some(overlay_root) = overlay {
    if overlay_root.exists() {
      for item in collect_from_source(&overlay_root, "overlay")? {
        merged.insert(item.relative_path.clone(), item);
      }
    }
  }

  let mut values: Vec<_> = merged.into_values().collect();
  values.sort_by(|a, b| a.name.cmp(&b.name));
  Ok(values)
}

pub fn validate_collections_dir(dir: &Path) -> Result<usize, String> {
  if !dir.exists() {
    return Err(format!("directory not found: {}", dir.display()));
  }
  let count = collect_manifest_files(dir).len();
  if count == 0 {
    return Err(format!("no manifest.json found in: {}", dir.display()));
  }
  Ok(count)
}
