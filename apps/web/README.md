# Tsumugi Web Dashboard

Discord OAuthのcredential交換とsession管理はAPIが所有し、Webは`WEB_INTERNAL_API_URL`で指定した内部APIだけを利用する。WebへDiscord OAuth token、Bot service token、session署名鍵を設定しない。`WEB_API_PROXY_TOKEN`にはAPIと共有する32byte以上のWeb専用proxy credentialを設定し、Bot用service tokenとは分離する。

```powershell
Copy-Item apps/web/.env.web.sample apps/web/.env.local
npm.cmd run dev --workspace apps/web
```

productionではTLS終端の背後でWebを公開し、browserからの`/api/dashboard/*`だけをWeb route handlerが内部APIへ転送する。内部API自体をbrowserへ公開しない。

TLS終端のreverse proxyは、外部から受け取った`x-real-ip`を必ず削除して接続元IPで上書きする。WebはIPまたはHttpOnly client-id cookieをHMAC-SHA256で不可逆化し、opaque client IDだけをAPIへ転送する。
