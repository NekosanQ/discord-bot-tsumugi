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

mkdir -p "$TEST_ROOT/bin" "$TEST_ROOT/env" "$TEST_ROOT/config" "$TEST_ROOT/deployment"
cp "$REPOSITORY_ROOT/deploy/tests/fixtures/docker" "$TEST_ROOT/bin/docker"
cp "$REPOSITORY_ROOT/deploy/tests/fixtures/flock" "$TEST_ROOT/bin/flock"
chmod 700 "$TEST_ROOT/bin/docker" "$TEST_ROOT/bin/flock"

cp "$REPOSITORY_ROOT/deploy/examples/api.env.sample" "$TEST_ROOT/env/api.env"
cp "$REPOSITORY_ROOT/deploy/examples/bot.env.sample" "$TEST_ROOT/env/bot.env"
cp "$REPOSITORY_ROOT/deploy/examples/mysql.env.sample" "$TEST_ROOT/env/mysql.env"
cp "$REPOSITORY_ROOT/deploy/examples/web.env.sample" "$TEST_ROOT/env/web.env"
chmod 600 "$TEST_ROOT/env"/*.env
touch "$TEST_ROOT/config/api.production.toml" "$TEST_ROOT/config/bot.production.toml" "$TEST_ROOT/config/web.production.toml"

export PATH="$TEST_ROOT/bin:$PATH"
export MOCK_DOCKER_LOG="$TEST_ROOT/docker.log"
export MOCK_FAILURE_MARKER="$TEST_ROOT/failure-observed"
export TSUMUGI_DEPLOY_ROOT="$TEST_ROOT/deployment"
export TSUMUGI_ENV_DIR="$TEST_ROOT/env"
export TSUMUGI_CONFIG_DIR="$TEST_ROOT/config"
export TSUMUGI_COMPOSE_FILE="$REPOSITORY_ROOT/compose.production.yml"
export TSUMUGI_COMPOSE_PROJECT_NAME='tsumugi-test'
export TSUMUGI_WEB_BIND_ADDRESS='127.0.0.1'
export TSUMUGI_WEB_HOST_PORT='3001'
export TSUMUGI_HEALTH_TIMEOUT_SECONDS='30'
export TSUMUGI_IMAGE_PREFIX='ghcr.io/example/tsumugi'

first_sha="$(printf 'a%.0s' {1..40})"
second_sha="$(printf 'b%.0s' {1..40})"

export TSUMUGI_IMAGE_SHA="$first_sha"
bash "$REPOSITORY_ROOT/deploy/release.sh" deploy
grep -Fxq "RELEASE_SOURCE_SHA=$first_sha" "$TEST_ROOT/deployment/state/current.env"
[[ ! -e "$TEST_ROOT/deployment/state/previous.env" ]]

bash "$REPOSITORY_ROOT/deploy/release.sh" deploy
grep -Fxq "RELEASE_SOURCE_SHA=$first_sha" "$TEST_ROOT/deployment/state/current.env"
[[ ! -e "$TEST_ROOT/deployment/state/previous.env" ]]

export TSUMUGI_IMAGE_SHA="$second_sha"
export MOCK_FAIL_WEB_DIGEST_SUFFIX='8'
if bash "$REPOSITORY_ROOT/deploy/release.sh" deploy; then
    printf 'Expected candidate health failure to fail the deployment.\n' >&2
    exit 1
fi
unset MOCK_FAIL_WEB_DIGEST_SUFFIX
grep -Fxq "RELEASE_SOURCE_SHA=$first_sha" "$TEST_ROOT/deployment/state/current.env"
[[ ! -e "$TEST_ROOT/deployment/state/previous.env" ]]

export TSUMUGI_IMAGE_SHA="$second_sha"
bash "$REPOSITORY_ROOT/deploy/release.sh" deploy
grep -Fxq "RELEASE_SOURCE_SHA=$second_sha" "$TEST_ROOT/deployment/state/current.env"
grep -Fxq "RELEASE_SOURCE_SHA=$first_sha" "$TEST_ROOT/deployment/state/previous.env"

bash "$REPOSITORY_ROOT/deploy/release.sh" rollback
grep -Fxq "RELEASE_SOURCE_SHA=$first_sha" "$TEST_ROOT/deployment/state/current.env"
grep -Fxq "RELEASE_SOURCE_SHA=$second_sha" "$TEST_ROOT/deployment/state/previous.env"

migration_count="$(grep -c -- '--profile migration run' "$MOCK_DOCKER_LOG")"
[[ "$migration_count" == '3' ]] || {
    printf 'Expected one migration per deploy and none during rollback; got %s.\n' "$migration_count" >&2
    exit 1
}
if find "$TEST_ROOT/deployment/state" -maxdepth 1 -type f -name '.*' -print -quit | grep -q .; then
    printf 'Temporary state files were not cleaned up.\n' >&2
    exit 1
fi

printf 'release lifecycle test passed\n'
