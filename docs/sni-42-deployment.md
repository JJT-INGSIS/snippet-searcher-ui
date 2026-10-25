# SNI-42 — Imagen y despliegue independiente de UI

## Contrato de ejecución

La imagen linux/amd64 compila con Node 24.19.0 y sirve estáticos con NGINX,
ambos oficiales fijados por digest. El runtime usa UID 101, puerto 8080 y /tmp
para configuración/pid/temporales; funciona con filesystem de sólo lectura y
tmpfs en /tmp. No contiene Node, node_modules, .env, credenciales o endpoints
de ambiente. No se actualizan dependencias de la aplicación en este ticket.

NGINX de entrada enruta / a ui:8080 y /api/ a Snippets. El servidor UI sólo sirve
estáticos y navegación SPA; no llama a Permissions, PrintScript ni Asset. Rutas
/api y archivos estáticos inexistentes responden 404, sin simular éxito HTML.

## Configuración pública al arrancar

`APP_ENV=dev|prod` (default prod) y `UI_DEV_ACTOR` opcional generan
/tmp/app-config.json, servido en /app-config.json como JSON con Cache-Control:
no-store. El bundle no cambia al pasar de ambiente. La imagen no ejecuta Vite.

Sin actor, la identidad está deshabilitada. Un actor sólo se acepta en dev:
identificador público ASCII de 1–128 caracteres, inicial alfanumérica y resto
alfanumérico o `._:@|/-`, compatible con los IDs dev del directorio. Espacios,
controles y comillas se rechazan sin imprimir el valor. No habilita autenticación.
En prod un actor no vacío impide el arranque; Auth0 sigue pendiente y las
operaciones que requieren identidad no se acreditan como funcionales en prod.

Infra registra el actor opcional en `ui.dev_actor`; reaplicar y rollback preservan
esa configuración. No pasar una variable suelta que desaparezca al reaplicar.

## Pruebas locales

Desde este repo, con Docker Desktop Linux abierto:

```powershell
npm run lint
npm test
npm run build
npm run test:container
```

La última prueba construye una imagen temporal, ejecuta el mismo artefacto en dev
y prod, comprueba identidad/configuración, bundle idéntico, usuario no root,
SPA/404 y rechazo de configuración inválida. Retira sólo sus contenedores e imagen.
Para reutilizar una imagen ya construida, definir UI_TEST_IMAGE; esa imagen no se
borra. No se usan VMs, datos de negocio ni el .env local dentro del build.

Integración de transporte con la UI real y NGINX real, desde infra:

```powershell
docker build --platform linux/amd64 -t snippet-searcher-ui:sni42-local ../snippet-searcher-ui
python -B scripts/verify_ui_ingress.py snippet-searcher-ui:sni42-local
```

Usa upstream API controlado para probar ruteo y errores; no acredita historias de
negocio. El perfil Compose `ui`, junto a `ingress`, permite usar el backend real:

```powershell
docker compose --profile ui --profile ingress up --build -d
```

Configurar antes el .env de infra según su README; UI_DEV_ACTOR sólo si se necesita
identidad dev explícita. Abrir http://localhost:8088/. Sin ese actor no se simula
una sesión. El procedimiento Vite de desarrollo diario sigue disponible.

## Pipeline y evidencia

pipeline.yml reemplaza ci.yaml, conservando el nombre Run UI Checks y el check
build como agregador de PR: success de CI es el único resultado aceptable.
frontend-ci.yml del central ejecuta npm ci, lint, tests, build y Cypress de
contratos; en PR también prueba el contenedor. El push construye la imagen
publicada una sola vez en CD. No se ejecuta Gradle.

El caller exige CI antes de cd.yml. Dev publica en
ghcr.io/jjt-ingsis/snippet-searcher-ui; main selecciona el digest verificado para
su Git tree exacto, sin rebuild. La evidencia exige workflow original exitoso,
frontend-ci.yml y cd.yml de la misma revisión central y job Frontend CI realmente
completado con éxito. CI omitido/cancelado/fallido no sirve como evidencia.

## Primera instalación y habilitación

1. Seguir la [integración v0.6.0](https://github.com/JJT-INGSIS/github-workflows/blob/main/docs/sni-43-integration.md).
2. Mantener CD_ENABLED=false en UI hasta instalarla. Dev puede publicar la primera
   imagen sin intentar actualizar un servicio inexistente.
3. Con los callers nuevos y la VM preparada, incorporar ese digest usando plan
   de infra --ui-image; configurar actor únicamente para dev. Revisar/aplicar
   mediante --infrastructure bajo el lock compartido, sin alterar otras imágenes.
4. Configurar Environment dev: SSH_HOST/USER/PORT y secrets SSH_PRIVATE_KEY,
   SSH_KNOWN_HOSTS; usar el mismo contrato SSH estricto que los backends.
5. Habilitar CD_ENABLED y ejecutar el pipeline dev para comprobar actualización
   independiente/evidencia. El despliegue inicial no equivale a esa evidencia.
6. Para prod, proteger main y exigir PR dev→main; configurar Environment prod,
   manteniendo PROD_DEPLOY_ENABLED=false hasta la primera instalación. Ésta exige
   el árbol aprobado en main y el digest comprobado en dev.

Después de instalar/verificar UI en prod y comprobar la protección, habilitar
PROD_DEPLOY_ENABLED y ejecutar su pipeline de main. Dev puede seguir habilitado
durante esta preparación: el caller usa ambos controles para producción.
No introducir un camino de publicación desde main ni fabricar evidencia para
superar la primera instalación. Mantener la VM del ambiente encendida durante CD.

Recuperación/manuales: [infra SNI-43](https://github.com/JJT-INGSIS/snippet-searcher-infra/blob/dev/docs/sni-43-cd.md).
Las funcionalidades frontend pendientes no bloquean publicar el mecanismo común;
la aceptación funcional y el ingreso HTTPS real siguen SNI-36/SNI-44.
