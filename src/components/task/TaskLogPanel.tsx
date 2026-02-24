import { useEffect, useRef } from "react";
import { Button, Card, List, Space, Typography } from "antd";

type TaskLogPanelProps = {
  logs: string[];
  onClear: () => void;
};

export function TaskLogPanel({ logs, onClear }: TaskLogPanelProps) {
  const logViewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = logViewportRef.current;
    if (!el) {
      return;
    }
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [logs.length]);

  return (
    <Card
      title="任务日志"
      className="panel-card log-panel-card"
      extra={
        <Space>
          <Typography.Text type="secondary">{logs.length} 行</Typography.Text>
          <Button onClick={onClear}>清空日志</Button>
        </Space>
      }
    >
      <div className="log-box" ref={logViewportRef}>
        {logs.length === 0 ? (
          <div className="log-empty">
            <Typography.Text type="secondary">暂无日志</Typography.Text>
          </div>
        ) : (
          <List
            className="log-list"
            split={false}
            dataSource={logs}
            renderItem={(line, idx) => (
              <List.Item className="log-line">
                <span className="log-index">{String(idx + 1).padStart(3, "0")}</span>
                <span className="log-text">{line}</span>
              </List.Item>
            )}
          />
        )}
      </div>
    </Card>
  );
}
