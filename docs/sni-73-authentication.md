# SNI-73 — Login con Auth0 y llamadas autenticadas

La UI inicia sesión con el SDK oficial de Auth0 (Universal Login + Authorization Code
con PKCE) y manda el access token de Snippets en todas las llamadas a la API: Axios y
el `fetch` de NDJSON de las ejecuciones. Sigue el
[contrato compartido de SNI-71](https://github.com/JJT-INGSIS/snippet-searcher-infra/blob/dev/docs/architecture/authentication-authorization-contract.md).

Estado: **en desarrollo.**

La barrera real es el backend validando el token (SNI-72). Lo que hace la UI evita
mostrar o pedir datos sin sesión y no filtra credenciales, pero en un navegador el
código se puede modificar: ninguna medida de esta página reemplaza esa validación.

## Configuración runtime

`app-config.json` se genera al arrancar el contenedor (o lo sirve Vite en local). La
misma imagen sirve para cualquier ambiente; no hay secretos en el frontend.

| Modo | Forma | Cuándo |
| --- | --- | --- |
| `auth0` | `{"mode":"auth0","domain":"…","clientId":"…","audience":"https://…"}` | DEV y PROD con login real |
| `dev` | `{"mode":"dev","actorId":"dev-juan"}` | Solo con `"environment":"dev"`; manda `X-Dev-Actor-Id` y nunca un token |
| `disabled` | `{"mode":"disabled"}` | Sin identidad |

| Campo | Validación |
| --- | --- |
| `domain` | Solo nombre de host en minúsculas (sin `https://`, puerto ni ruta) |
| `clientId` | Letras, números, `-` y `_`, entre 16 y 128 caracteres |
| `audience` | URL absoluta `https://`, sin usuario, contraseña, query ni fragmento |

El callback (`/auth/callback`) y el retorno del logout (`/`) salen del origin de la
página: no se configuran, así no se puede apuntar a otro sitio. Una configuración
incompleta o inválida muestra el error de configuración; nunca cae a otro modo.

| Variable del contenedor | Uso |
| --- | --- |
| `UI_AUTH_DOMAIN`, `UI_AUTH_CLIENT_ID`, `UI_AUTH_AUDIENCE` | Modo `auth0`; las tres juntas |
| `UI_DEV_ACTOR` | Modo `dev`; solo con `APP_ENV=dev` y nunca junto con las de Auth0 |

En local, Vite toma las mismas variables al levantar `npm run dev`.

Valores públicos de DEV ([SNI-71](https://github.com/JJT-INGSIS/snippet-searcher-infra/blob/dev/auth0/development.public.json)):

| Parámetro | Valor |
| --- | --- |
| Domain | `jjt-snippet-searcher.us.auth0.com` |
| Client ID SPA | `BDuvRyQ6ryyye08Bs9ZEfRzw7AsskFs6` |
| Audience | `https://jjt-snippets-dev.duckdns.org/api` |
| Origins permitidas | `http://127.0.0.1:5173`, `https://jjt-snippets-dev.duckdns.org` |

En local hay que abrir la app en `http://127.0.0.1:5173` (no `localhost`), porque es el
origin registrado en Auth0.

## Sesión

| Situación | Comportamiento |
| --- | --- |
| Abrir cualquier ruta | "Verificando tu sesión…" hasta que el SDK resuelve |
| Sin sesión | Pantalla de bienvenida con "Iniciar sesión" y "Crear cuenta"; no se crea el cliente de la API ni se pide ningún dato |
| Iniciar sesión | Universal Login de Auth0 y vuelta a `/auth/callback` |
| Callback | "Completando el inicio de sesión…"; al terminar vuelve a la ruta pedida, solo si está en la lista permitida (`/`, `/rules`); si no, a `/` |
| Error del callback | Mensaje fijo según el código (`access_denied` u otro), con "Volver a intentar" e "Ir al inicio" |
| Con sesión | La app normal, con el usuario y "Cerrar sesión" en la barra |
| Token vencido o 401 | Diálogo "Tu sesión venció" sobre la pantalla actual, sin perder lo escrito; volver a entrar abre un popup |
| Popup bloqueado | Se ofrece entrar con redirección, avisando que lo no guardado se pierde |
| Cerrar sesión | Se sueltan las ejecuciones en curso solo en local, se vacía la caché y después Auth0 cierra la sesión y vuelve a `/` |
| Otro usuario en el popup | Se trata como cambio de usuario: la app se vuelve a montar vacía para el nuevo |
| Ruta desconocida | "No encontramos esa página" |

El access token dura 15 minutos y no hay refresh tokens. El SDK renueva el token usando
la sesión de Auth0; si necesita interacción (por ejemplo, el navegador bloquea cookies
de terceros), aparece el diálogo de sesión vencida.

## Transporte

| Regla | Detalle |
| --- | --- |
| Token por pedido | Se pide al SDK en cada llamada, nunca se guarda al construir Axios o `fetch` |
| Mismo proveedor | Axios y el `fetch` de eventos, inputs, cancelación y progreso usan la misma pieza (`RequestIdentity`) |
| Solo a la API propia | El token solo se adjunta a rutas relativas bajo `/api`; un pedido a una URL absoluta sale sin token |
| `/languages` | Público, como en el contrato |
| Sin persistencia | El token vive en la memoria del SDK: ni `localStorage`, ni URL, ni logs, ni claves de caché |
| 401 | Abre el diálogo de sesión vencida; ninguna mutación se reintenta sola |
| Sin token | Si el SDK no puede dar un token, el pedido no se manda |

## Identidad local

El actor local es `issuer|sub`. Las claves de caché ya llevan el actor, así que dos
usuarios nunca comparten datos en caché. Al cerrar sesión o cambiar de usuario:

1. Las ejecuciones en curso se sueltan en local, sin pedir la cancelación al servidor.
2. Se cancelan las consultas en curso y se vacía la caché de React Query.
3. La app se vuelve a montar para el nuevo actor: borradores e intenciones de creación
   del usuario anterior se descartan, así una creación incierta nunca se retoma bajo
   otra identidad.

## Seguridad

| Riesgo | Medida |
| --- | --- |
| Entrar a una ruta sin sesión | Todas las rutas pasan por la puerta de sesión; sin sesión no hay cliente de API |
| Redirección abierta después del login | Solo rutas de la lista permitida; `//host`, `https:`, `javascript:`, `\` o codificadas vuelven a `/` |
| Callback manipulado | El SDK valida `state`, `nonce` y PKCE; solo se procesa en `/auth/callback`; los errores no muestran texto de la URL |
| Código en historial o `Referer` | La URL del callback se reemplaza al terminar; `Referrer-Policy: same-origin` |
| Robo del token | Solo en memoria y sin refresh tokens |
| Token a otro dominio | Solo a rutas relativas de `/api` |
| Saltear el login por configuración | `dev` solo con `environment: dev`, sin token; configuración inválida es un error; no existe modo de prueba en el código |
| Datos del usuario anterior | Caché vaciada y app montada de nuevo por actor |
| Clickjacking y sniffing | `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff` |

## Decisiones

Aprobadas por Juan el 09/11/2026 («dale, aprobadas las 10»).

| # | Decisión | Alternativa descartada | Costo aceptado |
| --- | --- | --- | --- |
| A1 | Modo `auth0` en la configuración runtime, validado; callback y logout fijos sobre el origin | Variables al compilar | Tres variables por ambiente |
| A2 | SDK oficial, Universal Login + PKCE, token en memoria, sin refresh tokens | Token en `localStorage` | Recargar depende de la sesión de Auth0 |
| A3 | Puerta de sesión en todas las rutas, callback aparte y 404 propia | Ocultar botones | Una pantalla más |
| A4 | Destino después del login desde una lista cerrada | Aceptar cualquier ruta interna | Rutas nuevas se agregan a la lista |
| A5 | `RequestIdentity` única para Axios y NDJSON, token pedido por llamada | Capturar el token al arrancar | Una llamada al SDK por pedido |
| A6 | Diálogo de sesión vencida con popup que conserva lo escrito; redirección como alternativa | Redirigir siempre | Popup |
| A7 | Actor `issuer|sub`; logout y cambio de usuario sueltan ejecuciones en local, vacían caché y remontan | Recargar la página | Se separa "soltar" de "cancelar" en `ExecutionSession` |
| A8 | Pantallas consistentes con la app: bienvenida, carga, callback, error, 404, menú de usuario y etiqueta de dev | Pantalla mínima | Más pantallas |
| A9 | Headers de seguridad en el nginx de la UI | CSP completa | La CSP completa queda como tarea aparte |
| A10 | Tests con Auth0 simulado a nivel de red, sin modo de prueba en la app; login real con el tenant DEV | Modo de prueba en la app | Tests más complejos |

## Verificación

| Qué | Resultado |
| --- | --- |
| Vitest | 258 pruebas: configuración `auth0` (14 formas inválidas rechazadas), lista de destinos (14 intentos de redirección rechazados), `RequestIdentity` (token por pedido, errores que piden login, 401), mensajes, y un servidor de contrato que verifica el `Bearer` en Axios y en cada operación NDJSON, `/languages` sin token, ningún token a URLs absolutas, 401 sin reintento y "soltar" una ejecución sin cancelarla en el servidor |
| Cypress (contratos) | 8 casos nuevos en `authentication.cy.ts` con Auth0 simulado a nivel de red (`auth0Network.ts`), sin modo de prueba en la app: bienvenida sin pedidos a la API, login con `code` + PKCE `S256` y vuelta a `/rules`, callback falsificado rechazado sin ecos de la URL, login cancelado, logout que limpia y no muestra datos del usuario anterior al siguiente, 401 que conserva el borrador sin repetir el guardado, 404 y configuración insegura. Suite completa 55/55 |
| Contenedor | `npm run test:container`: la misma imagen en dev, prod y prod con Auth0, mismo bundle, headers de seguridad presentes y 8 configuraciones inválidas que no arrancan |
| Tenant real DEV | El botón "Iniciar sesión" abre Universal Login de `snippet-searcher-dev-ui` sin error de callback, client ID ni origin (sin ingresar credenciales) |

Pendiente: login, logout y renovación con un usuario real, que hace Juan con el tenant DEV.
La aceptación contra Snippets validando tokens es SNI-74, cuando SNI-72 esté integrado; hasta
entonces el backend en modo dev responde 401 a los pedidos con `Bearer`, y la UI muestra el
diálogo de sesión vencida.
