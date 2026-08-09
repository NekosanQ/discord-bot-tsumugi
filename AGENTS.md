# AGENTS.md

## 適用範囲と目的

- このファイルはリポジトリ全体に適用する。配下に別の `AGENTS.md` がある場合は、深い階層の指示を優先する。
- 現在は Node.js、TypeScript、discord.js、Prisma、MySQL を使うDiscord Botであり、将来のAPIとWebダッシュボードを含むnpm workspacesベースのmonorepoを目標とする。
- 既存の振る舞いを維持しながら、`apps/bot`、`apps/api`、`apps/web` を独立したdeployableとして扱う、分かりやすいクリーンアーキテクチャへ段階的に移行する。
- 優先順位は、データ・権限・秘密情報の安全性、後方互換性、依存方向とテスト容易性、可観測性、性能の順とする。
- Redisや抽象層を増やしただけで堅牢になったと見なさない。障害時挙動と検証方法を定義できない仕組みは追加しない。
- 全クラスへのinterface追加、空レイヤーの先行作成、単純な処理の過剰分割を避ける。

## 現状認識

- Stage 1まで完了しており、rootはnpm workspaceの統括、既存Botは `apps/bot` の独立packageとして配置している。`apps/api` と `apps/web` はまだ作成していない。
- `apps/bot/src/index.ts` は直接実行時だけproduction bootstrapを起動する。Discord Client、Prisma Client、CommandHandlerの生成は `apps/bot/src/bootstrap/` にあり、下位コードからentrypointへの逆importは依存注入へ置換済みである。
- `apps/bot/src/commands/` と `apps/bot/src/events/` にはimport時に生成されるシングルトンが多い。既存コードとして当面許容するが、新規・移行済みコードでは増やさない。
- Prisma schemaとmigrationはStage 2のAPI切替までの移行用として `apps/bot/prisma/` に置いている。新しい直接Prisma accessは増やさない。
- Bot用Dockerfileは `apps/bot/Dockerfile` に置き、build contextはworkspaceのrootとする。
- キーワード応答はメッセージごとにMySQLを参照し、クールダウンはプロセス内メモリだけで管理している。
- Node標準test runner、unit/integration script、GitHub Actionsの静的検証をStage 0の安全網として導入済みである。静的検証の成功をDiscord、MySQL、Dockerなどの実環境確認の成功として報告しない。
- 移行中は旧構成と新構成の共存を許容する。ただし、同じユースケースに複数の書込経路を作らない。

## 作業開始時

1. このファイル、`README.md`、`package.json`、対象コードと関連設定を読む。
2. `git status --short --branch` と対象差分を確認し、利用者の未コミット変更を保護する。
3. 変更前の振る舞い、エラー分類、権限、データ整合性、外部I/Oを確認する。
4. 機能単位の小さい変更に分け、各段階でコンパイル可能かつ起動可能な状態を維持する。

- 無関係なリファクタリング、依存更新、ファイル移動を同じ変更へ混ぜない。
- 依頼範囲外の問題は勝手に大規模修正せず、影響と安全な次の切り分けを報告する。
- 実値を含む `.env.*` や設定ファイルを、確認目的だけで開いたり表示したりしない。
- ログ調査では全体を出力せず対象行だけを検索し、token、接続文字列、メッセージ本文などをマスクする。

## アーキテクチャ契約

新規・移行済みコードはアプリ単位で分離し、各アプリ内を責務の分かるレイヤーに分ける。各レイヤーの中では、ファイルを技術種類だけで並べず `keyword`、`help`、`guild` などの機能単位でまとめる。

目標構成は次のとおり。

```text
apps/
  bot/
    package.json
    src/
      domain/
      application/
      interface-adapter/
      infrastructure/
      bootstrap/
      index.ts
    tests/
    integration-tests/
    config/
  api/
    package.json
    src/
      domain/
      application/
      interface-adapter/
        http/
      infrastructure/
      bootstrap/
      index.ts
    tests/
    integration-tests/
    prisma/
    config/
  web/
    package.json
    src/
      domain/
      application/
      infrastructure/
      bootstrap/
      app/
    tests/
    e2e/
packages/
  contracts/                        # version管理されたAPI schema/DTOのみ
package.json                        # workspace共通scriptと依存管理
docker-compose.yml                  # 開発・運用サービスの構成
```

