# SNI-67 — Configurar lint y mostrar cumplimiento y diagnósticos

Completa la UI de US14 (reglas de lint del actor) y de US5–6 (cumplimiento real en
listado y detalle). Reutiliza lo que dejaron SNI-65 y SNI-66: selector de ámbito,
confirmación de cambios sin guardar, polling de trabajos, panel de progreso,
`violations` en los errores y parseo estricto de las respuestas.

Estado: **en desarrollo.**

## Contratos que consume

Todos con el `X-Dev-Actor-Id` de la configuración, como el resto de la app.

### Reglas de lint (SNI-63, SNI-77)

`GET` y `PUT /api/linting-rules/{language}/{version}`
([contrato](https://github.com/JJT-INGSIS/snippets-service/blob/dev/docs/linting-rules.md)).

| Campo | Uso en la UI |
| --- | --- |
| `revision`, `changed`, `jobId` | Igual que formato: `jobId` se sigue con el panel de progreso |
| `rules[].id` | Nombre visible de la regla (el catálogo no trae descripción) |
| `rules[].type` | `boolean`, `integer` o `choice`; elige el control |
| `rules[].acceptsNull` | Si es `true`, la regla admite "Sin valor" |
| `rules[].choices` | Opciones de una regla `choice` |
| `rules[].conflictsWith` | Reglas con las que no se combina |
| `rules[].value` | Valor actual; sin configuración guardada son los defaults del proveedor |

`PUT` manda la selección completa en `{"rules":{id: valor}}`. Una selección vacía
`{}` es válida y apaga todas las reglas: no vuelve a los defaults. Los errores son
los de formato, con `422 invalid-linting-rules` y sus `violations`.

### Cumplimiento en listado y detalle (SNI-64)

`GET /api/snippets` y `GET /api/snippets/{id}`
([contrato](https://github.com/JJT-INGSIS/snippets-service/blob/dev/docs/reading.md)).
Cada snippet trae `lint`:

| Campo | Uso en la UI |
| --- | --- |
| `status` | `compliant`, `not-compliant`, `pending` o `failed` |
| `reason` | Motivo de `pending` (`NOT_EVALUATED`, `SUPERSEDED`) o de `failed` |
| `diagnostics` | Infracciones: `rule`, `message`, `line`, `column` |
| `codeHash`, `rulesRevision`, `processorRevision` | Se validan; no se muestran |

El listado acepta `lint` (filtro por estado) y `sort=lint`. Si el backend no puede
verificar el linter responde `502`: se muestra como error, nunca como lista vacía
ni como cumplimiento. `not-implemented` ya no existe y se rechaza.

### Progreso del lote (SNI-58)

`GET /api/jobs/{id}`, el mismo contrato y la misma utilidad que formato.

## Reglas: pestaña Lint de `/rules`

| Tipo de regla | Control |
| --- | --- |
| `boolean` | Switch prendida/apagada |
| `choice` | Select con las opciones del catálogo; "Sin valor" si `acceptsNull` |
| `integer` | Campo numérico entero; "Sin valor" si `acceptsNull` |

| Situación | Comportamiento |
| --- | --- |
| Ámbito | Selector propio de lenguaje y versión, independiente de la pestaña Formato |
| Al abrir | Solo lee; muestra los valores actuales o los defaults del proveedor |
| Editar | Cambia un borrador por actor + lenguaje + versión |
| Guardar | Selección completa, sin reintento automático, deshabilitado mientras está pendiente |
| `changed:true` | Empieza el seguimiento del lote de lint |
| `changed:false` | "Las reglas ya tenían esos valores. No hay nada para reevaluar." |
| `422` | El borrador se conserva; cada regla muestra su violación |
| Sin respuesta | "Reintentar guardado", seguro porque el `PUT` reemplaza todo |
| Cambiar de ámbito con cambios | Pide confirmación |

Los rangos y las combinaciones los valida solo el servidor: el catálogo de lint no
publica mínimos ni máximos. Cada actor configura solo sus reglas; las de un snippet
compartido son las de su propietario y no se editan desde acá.

## Progreso

Mismo polling que formato: cada 3 s, corte en estado terminal, ante un error o a los
10 minutos, y "Actualizar progreso" después. Los textos cambian según el tipo de lote:

| Estado | Formato | Lint |
| --- | --- | --- |
| En curso | "Reformateando tus snippets" | "Evaluando lint de tus snippets" |
| `COMPLETED` | "Reformateados: N snippets." | "Evaluados: N snippets." |
| `PARTIAL` | "…sin poder formatear: F." | "…sin poder evaluar: F." |

Cuando un lote de lint termina, se refrescan el listado y el detalle del actor para
que muestren los resultados nuevos.

## Listado

| Estado | Etiqueta |
| --- | --- |
| `compliant` | Sin infracciones |
| `not-compliant` | Con infracciones |
| `pending` + `NOT_EVALUATED` | Sin evaluar |
| `pending` + `SUPERSEDED` | Desactualizado |
| `failed` | No se pudo evaluar |

Se suman el filtro **Lint** (todos o un estado) y la opción **Lint** en "Ordenar por".
El orden por lint del backend es alfabético por estado, no por gravedad. Cambiar el
filtro vuelve a la primera página. Debounce, conteo, paginación, actor y cancelación
de pedidos se mantienen.

## Detalle

Una sección **Lint** debajo del código muestra el estado, el motivo y cada infracción
como `regla: mensaje (línea:columna)`.

| Situación | Comportamiento |
| --- | --- |
| Snippet compartido | "Evaluado con las reglas del propietario" |
| `SUPERSEDED` | "El resultado anterior quedó desactualizado y se está reevaluando"; sin diagnósticos |
| `failed` | Motivo traducido; no se muestra como infracción |
| Cambios sin guardar | Aviso: el resultado es de la versión guardada |
| Refresco | Actualiza el resultado sin pisar el borrador del editor |

## Motivos de `failed`

| Motivo | Texto |
| --- | --- |
| `CODE_NOT_ANALYZABLE` | El código tiene errores que impiden analizarlo |
| `RULES_NO_LONGER_VALID` | Las reglas guardadas ya no son válidas para esta versión |
| `CODE_TOO_LARGE`, `DIAGNOSTICS_TOO_LARGE` | El código o el resultado superan el tamaño permitido |
| `UNSUPPORTED_LANGUAGE`, `UNSUPPORTED_VERSION` | El lenguaje o la versión no tienen lint |
| Otros (`STORAGE_UNAVAILABLE`, `DEFAULTS_UNAVAILABLE`, `PROCESSOR_UNVERIFIABLE`, `LINT_UNAVAILABLE`) | No se pudo evaluar por un problema técnico; se reintenta al guardar o con el próximo lote |

## Decisiones

Aprobadas por Juan el 06/11/2026.

| # | Decisión | Alternativa descartada | Costo aceptado |
| --- | --- | --- | --- |
| L1 | Pestaña Lint con selector y borrador propios; reutiliza `RuleScopePicker`, `DiscardChangesDialog` y `JobProgressPanel` | Un selector compartido entre pestañas | Elegir el ámbito dos veces |
| L2 | Editor tipado por el catálogo real (switch, select, entero; "Sin valor" si `acceptsNull`) | Adaptar el `Rule` provisto | Cada regla se ve por su id |
| L3 | Guardado como en formato: selección completa, sin reintento automático, borrador conservado, violaciones por regla | Validar rangos en la UI | Un rango inválido se ve al guardar |
| L4 | `describeJob` y `JobProgressPanel` reciben el tipo de lote; al terminar uno de lint se refrescan listado y detalle | Duplicar el panel | Se toca código de SNI-65 |
| L5 | DTO de lint estricto con motivo y diagnósticos; se quita `not-implemented` | Aceptar `not-implemented` | Un backend viejo falla en vez de mostrarse |
| L6 | Filtro y orden por lint en el listado, sin cambiar debounce, conteo, paginación ni cancelación | Filtrar en el navegador | — |
| L7 | Sección Lint en el detalle con motivo y diagnósticos; avisos de compartido y de borrador | Calcular lint en el navegador | — |
| L8 | PR chico en snippets-service con CORS para `/linting-rules/*/*` | Dejarlo anotado | Un PR más |

Además se reemplazan `getLintingRules`/`modifyLintingRule` y se borra
`LintingRulesList`, como se hizo con formato en SNI-65.

## Aceptación (SNI-37)

La aceptación con proveedores reales es SNI-37, preparada por Thiago. Esta entrega
tiene que dejar disponibles: catálogo real, guardado, no-op y progreso; filtro y orden
`lint` con los cuatro estados; motivo y diagnósticos vigentes en el detalle; y errores
de dependencia visibles como error.

## Verificación

Pendiente.
