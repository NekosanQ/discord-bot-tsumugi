# ADR 0002: Redisキャッシュとクールダウンの障害境界

- 状態: 採用
- 決定日: 2026-08-10

## 背景

キーワード応答は読取頻度が高く、Botを複数processで動かす場合はプロセス内クールダウンだけでは同時実行を抑制できない。一方、Redisを必須依存にすると、一時的な接続障害がAPIとDiscord Bot全体の停止へ拡大する。APIキャッシュとBotクールダウンは容量、eviction、障害影響が異なるため、同居によるnoisy neighborも避ける必要がある。

## 決定

- APIキーワードキャッシュとBotクールダウンには、別Redis instanceと別Docker内部networkを使う。どちらもhostへ6379を公開しない。
- Redisは任意依存とし、APIとBotのreadinessを遮断する `depends_on` 条件にはしない。
- Redis 8.2.8と公式Nodeクライアント6.1.0を固定し、offline queueを無効にする。
- 接続はアプリ起動を待たせずbackgroundで行う。接続timeoutは500ms、command timeoutは250ms、再接続は100msから5秒までのexponential backoffとjitterを使う。

## APIキーワードキャッシュ

- 正本: MySQL。Redisの全keyを失ってもDBから復元できる。
- key: `tsumugi:api:v1:{environment}:keyword-list:{guildId}:{channelId}`。
- value: `schemaVersion: 1` とtrigger/responsesの配列。読取時に実行時検証し、不正値は該当keyだけを削除してcache missとして扱う。
- TTL: 60秒。Redis未設定時のin-memory cacheも同じTTL、最大1000 scopeとする。
- 容量: Redis `maxmemory 128mb`、`allkeys-lru`。container上限は160MBとする。
- 読取: cache hitなら利用し、missまたはRedis異常ならMySQLを読む。DB成功後だけcacheへ保存する。
- 書込: MySQL transactionを先にcommitし、その後scope単位でcacheを無効化する。無効化失敗でcommit済み書込を失敗扱いにせず、警告指標と60秒TTLで収束させる。
- readiness: MySQLだけを必須とする。`/health/ready`には`keywordCache`の`disabled`、`connecting`、`ready`、`degraded`を併記する。
- metrics: service認証付き`/metrics`で接続状態、hit、miss、fallback、timeout、破損値、used memory、evictionを公開する。guild/channel/user IDをlabelへ使わない。

## Botクールダウン

- 正本: なし。コマンドごとの短命な実行抑制であり、消失しても永続データを失わない。
- key: `tsumugi:bot:v1:{environment}:cooldown:{base64url(commandKey)}:{userId}`。
- value: `1`。各コマンドのcooldown時間をRedis TTLとして必ず設定する。
- 原子性: 最初の取得は`SET key 1 NX PX ttl`相当で行う。拒否時の`PTTL`は利用者へ残り時間を表示するためだけに使い、read後writeによる取得判定は行わない。
- 容量: Redis `maxmemory 64mb`、`volatile-ttl`。container上限は96MBとする。fallback用in-memory storeは最大100000件とする。
- 障害時: Redis timeout・接続断ではin-memoryへfail-openする。複数process間の完全な抑制は一時的に失われるが、Botコマンド全体は停止しない。この方針を課金、認可、外部費用を守るrate limitへ流用しない。
- observability: Redis状態遷移をログに記録し、終了時にacquired、rejected、fallback、timeoutの総数をIDなしで記録する。

## テストと運用

- unit testでhit/miss、TTL、無効化、破損値、DB fallback、in-memory fallback、key namespaceを確認する。
- 実Redis integration testでAPIのTTL・破損値削除・shutdownと、独立した2接続によるBotクールダウン取得が1件だけ成功することを確認する。
- testはrun固有namespaceと既知のkeyだけを削除し、`KEYS`、`FLUSHDB`、`FLUSHALL`を使わない。
- CIでは一時Redis serviceを使う。Composeの2 instance分離、memory、eviction、network設定は `docker compose config` と対象imageの起動で別途確認する。
- 実MySQLを含む導入前後のquery数とlatencyは配備前に同一条件で測定する。unit testでは連続したlist/resolveがrepository listを1回だけ呼ぶことを確認済みだが、これをproduction latency改善の証拠とは扱わない。

## 結果

Redis障害をAPI・Bot全体から分離しつつ、通常時はキーワード読取をcache-asideで処理し、複数Bot processのクールダウンを原子的に共有できる。運用対象は2 instance増えるため、memory・eviction・状態・fallbackを継続監視する必要がある。
