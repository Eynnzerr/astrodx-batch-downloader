import { Button, Card, Space, Tag, Typography } from "antd";

type TaskActionsBarProps = {
  busy: boolean;
  taskId: string | null;
  selectedCount: number;
  onStart: () => void;
  onCancel: () => void;
};

export function TaskActionsBar({
  busy,
  taskId,
  selectedCount,
  onStart,
  onCancel,
}: TaskActionsBarProps) {
  return (
    <Card className="panel-card">
      <Space wrap size={12}>
        <Button type="primary" size="large" onClick={onStart} loading={busy}>
          {busy ? "任务进行中" : "开始下载"}
        </Button>
        <Button danger size="large" disabled={!taskId || !busy} onClick={onCancel}>
          取消任务
        </Button>
        <Typography.Text>当前任务:</Typography.Text>
        <Tag color={taskId ? "processing" : "default"}>{taskId ?? "无"}</Tag>
        <Typography.Text type="secondary">当前已选清单数: {selectedCount}</Typography.Text>
      </Space>
    </Card>
  );
}
