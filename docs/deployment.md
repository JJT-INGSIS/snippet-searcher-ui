# Despliegue de la UI

El [Dockerfile](../Dockerfile) compila el bundle con Node 24 y lo sirve con NGINX como `101:101` en el puerto `8080`. `GET /healthz` comprueba el servidor estático. El NGINX de ingreso envía `/api` a Snippets. El NGINX del contenedor sirve la SPA, el callback y la configuración pública.

## Configuración de identidad

Al iniciar, `start-ui.sh` genera `/app-config.json`. NGINX y la UI lo sirven y consumen sin caché. La imagen sirve el mismo bundle en DEV y PROD. Configurá las variables públicas del ambiente:

| Variable | Uso |
| --- | --- |
| `APP_ENV` | `dev` o `prod`. |
| `UI_AUTH_DOMAIN` | Dominio del tenant Auth0, sin protocolo. |
| `UI_AUTH_CLIENT_ID` | Client ID público de la SPA del ambiente. |
| `UI_AUTH_AUDIENCE` | Audience de la API del ambiente. |
| `UI_DEV_ACTOR` | Actor local de desarrollo. Sólo disponible en DEV y sin variables de Auth0. |

Sin configuración de identidad queda en modo `disabled`. El contenedor rechaza configuración Auth0 incompleta o combinada con el actor dev. Auth0 requiere las URLs aprobadas del ambiente, incluido `/auth/callback`. El SDK mantiene el access token en memoria. Axios y fetch NDJSON usan el mismo mecanismo de identidad para requests protegidos.

## New Relic Browser

La UI inicializa el agente sólo en el origen HTTPS exacto de DEV o PROD, con Auth0 y en `/` o `/rules` sin query ni fragmento. Cada ambiente reporta a su propia entidad. Están habilitados Page Views, timings y errores JavaScript. AJAX, cookies, distributed tracing, session replay y session trace están deshabilitados. La aplicación puede arrancar aunque falle la carga del agente. [Configuración de Browser](../src/observability/startNewRelicBrowser.ts)

## Publicación y promoción

El [pipeline](../.github/workflows/pipeline.yml) usa los workflows reutilizables `v0.6.8`. Las PRs a `dev` y `main` verifican la UI. Los pushes y ejecuciones manuales en `dev` publican la imagen después del CI y despliegan con `CD_ENABLED=true`. En `main`, la promoción usa el digest verificado en DEV y requiere también `PROD_DEPLOY_ENABLED=true`. [Operación de infraestructura](https://github.com/JJT-INGSIS/snippet-searcher-infra#readme)
