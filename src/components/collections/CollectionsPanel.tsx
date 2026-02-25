import { FolderOpenOutlined } from "@ant-design/icons";
import { Button, Card, Input, Space, Typography } from "antd";
import type { CollectionManifestMeta } from "../../types";
import { ManifestTable } from "./ManifestTable";

type CollectionsPanelProps = {
  collections: CollectionManifestMeta[];
  selectedPaths: string[];
  selectedCount: number;
  dedupSelectedCount: number;
  loading: boolean;
  refreshDir: string;
  onRefreshDirChange: (value: string) => void;
  onBrowseRefreshDir: () => Promise<void>;
  onLoadCollections: () => Promise<void>;
  onRefreshFromDir: () => Promise<void>;
  onSelectAll: () => void;
  onClearAll: () => void;
  onTogglePath: (path: string) => void;
};

export function CollectionsPanel({
  collections,
  selectedPaths,
  selectedCount,
  dedupSelectedCount,
  loading,
  refreshDir,
  onRefreshDirChange,
  onBrowseRefreshDir,
  onLoadCollections,
  onRefreshFromDir,
  onSelectAll,
  onClearAll,
  onTogglePath,
}: CollectionsPanelProps) {
  return (
    <Card
      title="Collections 清单"
      className="panel-card"
      extra={<Typography.Text type="secondary">共 {collections.length} 个</Typography.Text>}
    >
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <Space.Compact style={{ width: "100%" }} block>
          <Button onClick={() => void onLoadCollections()} loading={loading}>
            重新加载内置清单
          </Button>
          <Input
            placeholder="外部 collections 目录路径（可选）"
            value={refreshDir}
            onChange={(e) => onRefreshDirChange(e.target.value)}
          />
          <Button icon={<FolderOpenOutlined />} onClick={() => void onBrowseRefreshDir()}>
            浏览
          </Button>
          <Button onClick={() => void onRefreshFromDir()} loading={loading}>
            刷新为外部目录
          </Button>
        </Space.Compact>

        <Space wrap>
          <Button onClick={onSelectAll}>全选</Button>
          <Button onClick={onClearAll}>清空</Button>
          <Typography.Text>已选清单: {selectedCount}</Typography.Text>
          <Typography.Text type="secondary">当前已选清单数: {dedupSelectedCount}</Typography.Text>
          <Typography.Text type="secondary">去重策略在后端执行</Typography.Text>
        </Space>

        <ManifestTable
          collections={collections}
          selectedPaths={selectedPaths}
          loading={loading}
          onTogglePath={onTogglePath}
        />
      </Space>
    </Card>
  );
}
