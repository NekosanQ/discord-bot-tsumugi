# CI/CDとproduction deployment

## 境界

CI、image公開、deploymentを別workflowに分離する。

- `CI` はNode.js 24で全workspaceのcheck、integration test、compileを実行する。使い捨てのMySQLとRedisを起動し、API所有のPrisma Client生成、schema検証、`migrate deploy`を同じjob内で1回実行する。
- `Publish immutable images` はdefault branchへのpushで成功した`CI`だけを受け取り、`api`、`bot`、`web`をfull Git SHAだけでGHCRへ公開する。
- `Deploy or rollback` は手動起動だけを許可する。選択したGitHub Environmentの保護ルール、runner、接続先directory、secretを使う。repository内にproduction host名や公開URLを固定しない。

PR由来の`workflow_run`にはpackage書込権限を渡さない。image公開条件は、同じrepositoryのdefault branchへの`push`でCIが成功した場合に限定している。

## Immutable image契約

source SHAが`0123456789abcdef0123456789abcdef01234567`の場合、次の4 artifactを公開する。`latest`やbranch tagは作成しない。

```text
ghcr.io/<owner>/<repository>-api:sha-0123456789abcdef0123456789abcdef01234567
ghcr.io/<owner>/<repository>-api:sha-0123456789abcdef0123456789abcdef01234567-migration
ghcr.io/<owner>/<repository>-bot:sha-0123456789abcdef0123456789abcdef01234567
ghcr.io/<owner>/<repository>-web:sha-0123456789abcdef0123456789abcdef01234567
```

API runtimeとmigrationは同じAPI image repository、同じsource SHA、別のDockerfile targetである。runtime targetにはPrisma CLIを含めず、migration targetだけが`prisma migrate deploy`を実行する。publish workflowは既存SHA tagを上書きせず、同じcommitの再実行では既存artifactを維持する。deploymentはtagをpullした直後にregistry digestへ解決し、Composeとcurrent/previous stateにはdigest referenceだけを渡す。

## GitHub Environment

staging、productionなど実在する環境ごとにGitHub Environmentを作成し、必要に応じてrequired reviewerとdeployment branch ruleを設定する。次のEnvironment variablesを登録する。

| Variable                        | 必須 | 用途                                                                        |
| ------------------------------- | ---- | --------------------------------------------------------------------------- |
| `DEPLOY_RUNNER_LABEL`           | yes  | deployment target上のself-hosted runner固有label。空白を含めない            |
| `DEPLOY_WORKDIR`                | yes  | stateを保持するrunner上の絶対directory。`/`は禁止                           |
| `DEPLOY_ENV_DIR`                | yes  | 事前配置済み`api.env`、`bot.env`、`mysql.env`、`web.env`の絶対directory     |
| `DEPLOY_CONFIG_DIR`             | yes  | 事前配置済み3つのproduction TOMLの絶対directory                             |
| `WEB_BIND_ADDRESS`              | yes  | Web portをbindする明示的なIPv4 address。reverse proxy利用時はloopbackを推奨 |
| `WEB_HOST_PORT`                 | yes  | container port 3001へ割り当てるhost側port                                   |
| `COMPOSE_PROJECT_NAME`          | no   | 未設定時は`tsumugi`。同じhost上では環境ごとに一意にする                     |
| `DEPLOY_HEALTH_TIMEOUT_SECONDS` | no   | 各serviceのhealth待機上限。30から900、未設定時180                           |
| `GHCR_USERNAME`                 | no   | cross-repository tokenを使う場合のGHCR username                             |

同じEnvironmentに`GHCR_READ_TOKEN` secretを任意で登録できる。同じrepositoryに紐付いたpackageをpullできる場合はworkflowの`GITHUB_TOKEN`へfallbackする。cross-repository packageを使う場合だけ、対象packageへのread権限に限定したtokenを登録する。application secretをGitHub Actionsからhostへ書き込まない。

Environment variableはjob開始後に利用可能になるため、最初のGitHub-hosted jobが`DEPLOY_RUNNER_LABEL`を検証してoutputへ渡し、次のjobが`self-hosted`とその固有labelでtarget runnerを選ぶ。runnerはdeployment target上に置き、remote shellの接続先をworkflowへ埋め込まない。

## Targetの事前準備

deployment runnerはLinux、Node.js 24 action runtimeに対応した最新のGitHub Actions Runner、Docker Engine、Docker Compose v2.31以降、`flock`、`stat`、`mktemp`、`realpath`を必要とする。runner用accountに必要最小限のDocker権限だけを与える。Docker daemonを操作できるaccountは実質的にhost管理権限を持つため、一般利用者と共有しない。

`DEPLOY_WORKDIR`、`DEPLOY_ENV_DIR`、`DEPLOY_CONFIG_DIR`はcheckoutされる`GITHUB_WORKSPACE`の外に事前作成する。checkoutのclean処理でstateやsecretが消える配置はscriptが拒否する。

`DEPLOY_ENV_DIR`へ次の4ファイルを事前配置する。雛形は`deploy/examples/`にあり、すべてowner read/writeだけに制限する。

```bash
chmod 600 \
  "$DEPLOY_ENV_DIR/api.env" \
  "$DEPLOY_ENV_DIR/bot.env" \
  "$DEPLOY_ENV_DIR/mysql.env" \
  "$DEPLOY_ENV_DIR/web.env"
```