- ディレクトリは必要になった時点で作り、Web要件が決まる前に空アプリや将来用の空interfaceを量産しない。
- `domain` はentity、value object、domain service、domain error、業務ルールを持ち、他レイヤーやframeworkへ依存しない。
- `application` はuse case、入出力DTO、transaction境界、利用側の語彙で表したportを持ち、`domain` だけへ依存する。
- Botの `interface-adapter` はDiscord command、event、modal、component、controller、presenter、mapperを持つ。Discord入力をapplication DTOへ変換し、use case結果をDiscord応答へ変換する。
- APIの `interface-adapter/http` は認証済みHTTP入力をapplication DTOへ変換し、認可結果とuse case結果をversion管理されたAPI応答へ変換する。
- Webの `app` はroute、page、UI、server action、controllerなどのinterface adapterであり、業務ルールやDB処理を持たない。
- `infrastructure` はPrisma repository、Redis cache、外部API client、logger、設定readerなどapplication portの具象実装を持つ。
- `bootstrap` は具象依存の生成、DI、起動、正常終了だけを担当し、業務ルールを持たない。
- Botの `apps/bot/src/index.ts` は `bootstrap` を呼ぶだけの安定したentrypointにする。下位レイヤーから `index.ts` や `bootstrap` をimportしない。
- 依存方向は `domain <- application <- interface-adapter/app` と `domain <- application <- infrastructure` とし、`bootstrap` だけが全具象を組み立てる。
- `interface-adapter` / `app` と `infrastructure` を直接呼び合わせず、application portとuse caseを介す。
- Discord型、Prisma型、Redis型、Web framework型をapplicationの引数・戻り値やdomain objectへ漏らさない。
- 新しい依存はconstructorまたは明示的なfactory引数から注入する。service locator、隠れたglobal、import時I/Oを追加しない。
- portを作るのは、外部I/O、時刻、乱数、ID生成など、実際の境界またはテストで差し替える点だけとする。
- すべての機能に全レイヤーを作らない。`ping` など業務ルールを持たない機能へ空のdomainやapplicationを追加しない。

例えばサーバー管理のキーワード機能は、API内の `domain/keyword`、`application/keyword`、`interface-adapter/http/keyword`、`infrastructure/persistence/prisma/keyword`、`infrastructure/cache/redis/keyword` のように、同じ機能名を各レイヤーで追える配置にする。Botは `interface-adapter/discord/keyword` と `infrastructure/api-client/keyword`、Webは `app` またはUI featureと `infrastructure/api-client/keyword` から同じAPI contractを利用する。

### アプリ間の境界

- `apps/api` をサーバー管理機能のsystem of recordとする。APIがdomain/application、MySQL/Prisma schema、migration、共有Redis cache、認証・認可を所有する。
- `apps/api` はDiscord Gatewayとは別process・別deployableにし、Bot再接続や再deployでダッシュボードAPIまで停止させない。
- `apps/bot` と `apps/web` はAPI clientであり、MySQL/Prismaへ直接接続しない。互いまたはAPIの内部 `src/`、`prisma/`、設定を直接importしない。
- Bot固有の短命なcommand cooldownはBotが所有する。APIのcache、OAuth一時状態、dashboard rate limitとkey namespaceを分け、SLOやeviction要件が異なる場合はRedis instanceも分ける。
- `packages/contracts` で共有するのはversion管理されたAPI request/response schemaと生成型だけとする。domain entity、repository、Prisma型、API実装を共有しない。
- BrowserへDiscord OAuth token、Bot用service credential、API内部credentialを渡さない。WebはHttpOnlyなsession境界を使い、APIが認証情報と権限を検証する。
- APIはmutationごとに対象guild、Bot導入状態、利用者の最新Discord権限をserver-sideで検証する。browserから渡されたguild IDやpermission claimだけを信用しない。
- BotからAPIへの通信は人間用sessionと分離したservice identityを使い、最小権限、期限・rotation、監査可能性を持たせる。
- app間で共有するのはversion管理されたAPI contractや本当に共通の値だけとし、汎用 `shared` packageを作らない。
- root `AGENTS.md` にはmonorepo全体の安定ルールを置く。app固有の手順が増えた場合だけ各app配下に `AGENTS.md` を追加し、rootの内容を重複させない。

