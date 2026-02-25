import type { ThemeConfig } from "antd";

export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: "#0f6adf",
    colorInfo: "#0f6adf",
    colorSuccess: "#27ae60",
    colorWarning: "#f39c12",
    colorError: "#d64545",
    borderRadius: 10,
    fontSize: 13,
    fontFamily:
      "'SF Pro Text', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    colorBgLayout: "#f2f6fc",
    colorBgContainer: "#ffffff",
  },
  components: {
    Card: {
      borderRadiusLG: 12,
      headerFontSize: 16,
      headerFontSizeSM: 15,
    },
    Table: {
      headerBg: "#f8fbff",
      rowHoverBg: "#f3f8ff",
    },
    Button: {
      controlHeightLG: 40,
    },
  },
};