値をterminalやCI logへ表示して確認しない。APIとBotのservice tokenは同じ十分に長いrandom valueにし、`API_WEB_PROXY_TOKEN`と`WEB_API_PROXY_TOKEN`も同じ32文字以上の独立したrandom valueにする。MySQL user passwordとroot passwordは分ける。Discord redirect URIはDeveloper Portalへ登録したproduction callbackと完全一致させ、repositoryのsample値を公開先として使わない。`web.env`の`WEB_INTERNAL_API_URL`はCompose内部の`http://api:3000`であり、browserへ公開するURLではない。

Webの公開portは信頼するreverse proxyからだけ到達可能にする。edgeはclientから届いた`X-Real-IP`をそのまま転送せず、検証済みclient addressで必ず上書きするかheader自体を削除する。Webはこの値をHMAC化してAPIへ渡し、headerがなければHttpOnly client-id cookieへfallbackする。未検証の転送headerを許すとrate limitの識別子を利用者が選べるため、Web containerを直接公開しない。

`DEPLOY_CONFIG_DIR`へ次の非秘密設定を事前配置する。

```text
api.production.toml
bot.production.toml
web.production.toml
```

各appの`config/example.toml`を起点に環境固有の非秘密値を設定する。token、database URL、OAuth secret、session署名鍵、`NODE_ENV`をTOMLへ入れない。

container内の非root userがbind mountを読めるよう、TOMLはsecretを含まないことを再確認したうえでread-onlyにする。例えばownerだけが書き換え、全userが読める`0644`を使用する。

```bash
chmod 644 \
  "$DEPLOY_CONFIG_DIR/api.production.toml" \
  "$DEPLOY_CONFIG_DIR/bot.production.toml" \
  "$DEPLOY_CONFIG_DIR/web.production.toml"
```

production ComposeはMySQL dataとBot logだけをnamed volumeに保存し、Docker runtime logも`10mb x 5`へ制限する。Bot-to-APIとWeb-to-APIのnetworkも分け、BotとWebを直接同じnetworkへ置かない。keyword cache、dashboard security rate limit、Bot cooldownの3つのRedisは用途とnetworkを分離したtmpfsであり、host portを公開しない。security Redisは`64mb/noeviction`とし、容量超過や接続障害をAPI readinessとdashboardのfail-closed応答へ反映する。APIとMySQLもhost portを公開しない。Webのbind addressとportだけをEnvironmentで明示し、公開TLSとreverse proxyはdeployment target側で事前準備する。

## Deploy

1. `Publish immutable images`が対象commitで成功していることを確認する。
2. `Deploy or rollback`を開き、Environment、`deploy`、full 40-character lowercase SHAを指定する。
3. Environment approval後、scriptは4 artifactをpullしてdigestへ固定する。
4. MySQLと3つの用途別Redisを起動し、MySQL readinessを待つ。
5. 対象SHAのAPI migration targetから`prisma migrate deploy`を1回だけ実行する。
6. API、Bot、Webを更新し、各container healthが上限時間内にhealthyになることを確認する。続けてWeb container内から未認証session endpointを呼び、server-side proxy credentialを含むWeb-to-API境界も確認する。
7. 成功時だけ`$DEPLOY_WORKDIR/state/current.env`を更新し、従来のcurrentを`previous.env`へ移す。

scriptは`set -x`を使わず、env内容を表示せず、Compose validationも`--quiet`で行う。状態ファイルに保存するのはsource SHAとimage digestだけで、secretは保存しない。deployment/rollbackは`flock`で直列化する。

すでにcurrentのSHAを再指定した場合は、保存済みdigestでcontainerとhealthを再収束させるだけでmigrationを再実行せず、previous stateも押し流さない。

envとTOMLはimage stateへcopyしないため、rollbackでも現在の事前配置値を使う。設定変更やsecret rotationはcurrent imageとcandidate imageの双方が読める形で先に準備し、互換期間を置いてから古い形式を削除する。imageと同時に非互換な設定切替を行わない。

current/previous stateが追跡するのはAPI、migration、Bot、Webの4 artifactだけである。MySQLやRedisのimage version変更は自動rollback対象に含めず、data backupと互換性を確認する別変更として扱う。

candidateのmigrationまたはhealth確認が失敗した場合、current stateを変更せず、以前のdigest setを自動的に再起動してhealthを確認する。最初のdeploymentで復旧対象がない場合は、途中まで起動したapplication containerだけを停止し、MySQL volumeは削除しない。

## Rollback

`Deploy or rollback`で同じEnvironmentと`rollback`を選ぶ。SHA入力は不要である。scriptは`previous.env`のdigest setを起動してhealthを確認し、成功後にcurrent/previousを入れ替える。

rollbackはapplication imageだけを戻し、適用済みdatabase migrationを逆適用しない。そのためmigrationは少なくとも直前imageと後方互換なexpand/contract方式にする。破壊的なcontract migrationは、旧imageへ戻す必要がなくなったことを確認した別releaseで行う。migration成功後にapplicationが失敗した自動rollbackでも同じ制約がある。

## Container securityと確認範囲

API、Bot、Web、migrationはimage内の非root userを維持し、root filesystemをread-only、Linux capabilityを全drop、`no-new-privileges`を有効にする。書込先はBot log volumeと明示したtmpfsだけである。MySQLとRedisも非root、capability全drop、host portなしで起動する。

health確認はcontainer内のAPI `/health/ready`、Web `/health/live`、Bot process livenessを利用し、追加probeでWebからAPIの未認証session応答までを確認する。これはDiscord command同期、Discord OAuthとの実通信、外部reverse proxy/TLS、実利用者権限までの成功を証明しない。deployment後の運用確認では、secretを含めない範囲でreverse proxy、Discord接続、APIのdegraded状態を別途確認する。
