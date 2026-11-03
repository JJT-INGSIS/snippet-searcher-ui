# SNI-65 — Reglas de formato y progreso del reprocesamiento en la UI

Implementación en `feat/sni-65-formatting-rules-ui`, desde `dev`. Reemplaza el
aviso de "todavía no disponible" de **Reglas** por la configuración real de formato
(US11) y muestra el avance del reprocesamiento de los snippets (US12). Deja un
contrato y utilidades de polling que el lint (SNI-67) reutiliza sin duplicarlos.

Estado: **propuesto y aprobado; implementación en curso.** La aceptación con el lote
real y Redis es SNI-75.

## Contrato que consume

Todas las rutas pasan por `/api` (proxy de Vite en local, NGINX desplegado), con el
cliente Axios y la identidad runtime existentes. El navegador no habla con Redis,
PrintScript ni Permissions.

| Ruta | Uso |
| --- | --- |
| `GET /api/languages` | Lenguajes y versiones para elegir el ámbito |
| `GET /api/formatting-rules/{language}/{version}` | Catálogo real con el valor vigente de cada regla del actor |
| `PUT /api/formatting-rules/{language}/{version}` con `{"rules":{id: valor}}` | Reemplaza toda la selección del actor |
| `GET /api/jobs/{jobId}` | Progreso del reprocesamiento (SNI-58) |

Respuesta de las reglas (SNI-61, ver `snippets-service/docs/formatting-rules.md`):
`{language, version, revision, changed, jobId, rules: [{id, type, default, minimum,
maximum, conflictsWith, description, value}]}`. `type` es `boolean` o `integer`.
Una booleana apagada vale `false`; una numérica apagada vale `null`.

Progreso: `{id, status, processed, failed, pending, selectionComplete}`. Estados:
`PENDING`, `RUNNING`, `RETRY`, `UNKNOWN` (en curso) y `COMPLETED`, `PARTIAL`,
`FAILED`, `SUPERSEDED` (terminales).

| Error | Cómo se muestra |
| --- | --- |
| `422 invalid-formatting-rules` con `violations` | Junto a cada regla afectada, más un resumen; el borrador queda intacto |
| `422 unsupported-language` / `unsupported-version` | "Este lenguaje o versión no tiene formato" |
| `502 dependency-failure` | PrintScript no respondió; se puede reintentar |
| `503 metadata-unavailable` | La base no está disponible; se puede reintentar |
| `401` | Identidad ausente, como en el resto de la app |
| `404` en `/jobs/{id}` | El progreso no está disponible para este actor |
| Sin respuesta | No se sabe si se guardó; se ofrece reintentar el mismo guardado |

`toApiError` incorpora `violations` (`{rule, reason}`) a `ApiProblem`; lint las reutiliza.

## Pantalla

**Reglas** tiene un selector de lenguaje y versión y dos pestañas: **Formato** (este
ticket) y **Lint** (mantiene el aviso hasta SNI-67).

| Tipo de regla | Control |
| --- | --- |
| `boolean` | Switch prendida/apagada |
| `integer` | Switch "activar" + campo numérico entero dentro del mínimo y máximo del catálogo |

Cada regla muestra su descripción del catálogo y, si corresponde, con qué reglas no
se puede combinar. Los defaults salen del catálogo; la UI no los inventa.

## Borrador y guardado

| Situación | Comportamiento |
| --- | --- |
| Al abrir | Solo lee; nunca guarda al montar |
| Editar | Cambia un borrador local por actor + lenguaje + versión; "Guardar" se habilita si difiere de lo guardado |
| Guardar | Manda la selección completa; sin reintento automático; deshabilitado mientras está pendiente |
| Éxito con `changed:true` | El borrador pasa a ser lo guardado y arriba aparece el progreso del `jobId` |
| Éxito con `changed:false` | "Las reglas ya tenían esos valores. No hay nada para reformatear." |
| `422` u otro error | El borrador se conserva; cada regla muestra su violación y la alerta lista "Reglas rechazadas" |
| Sin respuesta | "No recibimos confirmación del servidor"; botón "Reintentar guardado", seguro porque el `PUT` reemplaza todo y repetirlo no crea otro trabajo |
| Error al refrescar | Se conservan el borrador y la última configuración confirmada |
| Cambiar de lenguaje/versión con cambios sin guardar | Pide confirmación antes de descartarlos |
| Descartar cambios | Vuelve a la configuración guardada |

El éxito actualiza la caché del ámbito con la respuesta del `PUT`, sin otro `GET`.

## Progreso

"Guardada" y "procesando" son estados distintos. Guardar responde enseguida; el
reprocesamiento sigue en segundo plano y no bloquea la navegación.

| Estado del trabajo | Mensaje |
| --- | --- |
| `PENDING`, `RUNNING`, `RETRY`, `UNKNOWN` | "Reformateando tus snippets" — "Listos: N; pendientes: M" (y "todavía buscando snippets" si la selección no terminó) |
| `COMPLETED` | "Listo" — "Reformateados: N snippets." |
| `PARTIAL` | "Terminó con fallos" — "Reformateados: N; sin poder formatear: F." |
| `FAILED` | "No se pudo completar" — "Tus reglas siguen guardadas." |
| `SUPERSEDED` | "Reemplazado" — "Un cambio de reglas más nuevo continúa el reprocesamiento." |