既存コードを変更するときは、現在の構成を一度に全面移行しない。新しい逆importや直接I/Oを増やさず、対象機能の境界を少しずつ新構成へ移す。compatibility bridgeには用途と削除条件を持たせ、参照がなくなった段階で削除する。

## 移行順序

### Stage 0: 移動前の安全網

- まず `src/index.ts` だけを外部接続を開始するentrypointにし、設定読込、依存構築、Discord loginを明示的な `createApplication` / `start` 境界へ分ける。
- 下位コードから `src/index.ts` への逆importを依存注入へ置き換え、module importだけでDiscord login、Prisma接続、file I/O、`process.exit` が起きない状態を作る。
- 上記の安全なimport境界を作ってからcharacterization testを追加する。testより先に実環境接続が起きる構造をmockだけで隠さない。
- サポートするNode.js versionを決め、Dockerfile、devcontainer、`package.json` の `engines`、CIで一致させる。
- Prisma CLIと `@prisma/client` の宣言・lockfile解決versionを揃える。
- `typecheck`、`test:unit`、`test:integration`、`test`、`check` scriptsとCIを整備する。
- production build用 `tsconfig.build.json` と、`src` とtestを `noEmit` で検査するtest用tsconfigを分ける。
- `check:architecture` を追加し、layer逆依存、app間deep import、循環依存、下位層から `index` / `bootstrap` へのimportをCIで禁止する。
- 現在の主要動作をcharacterization testで固定し、設定を起動時に実行時検証する。
- 現在の起動、build、Prisma、Docker Composeのbaselineを記録し、移動後に同じ検証を再実行できるようにする。

### Stage 1: `apps/bot` へ構造だけを移す（2026-08-09完了）

- root `package.json` はnpm workspacesの管理用とし、Bot固有の依存とscriptsは `apps/bot/package.json` が所有する。lockfileはrootで一元管理する。
- Botの `src/`、`tests/`、`config/`、移行用 `prisma/`、tsconfig、Dockerfileは `apps/bot/` 配下に置く。
- ESLint、Prettier、Prisma schema path、Docker build context、volume、devcontainer、CI、起動scriptはworkspace pathに合わせる。
- Stage 2までは構造移動後の振る舞いを維持し、新しいレイヤー分割や直接Prisma accessを混ぜない。
- 空の `apps/api` と `apps/web` は対応stageまで作成しない。

### Stage 2: APIをデータ所有者として抽出する

- 最初に挙動を変えず、trigger、responses、入力制約をdomainへ、Prisma `Json` のdecode・schema検証をinfrastructureへ抽出する。
- 照合順、transaction、error分類などの仕様変更は上記の構造抽出と別commit・別testにする。
- dashboardのtenant境界を `ManagedGuild` aggregateとし、Keywordがguildとchannelの所属を追跡できるmodelへ移行する。raw channel IDだけを認可根拠にしない。
- `apps/api` にサーバー管理domain/application、`KeywordRepository`、Prisma実装、schema、migrationを移す。
- Channel作成とKeyword登録更新を1つのtransactionにまとめ、not found、入力不正、権限不足、依存障害、予期しない障害を区別する。
- version管理されたAPI contractとHTTP adapterを追加し、BotのDiscord command、modal、message eventをAPI clientへ切り替える。
- Botの直接Prisma accessを廃止してからPrisma依存とmigration責任を `apps/api` へ移し、`migrate deploy` はAPI所有の単一deploy jobで一度だけ実行する。

### Stage 3: Redisを補助インフラとして導入する

