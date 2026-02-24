import { lazy, Suspense, useEffect } from "react";
import { Form, Row, Col, Space, message, Card, Skeleton } from "antd";
import { AppShell } from "./components/layout/AppShell";
import { TopHeader } from "./components/layout/TopHeader";
import { useCollections } from "./hooks/useCollections";
import { useTaskRunner } from "./hooks/useTaskRunner";
import { pickBundleSavePath, pickDirectory } from "./services/tauriApi";
import type { DownloadFormValues } from "./ui/types";
import { toDownloadInput, toTaskStatusViewModel } from "./ui/types";

const CollectionsPanel = lazy(() =>
  import("./components/collections/CollectionsPanel").then((mod) => ({
    default: mod.CollectionsPanel,
  })),
);

const TaskParamsForm = lazy(() =>
  import("./components/task/TaskParamsForm").then((mod) => ({
    default: mod.TaskParamsForm,
  })),
);

const TaskActionsBar = lazy(() =>
  import("./components/task/TaskActionsBar").then((mod) => ({
    default: mod.TaskActionsBar,
  })),
);

const TaskStatusPanel = lazy(() =>
  import("./components/task/TaskStatusPanel").then((mod) => ({
    default: mod.TaskStatusPanel,
  })),
);

const TaskLogPanel = lazy(() =>
  import("./components/task/TaskLogPanel").then((mod) => ({
    default: mod.TaskLogPanel,
  })),
);

const INITIAL_FORM_VALUES: DownloadFormValues = {
  outputDir: "",
  connectSid: "",
  authMode: "key",
  key: "",
  captcha: "",
  outputFormat: "adx",
  downloadNoBga: false,
  autoBundle: false,
  bundleOutputPath: "",
  retries: 3,
  requestIntervalMs: 1000,
};

type PanelLoadingProps = {
  rows?: number;
};

function PanelLoading({ rows = 4 }: PanelLoadingProps) {
  return (
    <Card className="panel-card">
      <Skeleton active paragraph={{ rows }} />
    </Card>
  );
}

function App() {
  const [form] = Form.useForm<DownloadFormValues>();
  const taskRunner = useTaskRunner();
  const collections = useCollections(taskRunner.appendLog);

  useEffect(() => {
    collections
      .loadCollections()
      .catch((e) => taskRunner.appendLog(`加载 collections 失败: ${String(e)}`));
  }, [collections.loadCollections, taskRunner.appendLog]);

  const statusVm = toTaskStatusViewModel(taskRunner.taskState);

  const handleBrowseRefreshDir = async () => {
    try {
      const picked = await pickDirectory(collections.refreshDir);
      if (picked) {
        collections.setRefreshDir(picked);
      }
    } catch (e) {
      const line = `打开目录选择器失败: ${String(e)}`;
      taskRunner.appendLog(line);
      message.error(line);
    }
  };

  const handleBrowseOutputDir = async () => {
    try {
      const current = form.getFieldValue("outputDir");
      const picked = await pickDirectory(current);
      if (picked) {
        form.setFieldsValue({ outputDir: picked });
      }
    } catch (e) {
      const line = `选择输出目录失败: ${String(e)}`;
      taskRunner.appendLog(line);
      message.error(line);
    }
  };

  const handleBrowseBundleOutputPath = async () => {
    try {
      const current = form.getFieldValue("bundleOutputPath");
      const picked = await pickBundleSavePath(current);
      if (picked) {
        form.setFieldsValue({ bundleOutputPath: picked });
      }
    } catch (e) {
      const line = `选择整合输出路径失败: ${String(e)}`;
      taskRunner.appendLog(line);
      message.error(line);
    }
  };

  const handleFinish = async (values: DownloadFormValues) => {
    if (!collections.selectedPaths.length) {
      taskRunner.appendLog("请至少勾选一个 manifest");
      message.warning("请至少勾选一个 manifest");
      return;
    }

    const payload = toDownloadInput(collections.selectedPaths, values);

    try {
      await taskRunner.runTask(payload);
    } catch (e) {
      const line = `启动任务失败: ${String(e)}`;
      taskRunner.appendLog(line);
      message.error(line);
    }
  };

  const handleStart = () => {
    void form.submit();
  };

  const handleCancel = () => {
    taskRunner.requestCancel().catch((e) => {
      const line = `取消任务失败: ${String(e)}`;
      taskRunner.appendLog(line);
      message.error(line);
    });
  };

  return (
    <AppShell header={<TopHeader />}>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Suspense fallback={<PanelLoading rows={6} />}>
          <CollectionsPanel
            collections={collections.collections}
            selectedPaths={collections.selectedPaths}
            selectedCount={collections.selectedCount}
            dedupSelectedCount={collections.dedupSelectedCount}
            loading={collections.loading}
            refreshDir={collections.refreshDir}
            onRefreshDirChange={collections.setRefreshDir}
            onBrowseRefreshDir={handleBrowseRefreshDir}
            onLoadCollections={collections.loadCollections}
            onRefreshFromDir={collections.refreshFromDir}
            onSelectAll={collections.selectAll}
            onClearAll={collections.clearAll}
            onTogglePath={collections.togglePath}
          />
        </Suspense>

        <Row gutter={[16, 16]} className="task-panels-row">
          <Col xs={24} xl={14} className="task-panel-col">
            <div className="task-panel-stack">
              <div className="task-top-slot">
                <Suspense fallback={<PanelLoading rows={6} />}>
                  <TaskParamsForm
                    form={form}
                    initialValues={INITIAL_FORM_VALUES}
                    busy={taskRunner.busy}
                    onBrowseOutputDir={handleBrowseOutputDir}
                    onBrowseBundleOutputPath={handleBrowseBundleOutputPath}
                    onFinish={(values) => {
                      void handleFinish(values);
                    }}
                  />
                </Suspense>
              </div>

              <div className="task-bottom-slot">
                <Suspense fallback={<PanelLoading rows={2} />}>
                  <TaskActionsBar
                    busy={taskRunner.busy}
                    taskId={taskRunner.taskId}
                    selectedCount={collections.dedupSelectedCount}
                    onStart={handleStart}
                    onCancel={handleCancel}
                  />
                </Suspense>
              </div>
            </div>
          </Col>

          <Col xs={24} xl={10} className="task-panel-col">
            <div className="task-panel-stack task-panel-stack--stretch">
              <div className="task-top-slot">
                <Suspense fallback={<PanelLoading rows={4} />}>
                  <TaskStatusPanel status={statusVm} />
                </Suspense>
              </div>

              <div className="task-bottom-slot">
                <Suspense fallback={<PanelLoading rows={8} />}>
                  <TaskLogPanel logs={taskRunner.logs} onClear={taskRunner.clearLogs} />
                </Suspense>
              </div>
            </div>
          </Col>
        </Row>
      </Space>
    </AppShell>
  );
}

export default App;
