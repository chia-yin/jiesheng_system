/** 正式／部署網址，供 LINE 訊息連結與圖片使用 */
export function getAppUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.URL?.trim() ||
    process.env.DEPLOY_URL?.trim() ||
    "http://localhost:3000";
  return url.replace(/\/$/, "");
}

export function getAppLoginUrl(): string {
  return `${getAppUrl()}/login`;
}

export function getLogoUrl(): string {
  return `${getAppUrl()}/logo-jiesheng.png`;
}