- APIに `KeywordLookupCache`、Botに `CooldownStore` portを定義し、それぞれin-memory実装、Redis実装の順に追加する。
- APIのキーワード参照へcache-asideを導入し、Botの複数processで必要なcooldownを原子的に共有する。
- Docker、設定、health/degraded状態、メトリクス、integration・障害テストまで揃えて完了とする。

### Stage 4: サーバー管理ダッシュボードを追加する

- `apps/web` を独立workspaceとして作り、API contractだけを介してguild設定を参照・更新する。
- Discord OAuthのcredential交換・refresh・権限検証はAPI側で管理し、Web/browserはHttpOnly session以外の長期credentialを保持しない。
- dashboard表示とmutationの双方で、対象guild、Bot導入状態、利用者権限をAPIがserver-sideで再検証する。
- 入力検証、CSRF対策、rate limit、重要mutationの監査範囲を実装前に定義する。
- `tests/` と `e2e/` を最初から実行可能にし、buildだけで画面動作を確認済みとしない。

### Stage 5: 残りのBot機能を移行する

- `general`、`fun`、help、guild eventなどを1機能ずつ移行する。
- 移行済み機能から旧シングルトンと `apps/bot/src/index.ts` 逆importを除去し、参照のなくなった旧コードだけを削除する。

## Redis設計ルール

- `apps/api` が所有するMySQL/Prismaをサーバー管理データの唯一の正本とする。Redisの全データが消えても復元可能でなければならない。
- Redisは、キーワード読取キャッシュ、TTL付きクールダウン、正本を別に持つ短命な状態だけに使う。
- 監査、課金、権限、永続的な実行済み判定、分散ロック、Pub/Sub、Streams、ジョブキューへ使う場合は、先にADRと障害モデルを作る。
- APIのキーワード参照は `cache get -> miss/異常ならMySQL -> 成功時だけcache set` のcache-aside方式とする。
- DB更新はMySQLトランザクションを先にcommitし、その後で該当cacheを無効化する。無効化失敗でcommit済み更新を失敗扱いにせず、警告とTTLで収束させる。
- キャッシュ導入前に複数trigger一致時の照合順を決定的な仕様にし、DBの返却順へ依存しない。
- キーはappごとの中央KeyBuilderだけで生成し、`tsumugi:{app}:vN:{environment}:...` のnamespaceと有限TTLを必須にする。形式変更はversionを上げ、全DB flushで移行しない。
- 構造化cache値はschema versionを持ち、実行時検証に失敗した値を破棄して正本から再取得する。
- クールダウン取得は `SET ... NX PX` 相当の原子的操作を使い、read後writeの競合を作らない。
- API Redis timeout時、キーワード読取は短時間でMySQLへfallbackする。Bot Redis timeout時、現在のcooldownはin-memoryへfallbackし、degraded状態を記録する。
- セキュリティや外部費用を守るrate limitへ同じfail-open方針を流用せず、要件に応じてfail-closedを検討する。
- 接続とコマンドには短く有限なtimeout、上限付きbackoffとjitterを設け、リクエスト中に無限retryしない。
- 接続状態、hit/miss、fallback、timeout、invalid value、eviction、使用メモリを観測する。メトリクスlabelへuser・guild・channel IDを入れない。
- アプリケーション、migration、テスト清掃で `KEYS`、`FLUSHDB`、`FLUSHALL` を使わない。テストはrun固有namespaceだけを安全に削除する。
- Redis client、接続情報、cache内容をdomain/applicationやログへ漏らさない。
- cache用RedisはDocker内部networkだけに置き、`6379` をhost公開しない。image version、healthcheck、memory上限、eviction policyを明示する。
- cache専用Redisへ耐久性の異なるキューを安易に同居させず、`depends_on` をreadiness保証として扱わない。

新しいRedis用途では、正本、キーとschema version、TTLと最大容量、無効化順序、停止時挙動、timeout・監視、テストを設計メモまたはADRへ記録する。

## Prisma、Discord、設定、ライフサイクル

### Prisma

