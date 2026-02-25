import { Table, Tag, Typography } from "antd";
import type { ColumnsType, TableRowSelection } from "antd/es/table/interface";
import type { CollectionManifestMeta } from "../../types";

type ManifestTableProps = {
  collections: CollectionManifestMeta[];
  selectedPaths: string[];
  loading: boolean;
  onTogglePath: (path: string) => void;
};

export function ManifestTable({
  collections,
  selectedPaths,
  loading,
  onTogglePath,
}: ManifestTableProps) {
  const columns: ColumnsType<CollectionManifestMeta> = [
    {
      title: "清单名称",
      dataIndex: "name",
      key: "name",
      render: (value: string) => <Typography.Text strong>{value}</Typography.Text>,
    },
    {
      title: "谱面数",
      dataIndex: "levelCount",
      key: "levelCount",
      width: 110,
      align: "right",
    },
    {
      title: "来源",
      dataIndex: "source",
      key: "source",
      width: 120,
      render: (value: CollectionManifestMeta["source"]) =>
        value === "builtin" ? <Tag color="blue">builtin</Tag> : <Tag color="gold">overlay</Tag>,
    },
    {
      title: "路径",
      dataIndex: "relativePath",
      key: "relativePath",
      ellipsis: true,
      render: (value: string) => <Typography.Text type="secondary">{value}</Typography.Text>,
    },
  ];

  const rowSelection: TableRowSelection<CollectionManifestMeta> = {
    selectedRowKeys: selectedPaths,
    onSelect: (record, selected) => {
      const exists = selectedPaths.includes(record.path);
      if ((selected && !exists) || (!selected && exists)) {
        onTogglePath(record.path);
      }
    },
    onSelectAll: (selected, _rows, changeRows) => {
      for (const row of changeRows) {
        const exists = selectedPaths.includes(row.path);
        if ((selected && !exists) || (!selected && exists)) {
          onTogglePath(row.path);
        }
      }
    },
    getCheckboxProps: (record) => ({
      name: record.name,
    }),
  };

  return (
    <Table<CollectionManifestMeta>
      rowKey={(item) => item.path}
      columns={columns}
      dataSource={collections}
      loading={loading}
      rowSelection={rowSelection}
      size="middle"
      pagination={{
        pageSize: 10,
        showSizeChanger: true,
        pageSizeOptions: [10, 20, 50],
      }}
      scroll={{ y: 360 }}
    />
  );
}
