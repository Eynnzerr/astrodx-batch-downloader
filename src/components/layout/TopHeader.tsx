import { Space, Typography } from "antd";

export function TopHeader() {
  return (
    <Space direction="vertical" size={4} className="top-header">
      <Typography.Title level={3} style={{ margin: 0 }}>
        AstroDX谱面批量下载工具
      </Typography.Title>
      <Typography.Text type="secondary">
        内置 collections 勾选下载，支持 no-BGA、格式切换、自动整合。
      </Typography.Text>
    </Space>
  );
}