- Stage 2完了後は `apps/api` だけがPrismaへ依存する。API内でも直接accessをinfrastructureのpersistence adapterへ限定し、Bot/WebへPrisma依存を追加しない。
- Stage 2までのlegacy Botコードへ新しいPrisma直接accessを増やさない。
- Prisma recordとdomain objectのmapping、`Json` の実行時検証をadapterへ集約する。
- 複数の永続化操作が1つの成功応答を構成する場合は、明示的なトランザクションにまとめる。
- 適用済みmigrationを編集しない。schema変更は新しいmigrationにし、後方互換性を確認する。
- productionで `prisma migrate dev` や `db push` を使わない。`migrate deploy` はAPIが所有する単一の管理されたdeploy jobで行い、各app container起動時に競合実行しない。
- schema変更後と依存導入後は、静的検証より先に `prisma generate` を実行する。
- cache導入前後でquery数とlatencyを測り、効果を推測だけで報告しない。

### Discord

- command、modal、component、eventは入力抽出、権限確認、defer/reply、結果変換に絞る。
- 外部I/Oを伴うinteractionは応答期限を考慮し、reply済み、defer済み、未応答を区別する。
- commandとsubcommandで権限とcooldownを一貫して適用し、UI上のdefault permissionsだけに依存しない。
- action IDは一意かつ安定させ、利用者入力を安全にparseする。
- ユーザー向け応答へ内部例外や接続情報を含めない。
- Stage 2以降のサーバー管理command/eventはversion管理されたAPI clientを使い、APIエラーをDiscord向け結果へ変換する。BotからDBへfallbackしない。
- `npm run dev` はDiscordへ実際にログインし、起動時にguild commandを同期する。静的検証として自動実行しない。
- command、subcommand、actionを追加したら `apps/bot/src/commands/index.ts` への登録を確認する。eventも対応する `apps/bot/src/events/events.ts` への登録を確認する。
- 新規機能で既存の `export default new ...` をコピーせず、factoryまたはconstructor injectionを使う。

### 設定とライフサイクル

- `DISCORD_TOKEN`、`DATABASE_URL`、app別 `REDIS_URL`、Discord OAuth秘密情報、Bot/API間service credential、session署名鍵、TLS秘密情報、`NODE_ENV` は環境変数だけで扱う。
- TTL、timeout、feature flag、表示設定などの非秘密値は、移動後は各appの `config/*.toml` に置き、型付きschemaで起動時に検証する。
- TOMLをTypeScript型へ直接castして検証済みと見なさない。設定追加時は、移動前は `config/example.toml`、移動後は `apps/bot/config/example.toml`、秘密変数名はplaceholderだけの `.env.sample` を更新する。
- token、connection string、不要なusernameやメッセージ本文をコード、ログ、fixture、文書へ含めない。
- 起動は設定検証、依存構築、必要サービス接続、adapter登録、listener/login開始の順序を明示し、importだけで接続やprocess終了を起こさない。
- `SIGTERM` と `SIGINT` では新規処理を止め、実行中処理を期限付きで待ち、Discord、Redis、Prisma、ロガーを冪等に終了する。
- 外部I/Oにtimeoutを設け、retryは冪等な処理だけに限定し、回数と総時間を制限する。
- healthはprocess生存、必須依存のreadiness、任意依存のdegradedを区別する。未実装のportをDockerで公開しない。
- Compose変更時は既存の `5555` とMySQL `3306` のhost公開が本当に必要か確認し、新しいDB/cache portを既定で公開しない。
- ログ出力先とDocker volumeのmount先を一致させる。

## TypeScript、テスト、検証

