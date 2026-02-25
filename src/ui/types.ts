import type { DownloadTaskInput, TaskState } from "../types";

export type DownloadFormValues = {
  outputDir: string;
  connectSid: string;
  authMode: "key" | "captcha";
  key: string;
  captcha: string;
  outputFormat: "adx" | "zip";
  downloadNoBga: boolean;
  autoBundle: boolean;
  bundleOutputPath: string;
  retries: number;
  requestIntervalMs: number;
};

export type TaskStatusViewModel = {
  status: TaskState["status"];
  totalIds: number;
  processedIds: number;
  okCount: number;
  skipCount: number;
  failCount: number;
  newFilesCount: number;
  bundleOutputPath: string;
};

export function toDownloadInput(
  selectedManifestPaths: string[],
  values: DownloadFormValues,
): DownloadTaskInput {
  return {
    selectedManifestPaths,
    outputDir: values.outputDir.trim(),
    connectSid: values.connectSid.trim(),
    authMode: values.authMode,
    key: values.authMode === "key" ? values.key.trim() : undefined,
    captcha: values.authMode === "captcha" ? values.captcha.trim() : undefined,
    downloadNoBga: values.downloadNoBga,
    outputFormat: values.outputFormat,
    autoBundle: values.autoBundle,
    bundleOutputPath: values.bundleOutputPath.trim() || undefined,
    retries: values.retries,
    requestIntervalMs: values.requestIntervalMs,
  };
}

export function toTaskStatusViewModel(
  state: TaskState | null,
): TaskStatusViewModel | null {
  if (!state) {
    return null;
  }
  return {
    status: state.status,
    totalIds: state.totalIds,
    processedIds: state.processedIds,
    okCount: state.okCount,
    skipCount: state.skipCount,
    failCount: state.failCount,
    newFilesCount: state.newFilesCount,
    bundleOutputPath: state.bundleOutputPath ?? "-",
  };
}
