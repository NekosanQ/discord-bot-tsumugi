#!/usr/bin/env bash

set -Eeuo pipefail

REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_ROOT="$(mktemp -d)"

cleanup() {
    case "$TEST_ROOT" in
        /tmp/* | /var/tmp/* | /private/tmp/*) rm -rf -- "$TEST_ROOT" ;;
        *) printf 'Refusing unsafe test cleanup: %s\n' "$TEST_ROOT" >&2 ;;
    esac
}
trap cleanup EXIT

mkdir -p "$TEST_ROOT/env" "$TEST_ROOT/config"
cp "$REPOSITORY_ROOT/deploy/examples/api.env.sample" "$TEST_ROOT/env/api.env"
cp "$REPOSITORY_ROOT/deploy/examples/bot.env.sample" "$TEST_ROOT/env/bot.env"
cp "$REPOSITORY_ROOT/deploy/examples/mysql.env.sample" "$TEST_ROOT/env/mysql.env"
cp "$REPOSITORY_ROOT/deploy/examples/web.env.sample" "$TEST_ROOT/env/web.env"
cp "$REPOSITORY_ROOT/apps/api/config/example.toml" "$TEST_ROOT/config/api.production.toml"
cp "$REPOSITORY_ROOT/apps/bot/config/example.toml" "$TEST_ROOT/config/bot.production.toml"
cp "$REPOSITORY_ROOT/apps/web/config/example.toml" "$TEST_ROOT/config/web.production.toml"

export TSUMUGI_ENV_DIR="$TEST_ROOT/env"
export TSUMUGI_CONFIG_DIR="$TEST_ROOT/config"
export TSUMUGI_COMPOSE_PROJECT_NAME='tsumugi-compose-test'
export TSUMUGI_WEB_BIND_ADDRESS='127.0.0.1'
export TSUMUGI_WEB_HOST_PORT='43001'
export TSUMUGI_API_IMAGE="ghcr.io/example/tsumugi-api@sha256:$(printf 'a%.0s' {1..64})"
export TSUMUGI_API_MIGRATION_IMAGE="ghcr.io/example/tsumugi-api@sha256:$(printf 'b%.0s' {1..64})"
export TSUMUGI_BOT_IMAGE="ghcr.io/example/tsumugi-bot@sha256:$(printf 'c%.0s' {1..64})"
export TSUMUGI_WEB_IMAGE="ghcr.io/example/tsumugi-web@sha256:$(printf 'd%.0s' {1..64})"

docker compose --file "$REPOSITORY_ROOT/compose.production.yml" --profile migration config --quiet
docker compose --file "$REPOSITORY_ROOT/compose.production.yml" --profile migration config --format json | node --input-type=commonjs -e '
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
    const model = JSON.parse(input);
    for (const name of ["api", "api-migrate", "bot", "web"]) {
        const service = model.services[name];
        if (service.user !== "1000:1000" || !service.read_only || !service.cap_drop.includes("ALL") || !service.security_opt.includes("no-new-privileges:true")) {
            throw new Error(`${name} is missing application hardening`);
        }
    }
    for (const name of ["mysql", "redis-api-cache", "redis-api-security", "redis-bot-cooldown"]) {
        const service = model.services[name];
        if (!service.user || !service.cap_drop.includes("ALL") || !service.security_opt.includes("no-new-privileges:true")) {
            throw new Error(`${name} is missing infrastructure hardening`);
        }
    }
    for (const name of ["mysql", "redis-api-cache", "redis-api-security", "redis-bot-cooldown", "api"]) {
        if (model.services[name].ports) throw new Error(`${name} unexpectedly publishes a host port`);
    }
    for (const name of ["database-network", "api-cache-network", "api-security-network", "bot-cooldown-network"]) {
        if (!model.networks[name].internal) throw new Error(`${name} must remain internal`);
    }
    const botNetworks = new Set(Object.keys(model.services.bot.networks));
    if (Object.keys(model.services.web.networks).some((name) => botNetworks.has(name))) {
        throw new Error("Bot and Web must not share a direct network");
    }
    for (const [name, service] of Object.entries(model.services)) {
        if (service.logging?.driver !== "local" || service.logging.options?.["max-size"] !== "10m" || service.logging.options?.["max-file"] !== "5") {
            throw new Error(`${name} is missing bounded runtime logging`);
        }
    }
});
'

printf 'production Compose test passed\n'
