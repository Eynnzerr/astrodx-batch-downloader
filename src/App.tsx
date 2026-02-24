import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  CollectionManifestMeta,
  DownloadTaskInput,
  TaskEvent,
  TaskState,
} from "./types";

function App() {
  const [collections, setCollections] = useState<CollectionManifestMeta[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [outputDir, setOutputDir] = useState("");
  const [connectSid, setConnectSid] = useState("");
  const [authMode, setAuthMode] = useState<"key" | "captcha">("key");
  const [key, setKey] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [downloadNoBga, setDownloadNoBga] = useState(false);
  const [outputFormat, setOutputFormat] = useState<"adx" | "zip">("adx");
  const [autoBundle, setAutoBundle] = useState(false);
  const [bundleOutputPath, setBundleOutputPath] = useState("");
  const [retries, setRetries] = useState(3);
  const [requestIntervalMs, setRequestIntervalMs] = useState(200);
  const [refreshDir, setRefreshDir] = useState("");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskState, setTaskState] = useState<TaskState | null>(null);
  const [uiLogs, setUiLogs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const selectedCount = selectedPaths.length;
  const totalSelectedIds = useMemo(() => {
    const set = new Set<string>();
    for (const item of collections) {
      if (selectedPaths.includes(item.path)) {
        set.add(item.path);
      }
    }
    return set.size;
  }, [collections, selectedPaths]);

  const appendLog = (line: string) => {
    setUiLogs((prev) => {
      const next = [...prev, line];
      if (next.length > 400) return next.slice(next.length - 400);
      return next;
    });
  };

  const loadCollections = async () => {
    const result = await invoke<CollectionManifestMeta[]>("list_builtin_collections");
    setCollections(result);
    const available = new Set(result.map((x) => x.path));
    setSelectedPaths((prev) => prev.filter((p) => available.has(p)));
  };

  useEffect(() => {
    loadCollections().catch((e) => appendLog(`加载 collections 失败: ${String(e)}`));
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    listen<TaskEvent>("task_event", (evt) => {
      const payload = evt.payload;
      if (!taskId || payload.taskId !== taskId) return;
      appendLog(payload.message);
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch((e) => appendLog(`监听任务事件失败: ${String(e)}`));

    return () => {
      if (unlisten) unlisten();
    };
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return;
    const timer = setInterval(() => {
      invoke<TaskState | null>("get_task_state", { taskId })
        .then((state) => {
          if (!state) return;
          setTaskState(state);
          if (["completed", "failed", "cancelled"].includes(state.status)) {
            setBusy(false);
          }
        })
        .catch((e) => appendLog(`轮询状态失败: ${String(e)}`));
    }, 900);

    return () => clearInterval(timer);
  }, [taskId]);

  const togglePath = (path: string) => {
    setSelectedPaths((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  const selectAll = () => setSelectedPaths(collections.map((c) => c.path));
  const clearAll = () => setSelectedPaths([]);

  const refreshCollections = async () => {
    if (!refreshDir.trim()) {
      appendLog("请先填写 refresh 目录路径");
      return;
    }
    await invoke("refresh_collections_from_dir", { dir: refreshDir.trim() });
    await loadCollections();
    appendLog(`已刷新 collections: ${refreshDir.trim()}`);
  };

  const startTask = async () => {
    if (busy) return;
    if (!selectedPaths.length) {
      appendLog("请至少勾选一个 manifest");
      return;
    }
    if (!outputDir.trim()) {
      appendLog("请填写输出目录");
      return;
    }
    if (!connectSid.trim()) {
      appendLog("请填写 connect.sid");
      return;
    }
    if (authMode === "key" && !key.trim()) {
      appendLog("authMode=key 时必须填写 key");
      return;
    }
    if (authMode === "captcha" && !captcha.trim()) {
      appendLog("authMode=captcha 时必须填写验证码");
      return;
    }

    const payload: DownloadTaskInput = {
      selectedManifestPaths: selectedPaths,
      outputDir: outputDir.trim(),
      connectSid: connectSid.trim(),
      authMode,
      key: authMode === "key" ? key.trim() : undefined,
      captcha: authMode === "captcha" ? captcha.trim() : undefined,
      downloadNoBga,
      outputFormat,
      autoBundle,
      bundleOutputPath: bundleOutputPath.trim() || undefined,
      retries,
      requestIntervalMs,
    };

    setBusy(true);
    setUiLogs([]);
    setTaskState(null);
    const result = await invoke<{ taskId: string }>("start_download_task", {
      input: payload,
    });
    setTaskId(result.taskId);
    appendLog(`任务已启动: ${result.taskId}`);
  };

  const cancelTask = async () => {
    if (!taskId) return;
    await invoke("cancel_task", { taskId });
    appendLog(`已请求取消任务: ${taskId}`);
  };

  return (
    <div className="page">
      <header>
        <h1>Niconico 批量下载 App</h1>
        <p>内置 collections 勾选下载，支持 no-BGA、格式切换、自动整合。</p>
      </header>

      <section className="panel">
        <div className="panel-title">Collections 清单</div>
        <div className="row">
          <button onClick={loadCollections}>重新加载内置清单</button>
          <input
            placeholder="外部 collections 目录路径（可选）"
            value={refreshDir}
            onChange={(e) => setRefreshDir(e.target.value)}
          />
          <button onClick={refreshCollections}>刷新为外部目录</button>
        </div>
        <div className="row">
          <button onClick={selectAll}>全选</button>
          <button onClick={clearAll}>清空</button>
          <span>已选清单: {selectedCount}</span>
          <span>（去重策略在后端执行）</span>
        </div>
        <div className="manifest-list">
          {collections.map((item) => (
            <label key={item.id} className="manifest-item">
              <input
                type="checkbox"
                checked={selectedPaths.includes(item.path)}
                onChange={() => togglePath(item.path)}
              />
              <span className="manifest-name">{item.name}</span>
              <span className="manifest-meta">
                {item.levelCount} 首 · {item.source}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">任务参数</div>
        <div className="grid">
          <label>
            输出目录
            <input value={outputDir} onChange={(e) => setOutputDir(e.target.value)} />
          </label>
          <label>
            connect.sid
            <input value={connectSid} onChange={(e) => setConnectSid(e.target.value)} />
          </label>
          <label>
            鉴权模式
            <select value={authMode} onChange={(e) => setAuthMode(e.target.value as "key" | "captcha")}>
              <option value="key">key</option>
              <option value="captcha">captcha</option>
            </select>
          </label>
          {authMode === "key" ? (
            <label>
              key
              <input value={key} onChange={(e) => setKey(e.target.value)} />
            </label>
          ) : (
            <label>
              验证码
              <input value={captcha} onChange={(e) => setCaptcha(e.target.value)} />
            </label>
          )}
          <label>
            下载格式
            <select
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value as "adx" | "zip")}
            >
              <option value="adx">.adx</option>
              <option value="zip">.zip</option>
            </select>
          </label>
          <label>
            重试次数
            <input
              type="number"
              min={1}
              max={10}
              value={retries}
              onChange={(e) => setRetries(Number(e.target.value) || 3)}
            />
          </label>
          <label>
            请求间隔(ms)
            <input
              type="number"
              min={0}
              max={5000}
              value={requestIntervalMs}
              onChange={(e) => setRequestIntervalMs(Number(e.target.value) || 200)}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={downloadNoBga}
              onChange={(e) => setDownloadNoBga(e.target.checked)}
            />
            下载不包含 BGA
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={autoBundle}
              onChange={(e) => setAutoBundle(e.target.checked)}
            />
            下载后自动整合为单 .adx
          </label>
          <label>
            整合输出路径（可选）
            <input
              disabled={!autoBundle}
              value={bundleOutputPath}
              onChange={(e) => setBundleOutputPath(e.target.value)}
            />
          </label>
        </div>

        <div className="row">
          <button disabled={busy} onClick={startTask}>
            {busy ? "任务进行中" : "开始下载"}
          </button>
          <button disabled={!taskId || !busy} onClick={cancelTask}>
            取消任务
          </button>
          <span>当前任务: {taskId ?? "无"}</span>
          <span>当前已选清单数: {totalSelectedIds}</span>
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">任务状态</div>
        {taskState ? (
          <div className="status-grid">
            <span>状态: {taskState.status}</span>
            <span>总数: {taskState.totalIds}</span>
            <span>已处理: {taskState.processedIds}</span>
            <span>成功: {taskState.okCount}</span>
            <span>跳过: {taskState.skipCount}</span>
            <span>失败: {taskState.failCount}</span>
            <span>新增文件: {taskState.newFilesCount}</span>
            <span>整合输出: {taskState.bundleOutputPath ?? "-"}</span>
          </div>
        ) : (
          <div>暂无任务状态</div>
        )}
        <pre className="log-box">{uiLogs.join("\n")}</pre>
      </section>
    </div>
  );
}

export default App;
