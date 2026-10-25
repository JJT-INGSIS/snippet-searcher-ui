#!/bin/sh
set -eu
case "${APP_ENV:-}" in dev|prod) ;; *) echo 'APP_ENV must be dev or prod' >&2; exit 1 ;; esac
actor=${UI_DEV_ACTOR:-}
if [ -n "$actor" ]; then
    [ "$APP_ENV" = dev ] || { echo 'Dev identity is forbidden in prod' >&2; exit 1; }
    # Deployment identifiers are public ASCII IDs, not arbitrary JSON or credentials.
    [ "${#actor}" -le 128 ] || { echo 'Invalid dev actor' >&2; exit 1; }
    case "$actor" in *[!A-Za-z0-9._:@\|/-]*) echo 'Invalid dev actor' >&2; exit 1 ;; esac
    case "$actor" in [A-Za-z0-9]*) ;; *) echo 'Invalid dev actor' >&2; exit 1 ;; esac
    printf '{"environment":"dev","identity":{"mode":"dev","actorId":"%s"}}\n' "$actor" > /tmp/app-config.json
else
    printf '{"environment":"%s","identity":{"mode":"disabled"}}\n' "$APP_ENV" > /tmp/app-config.json
fi
exec nginx -g 'daemon off;'
