import { Card, Col, Empty, Row, Statistic, Tag, Typography } from "antd";
import type { TaskStatusViewModel } from "../../ui/types";

type TaskStatusPanelProps = {
  status: TaskStatusViewModel | null;
};

function statusColor(status: TaskStatusViewModel["status"]): string {
  switch (status) {
    case "completed":
      return "success";
    case "failed":
      return "error";
    case "cancelled":
      return "warning";
    case "running":
      return "processing";
    default:
      return "default";
  }
}

export function TaskStatusPanel({ status }: TaskStatusPanelProps) {
  return (
    <Card
      title="任务状态"
      className="panel-card"
      extra={
        status ? (
          <Tag color={statusColor(status.status)}>{status.status}</Tag>
        ) : undefined
      }
    >
      {!status ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无任务状态" />
      ) : (
        <>
          <Row gutter={[12, 12]}>
            <Col xs={12} md={6}>
              <Statistic title="总数" value={status.totalIds} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="已处理" value={status.processedIds} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="成功" value={status.okCount} valueStyle={{ color: "#3f8600" }} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="跳过" value={status.skipCount} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="失败" value={status.failCount} valueStyle={{ color: "#cf1322" }} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="新增文件" value={status.newFilesCount} />
            </Col>
          </Row>
          <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
            整合输出: {status.bundleOutputPath}
          </Typography.Paragraph>
        </>
      )}
    </Card>
  );
}
