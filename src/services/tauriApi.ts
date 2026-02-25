import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import type {
  CollectionManifestMeta,
  DownloadTaskInput,
  TaskEvent,
  TaskState,
} from "../types";

export type StartTaskResult = {
  taskId: string;
};

function toSinglePath(value: string | string[] | null): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return null;
}

function ensureAdxExtension(path: string): string {
  if (/\.adx$/i.test(path)) {
    return path;
  }
  return `${path}.adx`;
}

export async function listBuiltinCollections(): Promise<CollectionManifestMeta[]> {
  return invoke<CollectionManifestMeta[]>("list_builtin_collections");
}

export async function refreshCollectionsFromDir(dir: string): Promise<void> {
  await invoke("refresh_collections_from_dir", { dir });
}

export async function startDownloadTask(
  input: DownloadTaskInput,
): Promise<StartTaskResult> {
  return invoke<StartTaskResult>("start_download_task", { input });
}

export async function cancelTask(taskId: string): Promise<void> {
  await invoke("cancel_task", { taskId });
}

export async function getTaskState(taskId: string): Promise<TaskState | null> {
  return invoke<TaskState | null>("get_task_state", { taskId });
}

export async function listenTaskEvent(
  cb: (event: TaskEvent) => void,
): Promise<() => void> {
  return listen<TaskEvent>("task_event", (evt) => cb(evt.payload));
}

export async function pickDirectory(
  defaultPath?: string,
): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    defaultPath: defaultPath?.trim() || undefined,
    title: "选择目录",
  });
  return toSinglePath(selected);
}

export async function pickBundleSavePath(
  defaultPath?: string,
): Promise<string | null> {
  const selected = await save({
    defaultPath: defaultPath?.trim() || undefined,
    title: "选择整合包输出路径",
    filters: [{ name: "ADX Package", extensions: ["adx"] }],
  });

  if (!selected) {
    return null;
  }

  return ensureAdxExtension(selected);
}
