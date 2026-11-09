#!/bin/sh
set -eu
fail() { echo "$1" >&2; exit 1; }
case "${APP_ENV:-}" in dev|prod) ;; *) fail 'APP_ENV must be dev or prod' ;; esac
actor=${UI_DEV_ACTOR:-}
domain=${UI_AUTH_DOMAIN:-}
client=${UI_AUTH_CLIENT_ID:-}
audience=${UI_AUTH_AUDIENCE:-}
if [ -n "$domain$client$audience" ]; then
    [ -z "$actor" ] || fail 'UI_DEV_ACTOR cannot be combined with the Auth0 variables'
    [ -n "$domain" ] && [ -n "$client" ] && [ -n "$audience" ] || fail 'Auth0 needs UI_AUTH_DOMAIN, UI_AUTH_CLIENT_ID and UI_AUTH_AUDIENCE'
    [ "${#domain}" -le 253 ] || fail 'Invalid UI_AUTH_DOMAIN'
    case "$domain" in *[!a-z0-9.-]*|.*|*.|*..*|-*) fail 'Invalid UI_AUTH_DOMAIN' ;; *.*) ;; *) fail 'Invalid UI_AUTH_DOMAIN' ;; esac
    [ "${#client}" -ge 16 ] && [ "${#client}" -le 128 ] || fail 'Invalid UI_AUTH_CLIENT_ID'
    case "$client" in *[!A-Za-z0-9_-]*) fail 'Invalid UI_AUTH_CLIENT_ID' ;; esac
    [ "${#audience}" -le 512 ] || fail 'Invalid UI_AUTH_AUDIENCE'
    case "$audience" in https://?*) ;; *) fail 'UI_AUTH_AUDIENCE must be an https URL' ;; esac
    case "$audience" in *[!A-Za-z0-9._~:/-]*) fail 'Invalid UI_AUTH_AUDIENCE' ;; esac
    printf '{"environment":"%s","identity":{"mode":"auth0","domain":"%s","clientId":"%s","audience":"%s"}}\n' \
        "$APP_ENV" "$domain" "$client" "$audience" > /tmp/app-config.json
elif [ -n "$actor" ]; then
    [ "$APP_ENV" = dev ] || fail 'Dev identity is forbidden in prod'
    [ "${#actor}" -le 128 ] || fail 'Invalid dev actor'
    case "$actor" in *[!A-Za-z0-9._:@\|/-]*) fail 'Invalid dev actor' ;; esac
    case "$actor" in [A-Za-z0-9]*) ;; *) fail 'Invalid dev actor' ;; esac
    printf '{"environment":"dev","identity":{"mode":"dev","actorId":"%s"}}\n' "$actor" > /tmp/app-config.json
else
    printf '{"environment":"%s","identity":{"mode":"disabled"}}\n' "$APP_ENV" > /tmp/app-config.json
fi
exec nginx -g 'daemon off;'
