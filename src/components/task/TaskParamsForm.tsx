import { FolderOpenOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { Button, Card, Col, Form, Input, InputNumber, Row, Select, Space, Switch, Tooltip } from "antd";
import type { FormInstance } from "antd";
import type { ReactNode } from "react";
import type { DownloadFormValues } from "../../ui/types";

type TaskParamsFormProps = {
  form: FormInstance<DownloadFormValues>;
  initialValues: DownloadFormValues;
  busy: boolean;
  onBrowseOutputDir: () => Promise<void>;
  onBrowseBundleOutputPath: () => Promise<void>;
  onFinish: (values: DownloadFormValues) => void;
};

type PathInputWithBrowseProps = {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onBrowse: () => void;
};

function labelWithTip(label: string, tip: string): ReactNode {
  return (
    <Space size={4}>
      <span>{label}</span>
      <Tooltip title={tip} placement="topLeft">
        <InfoCircleOutlined style={{ color: "#8c8c8c" }} />
      </Tooltip>
    </Space>
  );
}

function PathInputWithBrowse({
  value,
  onChange,
  placeholder,
  disabled,
  onBrowse,
}: PathInputWithBrowseProps) {
  return (
    <Space.Compact style={{ width: "100%" }} block>
      <Input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
      <Button
        icon={<FolderOpenOutlined />}
        onClick={onBrowse}
        disabled={disabled}
        htmlType="button"
      >
        浏览
      </Button>
    </Space.Compact>
  );
}

export function TaskParamsForm({
  form,
  initialValues,
  busy,
  onBrowseOutputDir,
  onBrowseBundleOutputPath,
  onFinish,
}: TaskParamsFormProps) {
  const authMode = Form.useWatch("authMode", form) ?? "key";
  const autoBundle = Form.useWatch("autoBundle", form) ?? false;

  return (
    <Card title="任务参数" className="panel-card">
      <Form<DownloadFormValues>
        form={form}
        initialValues={initialValues}
        layout="vertical"
        disabled={busy}
        onFinish={onFinish}
      >
        <Row gutter={[12, 6]}>
          <Col xs={24} md={12}>
            <Form.Item
              label={labelWithTip("输出目录", "下载得到的 .adx/.zip 文件保存目录。")}
              name="outputDir"
              rules={[{ required: true, message: "请填写输出目录" }]}
            >
              <PathInputWithBrowse
                placeholder="例如: /Users/name/Downloads/charts"
                onBrowse={() => {
                  void onBrowseOutputDir();
                }}
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item
              label={labelWithTip(
                "connect.sid（不要填 sid）",
                "来自浏览器会话的 connect.sid，用于请求下载链接；不要误填同名的 sid。",
              )}
              name="connectSid"
              rules={[{ required: true, message: "请填写 connect.sid" }]}
            >
              <Input placeholder="请输入浏览器 Cookie 中的 connect.sid（不是 sid）" />
            </Form.Item>
          </Col>

          <Col xs={24} md={8}>
            <Form.Item
              label={labelWithTip("鉴权模式", "key: 直接使用密钥。captcha: 用验证码换取 key。")}
              name="authMode"
              rules={[{ required: true }]}
            >
              <Select
                options={[
                  { value: "key", label: "key" },
                  { value: "captcha", label: "captcha" },
                ]}
              />
            </Form.Item>
          </Col>

          {authMode === "key" ? (
            <Col xs={24} md={16}>
              <Form.Item
                label={labelWithTip("key", "鉴权密钥；选择 key 模式时必填。")}
                name="key"
                rules={[{ required: true, message: "authMode=key 时必须填写 key" }]}
              >
                <Input placeholder="请输入 key" />
              </Form.Item>
            </Col>
          ) : (
            <Col xs={24} md={16}>
              <Form.Item
                label={labelWithTip("验证码", "输入验证码后由后端调用接口换取 key。")}
                name="captcha"
                rules={[{ required: true, message: "authMode=captcha 时必须填写验证码" }]}
              >
                <Input placeholder="请输入验证码" />
              </Form.Item>
            </Col>
          )}

          <Col xs={24} md={8}>
            <Form.Item
              label={labelWithTip("下载格式", "adx 便于直接导入；zip 便于手工查看内容。")}
              name="outputFormat"
              rules={[{ required: true }]}
            >
              <Select
                options={[
                  { value: "adx", label: ".adx" },
                  { value: "zip", label: ".zip" },
                ]}
              />
            </Form.Item>
          </Col>

          <Col xs={12} md={8}>
            <Form.Item
              label={labelWithTip("重试次数", "单个谱面失败后的最大重试次数。")}
              name="retries"
              rules={[{ required: true }]}
            >
              <InputNumber min={1} max={10} style={{ width: "100%" }} />
            </Form.Item>
          </Col>

          <Col xs={12} md={8}>
            <Form.Item
              label={labelWithTip("请求间隔(ms)", "每个谱面请求之间的等待时间；默认 1000ms，遇到 429 建议继续增大。")}
              name="requestIntervalMs"
              rules={[{ required: true }]}
            >
              <InputNumber min={0} max={5000} style={{ width: "100%" }} />
            </Form.Item>
          </Col>

          <Col xs={12} md={8}>
            <Form.Item
              label={labelWithTip("下载不包含 BGA", "勾选后请求 no-BGA 资源，BGA 即谱面 PV（.mp4）。")}
              name="downloadNoBga"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Col>

          <Col xs={12} md={8}>
            <Form.Item
              label={labelWithTip("下载后自动整合", "下载完成后直接整合本次新增文件为单个 .adx。")}
              name="autoBundle"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Col>

          <Col xs={24} md={16}>
            <Form.Item
              label={labelWithTip("整合输出路径（可选）", "整合包保存路径；可通过浏览按钮直接选择保存文件。")}
              name="bundleOutputPath"
            >
              <PathInputWithBrowse
                disabled={!autoBundle}
                placeholder="未填则自动生成 bundle_merged_*.adx"
                onBrowse={() => {
                  void onBrowseBundleOutputPath();
                }}
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Card>
  );
}
