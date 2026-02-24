export type CollectionManifestMeta = {
  id: string;
  name: string;
  path: string;
  relativePath: string;
  levelCount: number;
  source: "builtin" | "overlay";
};

export type DownloadTaskInput = {
  selectedManifestPaths: string[];
  outputDir: string;
  connectSid: string;
  authMode: "key" | "captcha";
  key?: string;
  captcha?: string;
  downloadNoBga: boolean;
  outputFormat: "adx" | "zip";
  autoBundle: boolean;
  bundleOutputPath?: string;
  retries?: number;
  requestIntervalMs?: number;
};

export type FailItem = {
  id: string;
  reason: string;
};

export type TaskState = {
  taskId: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  totalIds: number;
  processedIds: number;
  okCount: number;
  skipCount: number;
  failCount: number;
  newFilesCount: number;
  bundleOutputPath?: string;
  failItems: FailItem[];
  logs: string[];
  startedAt?: string;
  endedAt?: string;
  message?: string;
};

export type TaskEvent = {
  taskId: string;
  level: "info" | "warn" | "error";
  event: string;
  message: string;
  status?: TaskState["status"];
};
