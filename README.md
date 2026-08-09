# discord-bot-tsumugi

「可愛くて、楽しい。」DiscordBOT <ruby>猫咲 紬<rp>(</rp><rt>びょうさき つむぎ</rt><rp>)</rp></ruby>

## 概要

- このBOTは可愛くて楽しく使えるBOTを目指して開発されているDiscordBOTです。
- このレポジトリはGPL-3.0 licenseで公開されています。
- [公式Webサイト(※作成途中)](https://nekosanq.net/tumugi.html)
- [招待リンク](https://discord.com/oauth2/authorize?client_id=945369875516366909&permissions=1162150025751616&integration_type=0&scope=bot+applications.commands)

## 開発

- Node.js 24を使用する。`.nvmrc`とDockerfileは24.10系に揃えている。
- 依存導入後はPrisma Clientを生成し、静的検査・unit test・buildを実行する。

```powershell
npm.cmd ci
npx.cmd prisma generate
npm.cmd run check
npm.cmd run test:integration
npm.cmd run compile
```

`npm.cmd run dev` はDiscordへ実際にログインし、command同期を行うため、静的検査として実行しない。

クリーンアーキテクチャへの段階的な移行規則は [AGENTS.md](./AGENTS.md)、ダッシュボードのAPI・データ所有権は [ADR 0001](./docs/adr/0001-dashboard-api-data-ownership.md) を参照する。
