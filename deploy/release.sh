#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

log() {
    printf '[release] %s\n' "$*" >&2
}

die() {
    log "ERROR: $*"
    exit 1
}

require_command() {
    command -v "$1" >/dev/null 2>&1 || die "Required command is unavailable: $1"
}

require_absolute_directory() {
    local variable_name="$1"
    local value="${!variable_name:-}"
    [[ -n "$value" ]] || die "$variable_name is required."
    [[ "$value" == /* && "$value" != '/' ]] || die "$variable_name must be an absolute directory other than /."
    [[ -d "$value" ]] || die "$variable_name must be preprovisioned before deployment."
}

require_file() {
    local file_path="$1"
    [[ -f "$file_path" && -r "$file_path" ]] || die "Required preprovisioned file is missing or unreadable: $file_path"
}

require_private_file() {
    local file_path="$1"
    local mode
    require_file "$file_path"
    mode="$(stat -c '%a' "$file_path")"
    mode="${mode: -3}"
    if (( (8#$mode & 077) != 0 )); then
        die "Secret-bearing env file must not be group/world accessible: $file_path"
    fi
}

validate_ipv4_address() {
    local value="$1"
    local octets=()
    local octet
    IFS='.' read -r -a octets <<< "$value"
    [[ ${#octets[@]} -eq 4 ]] || return 1
    for octet in "${octets[@]}"; do
        [[ "$octet" =~ ^[0-9]{1,3}$ ]] || return 1
        (( 10#$octet <= 255 )) || return 1
    done
}

validate_environment() {
    local repository_root
    local configured_path
    require_absolute_directory TSUMUGI_DEPLOY_ROOT
    require_absolute_directory TSUMUGI_ENV_DIR
    require_absolute_directory TSUMUGI_CONFIG_DIR

    [[ -f "$TSUMUGI_COMPOSE_FILE" ]] || die 'TSUMUGI_COMPOSE_FILE must point to compose.production.yml.'
    repository_root="$(realpath "$(dirname "$TSUMUGI_COMPOSE_FILE")")"
    for configured_path in "$TSUMUGI_DEPLOY_ROOT" "$TSUMUGI_ENV_DIR" "$TSUMUGI_CONFIG_DIR"; do
        configured_path="$(realpath -m "$configured_path")"
        if [[ "$configured_path" == "$repository_root" || "$configured_path" == "$repository_root/"* ]]; then
            die 'Deployment state, env, and config directories must be outside the checked-out repository.'
        fi
    done
    [[ "$TSUMUGI_COMPOSE_PROJECT_NAME" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || die 'TSUMUGI_COMPOSE_PROJECT_NAME has an invalid value.'
    [[ "$TSUMUGI_WEB_HOST_PORT" =~ ^[0-9]+$ ]] || die 'TSUMUGI_WEB_HOST_PORT must be an integer.'
    (( TSUMUGI_WEB_HOST_PORT >= 1 && TSUMUGI_WEB_HOST_PORT <= 65535 )) || die 'TSUMUGI_WEB_HOST_PORT is outside the TCP port range.'
    validate_ipv4_address "$TSUMUGI_WEB_BIND_ADDRESS" || die 'TSUMUGI_WEB_BIND_ADDRESS must be an explicit IPv4 address.'
    [[ "$TSUMUGI_HEALTH_TIMEOUT_SECONDS" =~ ^[0-9]+$ ]] || die 'TSUMUGI_HEALTH_TIMEOUT_SECONDS must be an integer.'
    (( TSUMUGI_HEALTH_TIMEOUT_SECONDS >= 30 && TSUMUGI_HEALTH_TIMEOUT_SECONDS <= 900 )) || die 'TSUMUGI_HEALTH_TIMEOUT_SECONDS must be between 30 and 900.'

    require_private_file "$TSUMUGI_ENV_DIR/api.env"
    require_private_file "$TSUMUGI_ENV_DIR/bot.env"
    require_private_file "$TSUMUGI_ENV_DIR/mysql.env"
    require_private_file "$TSUMUGI_ENV_DIR/web.env"
    require_file "$TSUMUGI_CONFIG_DIR/api.production.toml"
    require_file "$TSUMUGI_CONFIG_DIR/bot.production.toml"
    require_file "$TSUMUGI_CONFIG_DIR/web.production.toml"
}

compose() {
    docker compose \
        --project-name "$TSUMUGI_COMPOSE_PROJECT_NAME" \
        --project-directory "$TSUMUGI_DEPLOY_ROOT" \
        --file "$TSUMUGI_COMPOSE_FILE" \
        "$@"
}

reset_release_variables() {
    RELEASE_SOURCE_SHA=''
    TSUMUGI_API_IMAGE=''
    TSUMUGI_API_MIGRATION_IMAGE=''
    TSUMUGI_BOT_IMAGE=''
    TSUMUGI_WEB_IMAGE=''
}

validate_digest_reference() {
    [[ "$1" =~ ^ghcr\.io/[a-z0-9._/-]+@sha256:[0-9a-f]{64}$ ]]
}

load_release_file() {
    local file_path="$1"
    local key
    local value
    reset_release_variables
    require_file "$file_path"

    while IFS='=' read -r key value || [[ -n "$key$value" ]]; do
        [[ -n "$key" ]] || continue
        case "$key" in
            RELEASE_SOURCE_SHA)
                [[ -z "$RELEASE_SOURCE_SHA" ]] || die "Duplicate state key in $file_path: $key"
                RELEASE_SOURCE_SHA="$value"
                ;;
            TSUMUGI_API_IMAGE)
                [[ -z "$TSUMUGI_API_IMAGE" ]] || die "Duplicate state key in $file_path: $key"
                TSUMUGI_API_IMAGE="$value"
                ;;
            TSUMUGI_API_MIGRATION_IMAGE)
                [[ -z "$TSUMUGI_API_MIGRATION_IMAGE" ]] || die "Duplicate state key in $file_path: $key"
                TSUMUGI_API_MIGRATION_IMAGE="$value"
                ;;
            TSUMUGI_BOT_IMAGE)
                [[ -z "$TSUMUGI_BOT_IMAGE" ]] || die "Duplicate state key in $file_path: $key"
                TSUMUGI_BOT_IMAGE="$value"
                ;;
            TSUMUGI_WEB_IMAGE)
                [[ -z "$TSUMUGI_WEB_IMAGE" ]] || die "Duplicate state key in $file_path: $key"
                TSUMUGI_WEB_IMAGE="$value"
                ;;
            *) die "Unknown state key in $file_path: $key" ;;
        esac
    done < "$file_path"

    [[ "$RELEASE_SOURCE_SHA" =~ ^[0-9a-f]{40}$ ]] || die "Invalid release SHA in $file_path."
    validate_digest_reference "$TSUMUGI_API_IMAGE" || die "Invalid API digest in $file_path."
    validate_digest_reference "$TSUMUGI_API_MIGRATION_IMAGE" || die "Invalid API migration digest in $file_path."
    validate_digest_reference "$TSUMUGI_BOT_IMAGE" || die "Invalid Bot digest in $file_path."
    validate_digest_reference "$TSUMUGI_WEB_IMAGE" || die "Invalid Web digest in $file_path."

    export TSUMUGI_API_IMAGE TSUMUGI_API_MIGRATION_IMAGE TSUMUGI_BOT_IMAGE TSUMUGI_WEB_IMAGE
}

write_release_file() {
    local file_path="$1"
    local source_sha="$2"
    local api_image="$3"
    local migration_image="$4"
    local bot_image="$5"
    local web_image="$6"
    local temporary_file
    temporary_file="$(mktemp "$STATE_DIRECTORY/.release.XXXXXX")"
    TEMPORARY_FILES+=("$temporary_file")
    {
        printf 'RELEASE_SOURCE_SHA=%s\n' "$source_sha"
        printf 'TSUMUGI_API_IMAGE=%s\n' "$api_image"
        printf 'TSUMUGI_API_MIGRATION_IMAGE=%s\n' "$migration_image"
        printf 'TSUMUGI_BOT_IMAGE=%s\n' "$bot_image"
        printf 'TSUMUGI_WEB_IMAGE=%s\n' "$web_image"
    } > "$temporary_file"
    chmod 600 "$temporary_file"
    mv -f -- "$temporary_file" "$file_path"
}

resolve_pulled_digest() {
    local tagged_reference="$1"
    local repository="${tagged_reference%%:sha-*}"
    local candidate
    local resolved=''

    while IFS= read -r candidate; do
        if [[ "$candidate" == "$repository@sha256:"* ]]; then
            resolved="$candidate"
            break
        fi
    done < <(docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' "$tagged_reference")

    validate_digest_reference "$resolved" || die "Unable to resolve an immutable digest for $repository."
    printf '%s\n' "$resolved"
}

prepare_candidate_release() {
    local image_prefix="${TSUMUGI_IMAGE_PREFIX,,}"
    local source_sha="$TSUMUGI_IMAGE_SHA"
    local api_tag
    local migration_tag
    local bot_tag
    local web_tag
    local api_digest
    local migration_digest
    local bot_digest
    local web_digest

    [[ "$source_sha" =~ ^[0-9a-f]{40}$ ]] || die 'TSUMUGI_IMAGE_SHA must be a full lowercase Git SHA.'
    [[ "$image_prefix" =~ ^ghcr\.io/[a-z0-9._/-]+$ ]] || die 'TSUMUGI_IMAGE_PREFIX must be an untagged GHCR repository prefix.'

    api_tag="$image_prefix-api:sha-$source_sha"
    migration_tag="$image_prefix-api:sha-$source_sha-migration"
    bot_tag="$image_prefix-bot:sha-$source_sha"
    web_tag="$image_prefix-web:sha-$source_sha"

    log "Pulling the four immutable artifacts for source $source_sha."
    docker pull "$api_tag" >/dev/null
    docker pull "$migration_tag" >/dev/null
    docker pull "$bot_tag" >/dev/null
    docker pull "$web_tag" >/dev/null

    api_digest="$(resolve_pulled_digest "$api_tag")"
    migration_digest="$(resolve_pulled_digest "$migration_tag")"
    bot_digest="$(resolve_pulled_digest "$bot_tag")"
    web_digest="$(resolve_pulled_digest "$web_tag")"
    write_release_file "$CANDIDATE_FILE" "$source_sha" "$api_digest" "$migration_digest" "$bot_digest" "$web_digest"
}

wait_for_service() {
    local service="$1"
    local deadline=$((SECONDS + TSUMUGI_HEALTH_TIMEOUT_SECONDS))
    local container_id
    local container_status
    local health_status

    while (( SECONDS < deadline )); do
        container_id="$(compose ps -q "$service" 2>/dev/null || true)"
        if [[ -n "$container_id" ]]; then
            container_status="$(docker inspect --format '{{.State.Status}}' "$container_id" 2>/dev/null || true)"
            health_status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id" 2>/dev/null || true)"
            if [[ "$container_status" == 'running' && "$health_status" == 'healthy' ]]; then
                return 0
            fi
            if [[ "$container_status" == 'dead' || "$container_status" == 'exited' ]]; then
                log "$service stopped before becoming healthy. Inspect its redacted logs on the target host."
                return 1
            fi
        fi
        sleep 2
    done

    log "$service did not become healthy within ${TSUMUGI_HEALTH_TIMEOUT_SECONDS}s."
    return 1
}

verify_web_api_boundary() {
    local container_id
    container_id="$(compose ps -q web)"
    [[ -n "$container_id" ]] || return 1
    log 'Verifying the server-side Web-to-API proxy boundary.'
    docker exec "$container_id" node -e '
fetch("http://127.0.0.1:3001/api/dashboard/session")
    .then(async (response) => {
        if (!response.ok) process.exit(1);
        const body = await response.json();
        if (typeof body.authenticated !== "boolean") process.exit(1);
    })
    .catch(() => process.exit(1));
' >/dev/null 2>&1
}

start_infrastructure() {
    log 'Starting MySQL and the three isolated Redis instances.'
    compose up --detach --no-build mysql redis-api-cache redis-api-security redis-bot-cooldown
    wait_for_service mysql
}

run_migration_once() {
    log "Applying API-owned migrations once for source $RELEASE_SOURCE_SHA."
    if ! compose --profile migration run --rm --no-deps --no-TTY api-migrate >/dev/null 2>&1; then
        log 'Migration failed. Application containers were not advanced.'
        return 1
    fi
}

start_applications() {
    log "Starting API, Bot, and Web for source $RELEASE_SOURCE_SHA."
    compose up --detach --no-build --remove-orphans api bot web
    wait_for_service api
    wait_for_service bot
    wait_for_service web
    verify_web_api_boundary
}

ensure_release_images() {
    local image_reference
    log "Ensuring all digest-pinned images are available for source $RELEASE_SOURCE_SHA."
    for image_reference in "$TSUMUGI_API_IMAGE" "$TSUMUGI_API_MIGRATION_IMAGE" "$TSUMUGI_BOT_IMAGE" "$TSUMUGI_WEB_IMAGE"; do
        if ! docker image inspect "$image_reference" >/dev/null 2>&1; then
            docker pull "$image_reference" >/dev/null
        fi
    done
}

activate_release_without_migration() {
    ensure_release_images
    compose config --quiet
    start_infrastructure
    start_applications
}

activate_candidate_release() {
    ensure_release_images
    compose config --quiet
    start_infrastructure
    run_migration_once
    start_applications
}

restore_release_after_failure() {
    local restore_file="$1"
    if [[ -f "$restore_file" ]]; then
        log 'Activation failed; restoring the previously healthy image set without reversing database migrations.'
        load_release_file "$restore_file"
        if (set -Eeuo pipefail; activate_release_without_migration); then
            log 'Previous image set restored.'
        else
            log 'Automatic restoration also failed. The saved current state was not changed.'
        fi
    else
        log 'Initial activation failed; stopping partially started application containers.'
        compose stop api bot web >/dev/null 2>&1 || true
    fi
}

commit_deployment_state() {
    local current_temporary
    local previous_temporary=''
    current_temporary="$(mktemp "$STATE_DIRECTORY/.current.XXXXXX")" || return 1
    TEMPORARY_FILES+=("$current_temporary")
    cp -- "$CANDIDATE_FILE" "$current_temporary" || return 1
    chmod 600 "$current_temporary" || return 1

    if [[ -f "$CURRENT_FILE" ]]; then
        previous_temporary="$(mktemp "$STATE_DIRECTORY/.previous.XXXXXX")" || return 1
        TEMPORARY_FILES+=("$previous_temporary")
        cp -- "$CURRENT_FILE" "$previous_temporary" || return 1
        chmod 600 "$previous_temporary" || return 1
    fi

    if [[ -n "$previous_temporary" ]]; then
        mv -f -- "$previous_temporary" "$PREVIOUS_FILE" || return 1
    fi
    mv -f -- "$current_temporary" "$CURRENT_FILE" || return 1
}

replace_state_file() {
    local source_file="$1"
    local target_file="$2"
    local temporary_file
    temporary_file="$(mktemp "$STATE_DIRECTORY/.state.XXXXXX")"
    TEMPORARY_FILES+=("$temporary_file")
    cp -- "$source_file" "$temporary_file"
    chmod 600 "$temporary_file"
    mv -f -- "$temporary_file" "$target_file"
}

cleanup_temporary_files() {
    local file_path
    for file_path in "${TEMPORARY_FILES[@]:-}"; do
        if [[ -n "$file_path" && "$file_path" == "$STATE_DIRECTORY/".* ]]; then
            rm -f -- "$file_path"
        fi
    done
}

deploy_release() {
    local restore_file=''
    local activation_status
    [[ -n "${TSUMUGI_IMAGE_PREFIX:-}" ]] || die 'TSUMUGI_IMAGE_PREFIX is required for deploy.'
    [[ -n "${TSUMUGI_IMAGE_SHA:-}" ]] || die 'TSUMUGI_IMAGE_SHA is required for deploy.'
    [[ "$TSUMUGI_IMAGE_SHA" =~ ^[0-9a-f]{40}$ ]] || die 'TSUMUGI_IMAGE_SHA must be a full lowercase Git SHA.'

    if [[ -f "$CURRENT_FILE" ]]; then
        load_release_file "$CURRENT_FILE"
        if [[ "$RELEASE_SOURCE_SHA" == "$TSUMUGI_IMAGE_SHA" ]]; then
            log "Source $TSUMUGI_IMAGE_SHA is already current; reconciling containers without rerunning migrations."
            activate_release_without_migration
            return 0
        fi
        restore_file="$(mktemp "$STATE_DIRECTORY/.restore.XXXXXX")"
        TEMPORARY_FILES+=("$restore_file")
        cp -- "$CURRENT_FILE" "$restore_file"
    elif [[ -f "$PREVIOUS_FILE" ]]; then
        die 'Deployment state is inconsistent: previous exists without current.'
    fi

    prepare_candidate_release
    load_release_file "$CANDIDATE_FILE"
    set +e
    (set -Eeuo pipefail; activate_candidate_release)
    activation_status=$?
    set -e
    if (( activation_status != 0 )); then
        restore_release_after_failure "$restore_file"
        return "$activation_status"
    fi

    set +e
    commit_deployment_state
    activation_status=$?
    set -e
    if (( activation_status != 0 )); then
        log 'State commit failed after activation; restoring the prior release.'
        restore_release_after_failure "$restore_file"
        return "$activation_status"
    fi
    log "Deployment completed for source $RELEASE_SOURCE_SHA."
}

rollback_release() {
    local failed_release
    local rollback_target
    local activation_status
    [[ -f "$CURRENT_FILE" ]] || die 'No current release state exists.'
    [[ -f "$PREVIOUS_FILE" ]] || die 'No previous release state exists.'

    load_release_file "$CURRENT_FILE"
    failed_release="$(mktemp "$STATE_DIRECTORY/.failed.XXXXXX")"
    rollback_target="$(mktemp "$STATE_DIRECTORY/.rollback.XXXXXX")"
    TEMPORARY_FILES+=("$failed_release" "$rollback_target")
    cp -- "$CURRENT_FILE" "$failed_release"
    cp -- "$PREVIOUS_FILE" "$rollback_target"

    load_release_file "$rollback_target"
    set +e
    (set -Eeuo pipefail; activate_release_without_migration)
    activation_status=$?
    set -e
    if (( activation_status != 0 )); then
        restore_release_after_failure "$failed_release"
        return "$activation_status"
    fi

    replace_state_file "$rollback_target" "$CURRENT_FILE"
    replace_state_file "$failed_release" "$PREVIOUS_FILE"
    log "Rollback completed to source $RELEASE_SOURCE_SHA. Database migrations were not reversed."
}

main() {
    local operation="${1:-}"
    require_command docker
    require_command flock
    require_command stat
    require_command mktemp
    require_command realpath

    TSUMUGI_COMPOSE_FILE="${TSUMUGI_COMPOSE_FILE:-}"
    TSUMUGI_COMPOSE_PROJECT_NAME="${TSUMUGI_COMPOSE_PROJECT_NAME:-tsumugi}"
    TSUMUGI_WEB_BIND_ADDRESS="${TSUMUGI_WEB_BIND_ADDRESS:-}"
    TSUMUGI_WEB_HOST_PORT="${TSUMUGI_WEB_HOST_PORT:-}"
    TSUMUGI_HEALTH_TIMEOUT_SECONDS="${TSUMUGI_HEALTH_TIMEOUT_SECONDS:-180}"
    export TSUMUGI_COMPOSE_FILE TSUMUGI_COMPOSE_PROJECT_NAME TSUMUGI_WEB_BIND_ADDRESS TSUMUGI_WEB_HOST_PORT
    export TSUMUGI_DEPLOY_ROOT TSUMUGI_ENV_DIR TSUMUGI_CONFIG_DIR

    validate_environment
    mkdir -p -- "$TSUMUGI_DEPLOY_ROOT" "$TSUMUGI_DEPLOY_ROOT/state"
    chmod 700 "$TSUMUGI_DEPLOY_ROOT/state"
    STATE_DIRECTORY="$TSUMUGI_DEPLOY_ROOT/state"
    CURRENT_FILE="$STATE_DIRECTORY/current.env"
    PREVIOUS_FILE="$STATE_DIRECTORY/previous.env"
    CANDIDATE_FILE="$(mktemp "$STATE_DIRECTORY/.candidate.XXXXXX")"
    TEMPORARY_FILES=("$CANDIDATE_FILE")
    trap cleanup_temporary_files EXIT

    exec 9> "$STATE_DIRECTORY/release.lock"
    flock -n 9 || die 'Another deployment or rollback is already running.'
    docker compose version >/dev/null

    case "$operation" in
        deploy) deploy_release ;;
        rollback) rollback_release ;;
        *) die 'Usage: release.sh deploy|rollback' ;;
    esac
}

main "$@"
