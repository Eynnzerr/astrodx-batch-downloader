import { useCallback, useEffect, useState } from "react";
import type { DownloadTaskInput, TaskState } from "../types";
import {
  cancelTask,
  getTaskState,
  listenTaskEvent,
  startDownloadTask,
} from "../services/tauriApi";

type UseTaskRunnerResult = {
  taskId: string | null;
  taskState: TaskState | null;
  logs: string[];
  busy: boolean;
  appendLog: (line: string) => void;
  clearLogs: () => void;
  runTask: (input: DownloadTaskInput) => Promise<void>;
  requestCancel: () => Promise<void>;
};

const FINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

export function useTaskRunner(): UseTaskRunnerResult {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskState, setTaskState] = useState<TaskState | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const appendLog = useCallback((line: string) => {
    setLogs((prev) => {
      const next = [...prev, line];
      return next.length > 400 ? next.slice(next.length - 400) : next;
    });
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  const runTask = useCallback(
    async (input: DownloadTaskInput) => {
      if (busy) {
        return;
      }

      setBusy(true);
      setTaskState(null);
      clearLogs();

      try {
        const result = await startDownloadTask(input);
        setTaskId(result.taskId);
        appendLog(`任务已启动: ${result.taskId}`);
      } catch (e) {
        setBusy(false);
        throw e;
      }
    },
    [appendLog, busy, clearLogs],
  );

  const requestCancel = useCallback(async () => {
    if (!taskId) {
      return;
    }
    await cancelTask(taskId);
    appendLog(`已请求取消任务: ${taskId}`);
  }, [appendLog, taskId]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    listenTaskEvent((payload) => {
      if (!taskId || payload.taskId !== taskId) {
        return;
      }
      appendLog(payload.message);
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch((e) => appendLog(`监听任务事件失败: ${String(e)}`));

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [appendLog, taskId]);

  useEffect(() => {
    if (!taskId) {
      return;
    }

    const timer = setInterval(() => {
      getTaskState(taskId)
        .then((state) => {
          if (!state) {
            return;
          }
          setTaskState(state);
          if (FINAL_STATUSES.has(state.status)) {
            setBusy(false);
          }
        })
        .catch((e) => appendLog(`轮询状态失败: ${String(e)}`));
    }, 900);

    return () => clearInterval(timer);
  }, [appendLog, taskId]);

  return {
    taskId,
    taskState,
    logs,
    busy,
    appendLog,
    clearLogs,
    runTask,
    requestCancel,
  };
}