Polling acotado y cancelable:

| Regla | Valor |
| --- | --- |
| Intervalo | 3 s |
| Corte | Estado terminal, o 10 min desde que empezó; después, botón "Actualizar progreso" |
| Segundo plano | No consulta con la pestaña del navegador oculta |
| Error al consultar | Deja de consultar y ofrece "Actualizar progreso"; al responder, el polling sigue |
| Cancelación | Al desmontar o cambiar de actor/ámbito se aborta la consulta en curso |

El `jobId` queda en la caché por actor + lenguaje + versión: navegar por la app y
volver retoma el seguimiento. Al recargar la página se pierde (el `GET` de reglas no
devuelve el último trabajo); la configuración guardada no se pierde.

## Utilidades compartidas con lint (SNI-67)

| Pieza | Para qué |
| --- | --- |
| `utils/jobs`: tipo `JobProgress` y parseo estricto del DTO | Mismo contrato para `FormattingRulesChanged` y `LintRulesChanged` |
| Claves `['jobs', actor, jobId]` | Caché separada por identidad |
| `useJobProgress({jobId, startedAt})` y `JobProgressPanel` | Polling acotado y cancelable, con su panel |
| Política de polling como función pura | Testeable sin React |
| Presentación de estados | Mismos mensajes para formato y lint |
| `violations` en `ApiProblem` | Errores por regla para ambas configuraciones |

Formato no espera a lint ni al revés: SNI-67 se conecta cuando su backend esté.

## Decisiones

Aprobadas por Juan el 02/11/2026 («dale, aprobadas las 8»).

| # | Decisión | Alternativa descartada | Costo aceptado |
| --- | --- | --- | --- |
| U1 | Selector de lenguaje/versión y pestañas Formato / Lint | Secciones apiladas | — |
| U2 | Editor tipado por el catálogo real; reemplaza `FormattingRulesList` | Adaptar el catálogo al `Rule` provisto | `LintingRulesList` y `Rule` quedan sin usar hasta SNI-67 |
| U3 | El navegador solo valida lo que dicta el catálogo (enteros dentro del rango); el proveedor decide el resto | Replicar conflictos y rangos para bloquear el guardado | Un conflicto se ve recién al guardar |
| U4 | Borrador por actor y ámbito; guardado completo sin reintento automático; reintento manual explícito | Descartar el borrador ante un error | — |
| U5 | Polling cada 3 s, corte a los 10 min; `jobId` en caché por actor y ámbito | Que el `GET` devuelva el último trabajo | Al recargar se pierde el seguimiento |
| U6 | Utilidades de trabajos y `violations` compartidas | Un polling por pantalla | — |
| U7 | Reemplazar `getFormatRules`/`modifyFormatRule` y borrar `FormattingRulesList` | Dejar convivir lo viejo | Posible conflicto chico con la #13 (SNI-69) |
| U8 | PR aparte en snippets-service para registrar `/formatting-rules` en CORS | Dejarlo anotado | — |

## Verificación

| Qué | Resultado |
| --- | --- |
| Vitest | 124 pruebas: DTOs estrictos, borrador, límites, política de polling, presentación de estados, `violations` y un servidor HTTP de contrato (lectura, guardado, 422, guardado incierto, codificación del ámbito, progreso y cancelación) |
| Cypress (contratos) | 4 casos nuevos en `formatting-rules.cy.ts`; la suite completa da 35/35 |
| Lint y build | Verdes |
| Backend real, Compose local | Catálogo real de PrintScript 1.1; un conflicto (`enforce-spacing-around-equals` + `enforce-no-spacing-around-equals`) vuelve como 422 y se marca en ambas reglas; el guardado crea el trabajo y la UI muestra "Reformateando" |
| Backend real con Redis y workers | Copia aislada de `dev` con el overlay de Redis y `SNIPPETS_OUTBOX_ENABLED`/`SNIPPETS_WORKER_ENABLED`: el trabajo llega a `COMPLETED`, la UI muestra "Reformateados: 1 snippet." y el contenido derivado queda formateado (`let x:number = 1 + 2;`) |

Límites:

- En el Compose por defecto los workers están apagados (SNI-56), así que el trabajo queda en `PENDING` y la UI sigue mostrando "Reformateando" hasta los 10 minutos.
- En Docker Desktop, `compose.redis.yaml` no levanta por el `tmpfs` con opciones (`/run/redis:rw,noexec,nosuid,size=1m`); para la prueba se reemplazó por `/run/redis`.
- La separación por actor y la vista mobile no tienen contrato Cypress propio; Vitest cubre que las claves de trabajos se separan por actor y que el pedido lleva `X-Dev-Actor-Id`.
- El panel de progreso queda arriba de las reglas; con muchas reglas, después de guardar hay que subir para verlo.
