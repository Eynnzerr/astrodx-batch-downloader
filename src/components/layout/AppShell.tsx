import { Layout } from "antd";
import type { PropsWithChildren, ReactNode } from "react";

type AppShellProps = PropsWithChildren<{
  header: ReactNode;
}>;

export function AppShell({ header, children }: AppShellProps) {
  return (
    <Layout className="app-layout">
      <Layout.Header className="app-header">{header}</Layout.Header>
      <Layout.Content className="app-content">{children}</Layout.Content>
    </Layout>
  );
}