- ESMと `moduleResolution: NodeNext` を維持し、相対importにも `.js` 拡張子を付ける。
- `strict`、型付きESLint、import sort、明示的なaccess modifierと戻り値型を回避しない。
- `any`、二重cast、非null assertionで不正データを隠さない。外部入力は `unknown` としてparseする。
- `eslint-disable` は局所的かつ理由が明確な場合だけ使う。
- 既存のPrettier設定を維持する。workspace依存変更時は対象appの `package.json` とroot `package-lock.json` を同時に更新する。
- domain/applicationのunit testはDiscord、DB、Redis、network、実時計へ接続しない。
- repository/cache portはcontract test、PrismaとRedis adapterは使い捨て環境でintegration testを行う。
- Redis testではhit/miss、TTL、無効化、破損値、接続断、原子的cooldown、fallback、shutdownを確認する。
- 不具合修正では可能なら先に再現testを追加する。テスト未整備や未実施を成功と表現しない。
- Botのunit/contract testは `apps/bot/tests/`、実MySQL・Redis等を使うtestは `apps/bot/integration-tests/` に置き、対象 `src/` の構造を追える配置にする。
- APIのunit/contract testは `apps/api/tests/`、実MySQL・Redis・HTTPを使うtestは `apps/api/integration-tests/` に置く。認証・認可とtenant分離を必須testにする。
- Webのunit/component testは `apps/web/tests/`、browserを使うend-to-end testは `apps/web/e2e/` に置く。

Windows PowerShellでは、必要に応じて `npm.cmd` と `npx.cmd` を使う。次はStage 1完了後の現行commandである。

依存セットアップ時:

```powershell
npm.cmd ci
npm.cmd run prisma:generate --workspace apps/bot
```

TypeScript変更時:

```powershell
npm.cmd run prisma:generate --workspace apps/bot
npm.cmd run check --workspace apps/bot
```

配布物やDocker buildへ影響する場合は `npm.cmd run compile --workspace apps/bot` も実行する。monorepo全体の検査はrootで `npm.cmd run check` を実行する。

Prisma変更時:

```powershell
npm.cmd run prisma:validate --workspace apps/bot
```

- `prisma validate` にはprocess環境の `DATABASE_URL` が必要である。schema検証だけなら接続は行わないため、実値を読まず構文上有効な非秘密placeholderを一時設定してよい。値を表示せず、用意できなければ未実施として報告する。
- schema整形時は `npx.cmd prisma format --schema apps/bot/prisma/schema.prisma` を実行し、書き換えられた差分を確認する。
- Stage 1完了後はBotの `check`、`test:unit`、`test:integration`、Stage 2完了後はAPIの `prisma:generate`、`prisma:validate`、`check`、`test:unit`、`test:integration`、Stage 4完了後はWebの `check`、`test`、`e2e` を各workspace scriptとして定義する。rootから `npm.cmd run <script> --workspace apps/<app>` で実行し、この現行command一覧も新pathへ更新する。
- Compose変更時は `docker compose config --quiet`、必要に応じて対象serviceのbuildとhealthを確認する。
- Bot変更時は、変更範囲に応じて `npm.cmd run test:unit --workspace apps/bot` と `npm.cmd run test:integration --workspace apps/bot` を実行する。
- 静的検証はDiscord login、command登録、MySQL migration、Redis接続、Docker起動を証明しない。実行していないものを「動作確認済み」と表現しない。
- `npm run dev`、migration適用、Discord command同期、deployは、対象環境と権限が明示された場合だけ実行する。

## Gitと完了条件

- commitやpushは明示的に依頼された場合だけ行う。
- commit前に `git status --short` とdiffを確認し、利用者の変更や無関係な生成物を混ぜない。
- commit messageはConventional Commit prefixと日本語要約を使う。例: `refactor: Prisma依存をリポジトリへ分離`。
- 機能、層、migration、インフラをレビュー可能な小さいcommitへ分け、巨大なrenameと振る舞い変更を同時に行わない。
- `dist/`、`node_modules/`、実値の `.env.*`、runtime logをcommitしない。必要なmigrationとsample設定はcommitする。
- 新しい設定、script、外部依存、運用手順を追加したらREADMEまたはrunbookを更新する。

完了報告の前に、依存方向、権限、エラー分類、外部サービス停止時の挙動、test、lint、format、typecheck、必要なPrisma・Docker検証、設定sample、secret混入、`git diff` を確認する。実行できなかった検証と残るリスクは明記し、静的検証だけで実環境まで確認したと主張しない。
