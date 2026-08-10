# ADR 0003: ダッシュボード認証とrate limitの障害境界

- 状態: 採用
- 決定日: 2026-08-10

## 背景

ダッシュボードはDiscord OAuthで利用者を識別し、サーバー設定を変更する。キーワード読取cache用Redisは任意依存かつ`allkeys-lru`であり、認証や外部APIを保護するrate limitへ流用すると、evictionや障害時のfail-openでセキュリティ境界を失う。

## 決定

- OAuth code交換、token refresh、Discord guild権限の再検証はAPIだけが行う。WebとbrowserにはDiscord token、Bot service credential、API内部credentialを渡さない。
- browserは32 byteのopaque session cookieだけを保持する。production cookieは`__Host-` prefix、`Secure`、`HttpOnly`、`SameSite=Lax`、`Path=/`を必須にする。
- session ID、OAuth state、CSRF tokenはAPIの環境秘密鍵によるHMAC digestだけをMySQLへ保存する。Discord access/refresh tokenはAES-256-GCMで暗号化し、鍵は環境変数だけで与える。
- OAuth stateは10分、一回限りとし、同じ値をHttpOnly cookieにも束縛する。return先は`/dashboard`配下だけに制限する。
- sessionはidle 8時間、absolute 7日とする。logoutはMySQL sessionを先に失効させ、Discord revokeは有限timeoutのbest-effortとする。
- dashboardの表示とmutationごとにDiscordのguild一覧を取得し、owner、Administrator、Manage Guildのいずれかを確認する。Discord障害や不明な権限はfail-closedにする。
- dashboardはBotが同期した`ManagedGuild`と`Channel` projectionだけを利用する。人間の操作で未知のchannelをclaimしたり`botInstalled=true`へ変更したりしない。
- 成功したキーワード保存・削除とBot snapshot同期は、対象データと同じMySQL transactionで監査する。監査にはtoken、message本文、IP addressを保存しない。

## 専用Redis

- 用途: OAuth開始、OAuth callback、dashboard mutationの固定window rate limitだけ。
- 正本: なし。session、OAuth state、監査の正本はMySQLであり、Redis全消失で永続データを失わない。
- key: `tsumugi:api-security:v1:{environment}:rate-limit:{bucket}:{hmac(identifier)}`。user、guild、IPを平文keyやmetrics labelへ含めない。
- TTL: 既定60秒。上限はOAuth開始10、callback 20、mutation 30で、非秘密設定から環境別に変更できる。
- 原子性: Lua内の`INCR`と初回`PEXPIRE`を単一commandとして実行する。read後writeで判定しない。
- 容量: Redis 8.2.8、`maxmemory 64mb`、`noeviction`、container上限96MB。hostへportを公開しない。
- 障害時: rate limit commandのtimeout、接続断、OOMはdashboardの認証開始・callback・mutationを503でfail-closedにする。productionでRedis URLがなければ起動を拒否する。developmentだけは上限付きin-memory limiterを許可する。
- timeout: 接続500ms、command 250ms、再接続100msから5秒までの上限付きbackoffとjitterを使う。
- cleanup: keyは有限TTLで自然消滅させ、運用やtestで`KEYS`、`FLUSHDB`、`FLUSHALL`を使わない。

## テストと運用

- unit testで権限bit、return先、state replay、token暗号化・改ざん、CSRF、固定windowを確認する。
- 実Redis integration testで複数接続間の原子的な取得とshutdownを確認する。
- 実MySQL integration testでtenant横断拒否、未知channelをclaimしないこと、設定と監査のtransactionを確認する。
- Redis readinessをMySQLとは別の`dashboardSecurity`依存として公開する。cache Redisのdegraded状態と混同しない。
