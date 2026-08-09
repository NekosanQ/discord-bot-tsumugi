# ADR 0001: ダッシュボードAPIとデータ所有権

- 状態: 採用
- 決定日: 2026-08-09

## 背景

利用者がDiscordサーバーを管理するWebダッシュボードを追加する。BotとWebが同じMySQLやPrisma schemaへ直接アクセスすると、認可、トランザクション、migration、キャッシュ無効化の責任が分散し、異なるrelease間でデータを壊す危険がある。また、WebをBotプロセスへ同居させると、Discord接続と管理画面を独立して配備・拡張・復旧できない。

## 決定

管理プレーンとして、独立して配備できる `apps/api` を追加する。

- `apps/api` は、ダッシュボードとサーバー管理に関するdomain/application、API adapter、Prisma/MySQL schemaとmigration、トランザクション、認可、監査、および共有Redisキャッシュを所有する。
- `apps/web` は利用者向けUIであり、公開されたAPIだけを利用する。DB、Prisma、Redis、Bot内部コードへ直接アクセスしない。
- `apps/bot` はDiscord adapterとBot固有の実行ロジックを所有し、管理データはAPIのservice clientとして取得・更新する。APIのDB、Prisma、共有Redisへ直接アクセスしない。
- Bot固有のクールダウンは `apps/bot` が所有する。複数Botプロセスで共有する場合も、APIのキャッシュとは別のRedis namespaceと資格情報を使い、可能ならinstanceも分離する。
- MySQLを管理データの唯一の正本とする。APIのRedisは読取キャッシュなど復元可能な補助データに限定し、API以外へ資格情報を配布しない。
- app間でdomain model、Prisma型、repository実装を共有しない。必要になった時点で `packages/contracts` を追加し、version管理されたAPIのrequest、response、error schemaとruntime validatorだけを置く。
- dashboardのtenant境界は `ManagedGuild` aggregateとする。Keywordなどchannel単位の設定も `guildId` と `channelId` の所属を追跡し、現在の `Channel.id` だけを持つmodelを認可根拠として維持しない。
- Discord上のguild所属と権限を認可のauthorityとする。DBの `ManagedGuild` は設定・Bot導入状態・同期状態を保持するが、利用者権限の正本にはしない。

最終的な依存関係は次のとおりとする。

```text
apps/web ──HTTPS──> apps/api ──> MySQL
                          └────> API-owned Redis

apps/bot ──HTTPS──> apps/api
    └───────────────────────> Bot-owned cooldown Redis
```

### APIと障害時の契約

- APIはversion付きcontractを公開し、破壊的変更は新versionまたは互換期間を設ける。生成型だけに依存せず、境界でrequestとresponseを実行時検証する。
- 書込はAPIで認可した後、MySQL transactionをcommitし、その後に関連cacheを無効化する。監査記録は永続化し、Redisを正本にしない。
- API停止中の書込はfail-closedとする。Botの安全な読取ユースケースだけは、明示した短いTTL内でlast-known-goodのローカルsnapshotを利用してよい。権限判定には古いsnapshotを使わない。
- service間通信には有限timeout、上限付きretry、相関IDを設け、秘密情報、OAuth token、Discordのメッセージ本文をログへ出さない。

### 認証と認可

- 利用者認証はDiscord OAuth 2.0 Authorization Code flowを使い、sessionへ結び付けた一回限りの `state` と、Developer Portalへ事前登録した正確なredirect URIを必須とする。
- PKCEはDiscord側の対応を実装時に公式仕様と実通信で確認し、対応している場合は `S256` を使用する。対応確認なしにPKCEだけをCSRF対策として扱わず、`state` の検証を常に行う。
- APIがOAuth code交換とserver-side sessionを担当する。browserにはopaqueなHTTP-only、Secure、SameSite cookieだけを渡し、OAuth access/refresh tokenを公開しない。tokenを保存する場合は暗号化し、失効・更新・logoutを扱う。
- APIは変更要求ごとに本人性、対象guildへの所属、必要なDiscord権限、Bot導入状態を確認する。Webから渡されたguild ID、role、permissionを信頼せず、UI上の非表示を認可として扱わない。
- 権限情報をcacheする場合は短いTTLを定義する。機密性の高い変更では再検証し、Discordまたは認可依存が不明な場合はfail-closedとする。
- BotからAPIへの通信は利用者sessionと分離した短命なservice credentialを使い、必要なendpointだけを許可する。WebとAPIが別originの場合はcredential付きCORSを明示的なorigin allowlistへ限定する。状態変更にはCSRF対策、rate limit、必要に応じたidempotency keyと監査記録を適用する。

## 段階的な移行

1. Stage 0とStage 1を先に完了し、既存Botのbaseline、test、起動境界、`apps/bot` への構造移動を固定する。
2. API contract、認可方針、エラー形式を先に定義し、contract testを追加する。空の汎用shared packageは作らない。
3. `apps/api` を作成し、既存のschemaとmigration履歴の内容を変更せずに移管する。以後のschema変更と `migrate deploy` はAPIのdeploy工程だけが所有する。
4. Botの対象ユースケースへAPI client adapterを追加し、機能単位で旧Prisma adapterから切り替える。同じユースケースに直接DB経路とAPI経路の二重書込を作らない。
5. read/write parity、認可、transaction、障害時挙動をintegration testで確認してから旧経路を削除する。移行中の直接DB adapterには対象、期限、削除条件を記録し、新規利用を禁止する。
6. BotからPrisma、DB資格情報、管理データ用migrationを除去できた時点で、APIを唯一のデータ所有者とする切替を完了する。その後にWebをAPI clientとして公開する。
7. 共有RedisキャッシュはAPI側の計測後に導入し、Bot固有cooldown Redisとは別に障害試験、namespace、TTL、容量、監視を定義する。

cutoverではAPI、Bot、migrationの配備順とrollback手順をrelease単位で定義する。rollback中も古いclientが利用できるよう、API contractとschemaはexpand-and-contractで変更する。

## 結果

### 利点

- データ、認可、transaction、migration、cache無効化の責任が一か所になり、BotとWebで挙動が分岐しにくい。
- Bot、Web、APIを個別に配備・拡張でき、Web障害をDiscord接続から分離できる。
- DBとRedisの資格情報をAPIへ限定でき、監査と最小権限を適用しやすい。

### コストと制約

- APIが新しいnetwork依存と運用対象になり、latency、timeout、version互換、可観測性、service認証への対応が必要になる。
- Botの管理データ参照はAPI障害の影響を受けるため、ユースケースごとにfail-closedか期限付きsnapshotかを定義する必要がある。
- schema所有権の移管と段階的cutoverには、一時的なcompatibility adapterと慎重な配備順が必要になる。
- `apps/api` が単なるCRUD集約や巨大な共通層にならないよう、サーバー管理の機能単位でdomain/applicationを分割する必要がある。

## 採用しない案

- WebとBotが同じDBへ直接接続する案: 認可、migration、transactionの所有者が複数になるため採用しない。
- Web APIをBotプロセスへ同居させる案: 配備と障害範囲を分離できないため採用しない。
- domainやPrisma modelを共有packageへ置く案: app境界を曖昧にし、独立した変更を妨げるため採用しない。

## 参照

- [Discord OAuth2 and Permissions](https://docs.discord.com/developers/platform/oauth2-and-permissions)
- [Discord User Resource - Get Current User Guilds](https://docs.discord.com/developers/resources/user#get-current-user-guilds)
- [RFC 9700: Best Current Practice for OAuth 2.0 Security](https://www.rfc-editor.org/rfc/rfc9700.html)
