use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use anyhow::{anyhow, Context, Result};
use chrono::Local;
use walkdir::WalkDir;
use zip::write::FileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

pub struct BundleSummary {
  pub output_path: String,
  pub source_file_count: usize,
  pub processed_count: usize,
  pub mp4_removed: usize,
  pub backup_dir: String,
}

fn ensure_parent(path: &Path) -> Result<()> {
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent).with_context(|| format!("create parent dir failed: {}", parent.display()))?;
  }
  Ok(())
}

pub fn build_bundle_from_files(
  source_files: &[PathBuf],
  output_path: &Path,
  backup_dir: Option<PathBuf>,
) -> Result<BundleSummary> {
  if source_files.is_empty() {
    return Err(anyhow!("no source files for bundling"));
  }

  ensure_parent(output_path)?;

  let ts = Local::now().format("%Y%m%d_%H%M%S").to_string();
  let default_backup = output_path
    .parent()
    .unwrap_or_else(|| Path::new("."))
    .join(format!("backup_original_adx_{}", ts));
  let backup_dir = backup_dir.unwrap_or(default_backup);
  fs::create_dir_all(&backup_dir)
    .with_context(|| format!("create backup dir failed: {}", backup_dir.display()))?;

  for src in source_files {
    if src.exists() {
      let dst = backup_dir.join(
        src.file_name()
          .ok_or_else(|| anyhow!("invalid source file name: {}", src.display()))?,
      );
      fs::copy(src, &dst).with_context(|| {
        format!(
          "copy backup failed: {} -> {}",
          src.display(),
          dst.display()
        )
      })?;
    }
  }

  let work_root = std::env::temp_dir().join(format!("niconico_bundle_{}", ts));
  let zip_copies = work_root.join("zip_copies");
  let extracted = work_root.join("extracted");
  fs::create_dir_all(&zip_copies)?;
  fs::create_dir_all(&extracted)?;

  let mut processed_count = 0usize;
  let mut mp4_removed = 0usize;

  for src in source_files {
    if !src.exists() {
      continue;
    }

    let stem = src
      .file_stem()
      .and_then(|s| s.to_str())
      .ok_or_else(|| anyhow!("invalid source stem: {}", src.display()))?;

    let zip_copy = zip_copies.join(format!("{}.zip", stem));
    fs::copy(src, &zip_copy).with_context(|| {
      format!(
        "copy source to zip failed: {} -> {}",
        src.display(),
        zip_copy.display()
      )
    })?;

    let extract_dir = extracted.join(stem);
    fs::create_dir_all(&extract_dir)?;

    let mut archive = ZipArchive::new(
      File::open(&zip_copy)
        .with_context(|| format!("open zip copy failed: {}", zip_copy.display()))?,
    )
    .with_context(|| format!("read zip archive failed: {}", zip_copy.display()))?;

    for i in 0..archive.len() {
      let mut entry = archive.by_index(i)?;
      let entry_name = entry.name().to_string();
      if entry_name.to_ascii_lowercase().ends_with(".mp4") {
        mp4_removed += 1;
        continue;
      }

      let enclosed = match entry.enclosed_name() {
        Some(path) => path.to_path_buf(),
        None => continue,
      };

      let out_path = extract_dir.join(enclosed);
      if entry.is_dir() {
        fs::create_dir_all(&out_path)?;
      } else {
        if let Some(parent) = out_path.parent() {
          fs::create_dir_all(parent)?;
        }
        let mut out_file = File::create(&out_path)?;
        std::io::copy(&mut entry, &mut out_file)?;
      }
    }

    processed_count += 1;
  }

  let zip_file = File::create(output_path)
    .with_context(|| format!("create output failed: {}", output_path.display()))?;
  let mut writer = ZipWriter::new(zip_file);
  let options = FileOptions::default().compression_method(CompressionMethod::Deflated);

  for entry in WalkDir::new(&extracted).into_iter().flatten() {
    if !entry.file_type().is_file() {
      continue;
    }

    let path = entry.path();
    let rel = path
      .strip_prefix(&extracted)
      .map_err(|e| anyhow!("strip prefix failed: {}", e))?;
    let rel_str = rel
      .to_string_lossy()
      .replace('\\', "/");

    writer
      .start_file(rel_str, options)
      .context("zip start_file failed")?;

    let mut input = File::open(path)?;
    let mut buf = Vec::new();
    input.read_to_end(&mut buf)?;
    writer.write_all(&buf)?;
  }

  writer.finish().context("zip finish failed")?;

  let _ = fs::remove_dir_all(&work_root);

  Ok(BundleSummary {
    output_path: output_path.to_string_lossy().to_string(),
    source_file_count: source_files.len(),
    processed_count,
    mp4_removed,
    backup_dir: backup_dir.to_string_lossy().to_string(),
  })
}
