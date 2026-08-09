# discord-bot-tsumugi

「可愛くて、楽しい。」DiscordBOT <ruby>猫咲 紬<rp>(</rp><rt>びょうさき つむぎ</rt><rp>)</rp></ruby>

## 概要

- このBOTは可愛くて楽しく使えるBOTを目指して開発されているDiscordBOTです。
- このレポジトリはGPL-3.0 licenseで公開されています。
- [公式Webサイト(※作成途中)](https://nekosanq.net/tumugi.html)
- [招待リンク](https://discord.com/oauth2/authorize?client_id=945369875516366909&permissions=1162150025751616&integration_type=0&scope=bot+applications.commands)

## 開発

- npm workspacesを使用し、Botは `apps/bot`、サーバー管理APIは `apps/api`、version付きHTTP契約は `packages/contracts` に配置している。
- Node.js 24を使用する。`.nvmrc`と各Dockerfileは24.10系に揃えている。
- 依存導入後はPrisma Clientを生成し、静的検査・unit test・buildを実行する。

```powershell
npm.cmd ci
npm.cmd run prisma:generate --workspace apps/api
npm.cmd run check
npm.cmd run test:integration --workspaces --if-present
npm.cmd run compile
```

個別検査は `npm.cmd run check --workspace apps/api` または `npm.cmd run check --workspace apps/bot` を使用する。Prisma schemaとmigrationはAPIだけが所有する。

## 設定と起動

- `.env.bot.sample` を `.env.dev` または `.env.prod` のひな形として使う。
- `.env.api.sample` を `.env.api.dev` または `.env.api.prod` のひな形として使う。
- `.env.mysql.sample` を `.env.mysql` のひな形として使う。
- `BOT_API_SERVICE_TOKEN` と `API_SERVICE_TOKEN` には同じ32文字以上のランダム値を設定する。各ファイルには必要なserviceの秘密情報だけを置く。
- APIには `API_REDIS_URL=redis://redis-api-cache:6379`、Botには `BOT_REDIS_URL=redis://redis-bot-cooldown:6379` を設定する。未設定または接続障害時は有限のin-memory実装へ縮退する。
- 非秘密のhost、port、timeoutは各appの `config/*.toml` で管理する。

Composeは開発と本番を同時起動しないprofile構成である。

```powershell
docker compose --profile development up --build
# または
docker compose --profile production up --build -d
```

API migrationは `api-migrate-development` / `api-migrate-production` が一度だけ実行し、BotやAPIコンテナの起動処理からは実行しない。MySQLはコンテナネットワーク内で利用し、ホスト公開は開発互換のため `127.0.0.1:3306` に限定している。

APIキーワードキャッシュとBotクールダウンは別Redis instance・別内部networkで動作し、6379をhostへ公開しない。Redisは任意依存であり、停止中もAPIはMySQL、Botはin-memoryクールダウンへfallbackする。APIの `/health/ready` はRedisのdegraded状態を併記し、service認証付き `/metrics` でcache/Redis指標を返す。

`npm.cmd run dev` と `npm.cmd run dev --workspace apps/bot` はDiscordへ実際にログインし、command同期を行うため、静的検査として実行しない。

クリーンアーキテクチャへの段階的な移行規則は [AGENTS.md](./AGENTS.md)、ダッシュボードのAPI・データ所有権は [ADR 0001](./docs/adr/0001-dashboard-api-data-ownership.md)、Redisの障害境界は [ADR 0002](./docs/adr/0002-redis-cache-and-cooldown.md) を参照する。
