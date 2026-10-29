# Snippet Searcher UI

UI de la cátedra basada en React, MUI, Vite y React Query 3, integrada mediante Axios con la API pública de Snippets.

## Origen y ramas

Fork del equipo: [JJT-INGSIS/snippet-searcher-ui](https://github.com/JJT-INGSIS/snippet-searcher-ui).
Origen: [austral-ingsis/printscript-ui](https://github.com/austral-ingsis/printscript-ui), revisión `8ac3338873602e5263365670cd3b88d48202365e`.
Se conserva su historial y el remoto `upstream`. `origin` apunta al fork.

`dev` es la rama predeterminada del equipo; `main` queda para promoción posterior.
La integración inicial SNI-34 está integrada en `dev`. SNI-35 mejora su presentación y usabilidad en `feat/sni-35-ui-usability`.
Al abrir una PR desde este fork, elegir **base repository JJT-INGSIS/snippet-searcher-ui, base dev**.

## Abrir la UI — uso diario del equipo

Con el backend local levantado y la configuración inicial preparada, abrir una terminal **en el repo `snippet-searcher-ui`**:

```powershell
cd C:\dev\ingsis\snippet-searcher\snippet-searcher-ui
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Abrir **http://127.0.0.1:5173/** en el navegador de esa misma computadora.
Dejar la terminal abierta. **Ctrl+C en esa terminal detiene la UI**; cerrar la pestaña no la detiene.
La UI y el backend son procesos separados. No hace falta encender las VMs de Azure.

**[Paso a paso completo para el equipo: preparación, backend, UI, pruebas y apagado](docs/local-development.md).**

## Preparación inicial de la UI

Usar Node 24 LTS (probado con 24.19.0) y npm. No requiere credenciales de paquetes. Los scripts de instalación permitidos en package.json están fijados a las versiones del lockfile de Cypress y esbuild; no se cambia la configuración global de npm.

```powershell
cd C:\dev\ingsis\snippet-searcher\snippet-searcher-ui
npm ci
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Revisar antes `UI_DEV_ACTOR` y `API_PROXY_TARGET` en `.env.local`, según la guía. Abrir http://127.0.0.1:5173/.
El servidor queda limitado a loopback.
`npm run build` genera `dist/`; `npm run preview` sirve ese build sin el proxy de desarrollo.

## API, proxy y configuración pública

El navegador llama únicamente a **`/api` bajo su mismo origen**. No llama directamente a Permissions, PrintScript ni Asset.
Vite reenvía `/api/snippets` a `http://127.0.0.1:8080/snippets`, eliminando `/api`.
`API_PROXY_TARGET` cambia solo el destino del proxy local; no se incorpora al bundle.

El despliegue usa NGINX de entrada con la misma regla (SNI-38). CORS de Spring corresponde a SNI-41.
[Imagen, configuración runtime y despliegue independiente — SNI-42](docs/sni-42-deployment.md).

Al iniciar, la UI carga **`/app-config.json` con `cache: no-store`**.
Ese archivo contiene configuración pública, nunca secretos, y puede reemplazarse al desplegar el mismo bundle en cada ambiente.
Debe servirse sin caché por NGINX; no reemplazarlo por el fallback de la SPA.

Configuración segura incluida en `public/app-config.json`:

```json
{"environment":"prod","identity":{"mode":"disabled"}}
```

No se habilita identidad por una URL, una query string o el tipo de build.
Para un dev protegido del equipo, la configuración pública puede ser:

```json
{"environment":"dev","identity":{"mode":"dev","actorId":"dev-juanfran"}}
```

El servidor Vite genera ese archivo localmente **solo** si se define `UI_DEV_ACTOR` en `.env.local`.
Sin ese valor, la identidad queda deshabilitada. Reiniciar Vite después de cambiarlo.
Los IDs acordados del directorio son `dev-juan`, `dev-juanfran`, `dev-thiago`, `dev-ana` y `dev-bruno`.

El cliente agrega `X-Dev-Actor-Id` a operaciones protegidas; `GET /languages` es público.
**Esto no es autenticación**: el backend debe habilitarlo solo con perfil Spring `dev`, en un ambiente de acceso restringido.
El cliente rechaza configuración de identidad dev en `environment=prod`; esto no sustituye la protección del servidor.
Auth0 no está implementado en esta entrega: no se monta un provider vacío ni se simula un login.
La incorporación futura del token se concentra en el cliente Axios y la inicialización de identidad.

## Contratos e implementación

Fuente: [contrato SNI-26 de Snippets](https://github.com/JJT-INGSIS/snippets-service/blob/dev/docs/ui-integration.md),
[lecturas](https://github.com/JJT-INGSIS/snippets-service/blob/dev/docs/reading.md),
[sharing](https://github.com/JJT-INGSIS/snippets-service/blob/dev/docs/sharing.md).

| Operación | Pedido | Respuesta del adaptador |
| --- | --- | --- |
| Crear / subir archivo | POST /snippets, JSON e Idempotency-Key | Metadatos confirmados, sin contenido ni capacidades |
| Actualizar | PUT /snippets/{id}, reemplazo completo | Metadatos confirmados |
| Listar | GET /snippets con filtros y page/page_size | Descriptores sin contenido |
| Detalle | GET /snippets/{id} | Código y capacidades de lectura/edición/sharing |
| Destinatarios | GET /users, primera página 0 | Usuarios y count |
| Compartir | PUT /snippets/{id}/shares/{userId}, sin body | {snippetId, userId}, sin fabricar un Snippet |
| Lenguajes | GET /languages | Lenguaje, extensión y versiones entregadas por backend |

Las firmas de `SnippetOperations` y hooks representan esas respuestas reales. La recomendación antigua de convertir un share en un Snippet queda reemplazada por el acknowledgment tipado.

`content` se traduce a `code`. Se envían solo name, description, language, version y code.
Descripción null y string vacío se conservan como valores distintos; el código no se recorta ni normaliza en el adaptador.
Subir archivos usa su texto y el mismo POST JSON, sin multipart ni un segundo endpoint.
No se hace GET dentro de una mutación para fabricar un detalle completo.

`GET /languages` está implementado en el backend por SNI-54. No hay catálogo ni versiones de fallback.
Si falta, falla o responde fuera de contrato, se informa y no se habilita una creación sin lenguaje/versión válidos.
Elegir la versión es obligatorio. No se deduce de la extensión ni se escoge automáticamente.

## Estado confirmado y reintentos

- Un alta obtiene un UUID de idempotencia por intención lógica. El formulario conserva un snapshot inmutable de actor y datos.
- No hay reintentos automáticos de mutaciones en React Query.
- Ante timeout, desconexión, error técnico o confirmación inválida, se conserva la clave y se bloquea editar ese pedido.
  El usuario puede reintentar explícitamente la misma creación, incluso después de cerrar y reabrir el modal.
- Al confirmarse, termina esa intención. Un nuevo alta obtiene otra clave. Ante rechazo conocido de validación, se conserva el formulario para corregirlo.
- La intención vive **en memoria de la página**: no se promete recuperación después de recargar, cerrar la pestaña o abrir otra.
  No crear otra alta a ciegas si se perdió esa información después de un resultado incierto.
- PUT y sharing son idempotentes según el contrato. No se informa un share exitoso antes de recibir su confirmación.
- Los errores conservan el tipo estable de Problem Details, status, field/parameter y diagnósticos rule/message/line/column.
  Un fallo técnico nunca se convierte en lista vacía, código inválido ni éxito.
- Las consultas incluyen actor, recurso, filtros y página en su clave. El catálogo no depende del actor.
- Después de una mutación confirmada se invalidan lista/detalle por separado.
  Un GET de refresco fallido no convierte ese guardado en fallido. No hay actualizaciones optimistas de permisos.
- Un refresco de detalle no pisa el borrador que se está editando. Cerrar y reabrir carga el detalle nuevamente.
- El backend sigue autorizando cada operación. La UI utiliza capabilities para bloquear edición/sharing de solo lectura.

SNI-50 conecta creación/listado de definiciones de tests por snippet mediante HTTP.
Ver [contrato, decisiones y verificación](docs/sni-50-test-definitions.md).
Ejecución, edición/borrado de tests, reglas, formateo y borrado de snippets permanecen
deshabilitados; no se fabrican resultados ni éxitos.
El Fake fue retirado. Se conservan los componentes provistos para esas historias futuras, pero no se montan sus flujos simulados.
La descarga original existente utiliza el código leído; no implementa descarga de código formateado ni US13.

## Pruebas reproducibles

```powershell
npm run lint
npm test
npm run build
```

`npm test`: Vitest, mapeos, configuración, errores, idempotencia y servidor HTTP local de contrato.
No necesita Docker ni backend. El sandbox de algunas herramientas puede impedir conexiones de loopback; ejecutarlo en una terminal local normal.

En otra terminal con Vite iniciado:

```powershell
npm run test:contracts
```

Cypress prueba los componentes de la cátedra y los hooks HTTP: creación y reintento, upload, diagnóstico,
catálogo no disponible, solo lectura, guardado con refresco fallido y sharing con fallo/reintento.
SNI-35 agrega búsqueda, cancelación/respuestas tardías, paginación y recuperación por cambios del total,
errores y reintento, borradores durante refrescos, editor persistente, mobile, foco y mensajes temporales.
Intercepta contratos pendientes. **No demuestra que esos endpoints existan en el backend**.
Se reemplazaron las pruebas upstream que suponían respuestas POST completas y login no implementado.

### Backend real: prueba separada y explícita

Con el Compose local de infra levantado, Snippets en puerto 8080 y Vite iniciado:

```powershell
npm run test:backend
npm run test:browser:backend
```

El primer comando verifica rutas implementadas: POST 201, reintento 200 con mismo UUID, conflicto 409, PUT 200 y parser inválido 422 con diagnósticos,
usando el adaptador y el proxy `/api`. Deja un snippet local con nombre `SNI-34 adapter smoke ...`; no llama VMs.
No se ejecuta automáticamente en CI ni necesita credenciales para probar las imágenes locales ya disponibles.

El segundo recorre el navegador contra respuestas reales, sin stubs: catálogo, upload `.PRS`, versión explícita,
alta, listado, búsqueda y resultado vacío. Deja un snippet `SNI-35-browser-...` y capturas ignoradas por Git en
`cypress/screenshots/`. Ambas pruebas requieren identidad `dev-juanfran`; no ejecutarlas contra producción.
Si Snippets se ejecuta fuera de Compose en otro puerto, definir `API_PROXY_TARGET` antes de iniciar Vite.

| Flujo | Evidencia de SNI-34 |
| --- | --- |
| Adaptador POST/PUT e idempotencia | Verificado contra backend local real |
| Formularios de alta/upload/edición | Integración de navegador con respuestas de contrato |
| Listado, detalle, lenguajes, destinatarios, sharing público | Implementados en UI y probados contra contratos pendientes |
| Autorización real de lecturas y sharing + storage oficial | Aceptación pendiente de SNI-29/30/31/32 y SNI-36 |
| Transporte HTTPS/NGINX/CORS | SNI-38/40/41/44, fuera de esta prueba |

Ver [evidencia y límites](docs/sni-34-validation.md). No declarar US5–7 completas ni marcar la aceptación real por el resultado de Cypress.

## Diseño y usabilidad — SNI-35

- Tema claro: fondo gris suave, superficies blancas, acento azul de Sportmatch y azul oscuro para acciones con texto blanco.
- Geist Sans para la interfaz y Geist Mono en el editor oscuro. Fuentes locales, licencia SIL OFL en `public/fonts/LICENSE.txt`;
  origen y revisión documentados en [validación SNI-35](docs/sni-35-validation.md).
- MUI sigue resolviendo botones, diálogos, foco y estilos. No se incorporaron Tailwind, Base UI ni otro sistema de componentes.
- `Home` compone el listado; `useSnippetList` controla filtros/paginación. El contador se deriva del `count` del servidor,
  incluido cero. Nombre con debounce de 350 ms; las lecturas cancelables usan `AbortSignal` y claves por contexto.
- `useSnippetCreation` y `useSnippetEditor` coordinan los formularios; componentes compartidos presentan errores,
  estados vacíos, diálogos y código. Se mantiene el snapshot de idempotencia y el bloqueo inmediato de envíos repetidos.
- La tabla puede desplazarse horizontalmente dentro de su contenedor en móvil; los filtros y formularios se apilan.
  Tab sale del editor, los controles tienen etiquetas y los diálogos devuelven el foco al cerrarse.
- Los mensajes visibles están en español. Un error no se presenta como lista vacía y un refresco fallido no niega un guardado confirmado.

Ver [cambios, comandos, evidencia real y límites](docs/sni-35-validation.md).

## Próximas extensiones

El CI frontend y el CD usan los workflows centrales `v0.6.2`. La versión fija
las herramientas corregidas de infra para recuperación/reapply (SNI-44), sin
cambiar el build frontend ni el despliegue independiente por digest. Actualizar
todos los callers del ambiente y esperar ejecuciones activas antes de reaplicar
infraestructura; no reejecutar herramientas antiguas sobre el stack ampliado.

- SNI-54 ya verifica el catálogo GET /languages; SNI-35 lo consume sin datos inventados.
- Listado, destinatarios, detalle y edición ya fueron verificados localmente con Permissions. Sharing público sigue pendiente de aceptación real.
- SNI-36 completa la aceptación con los endpoints pendientes y storage oficial; el éxito de los contratos no sustituye esa prueba.
- Auth0, lint y ejecución se incorporan en sus tickets; no agregar fake success para avanzar.
  Las definiciones de tests de SNI-50 requieren los endpoints reales de SNI-46;
  las pruebas de contrato de UI no acreditan esa integración backend.
- Revisar las dependencias heredadas del upstream antes del despliegue de la UI. Este cambio no hace una migración general de framework ni un audit fix forzado.

Validación de código vacío: [SNI-55](docs/empty-code.md).
