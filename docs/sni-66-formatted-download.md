# SNI-66 — Descargar la variante formateada desde el detalle

El detalle del snippet ya tiene **Descargar original**, que arma el archivo con el
código guardado. Este ticket agrega **Descargar formateado**, que pide al backend la
variante formateada vigente y la descarga con la extensión real del lenguaje.

Estado: **en desarrollo.**

## Contrato que consume

`GET /api/snippets/{id}/formatted` de snippets-service
([contrato](https://github.com/JJT-INGSIS/snippets-service/blob/dev/docs/formatted-download.md)),
con el `X-Dev-Actor-Id` de la configuración, igual que el resto de la app.

| Campo | Uso en la UI |
| --- | --- |
| `name`, `extension` | Nombre del archivo: `<nombre>-formateado.<extensión>` |
| `code` | Contenido del archivo, UTF-8 tal cual |
| `source` | `stored` o `on-demand`; solo se valida, no se muestra |
| `snippetId`, `language`, `version`, revisiones | Se validan para no descargar la respuesta de otro snippet |

La respuesta se parsea de forma estricta: si falta un campo, tiene otro tipo o es de
otro snippet, se muestra un error y no se descarga nada.

## Pantalla

| Situación | Comportamiento |
| --- | --- |
| Al abrir el detalle | No pide nada: la variante se pide recién al tocar el botón |
| Tocar **Descargar formateado** | El botón muestra "Preparando…" y se deshabilita hasta la respuesta |
| `200` | Se descarga `<nombre>-formateado.<ext>` y se libera la URL Blob |
| Error | Alerta debajo de los botones con el motivo; **Descargar original** sigue andando |
| Cambios sin guardar en el editor | Aviso "Se descarga la versión guardada, sin tus cambios sin guardar" |
| Reintento | Tocar de nuevo el botón; no hay reintento automático |

## Errores

| Respuesta | Mensaje |
| --- | --- |
| `404 snippet-not-found` | El snippet no existe o no tenés acceso |
| `409 formatting-stale` | El snippet cambió mientras se preparaba; volvé a intentarlo |
| `422 unformattable-code` | El código tiene errores que impiden formatearlo, con los diagnósticos |
| `422 invalid-formatting-rules` | Las reglas de formato del propietario ya no son válidas |
| `422 formatting-limit-exceeded` | El código o el resultado superan el tamaño permitido |
| `502`, `503`, sin respuesta | No se pudo preparar ahora; volvé a intentarlo |

## Archivo

| Regla | Detalle |
| --- | --- |
| Tipo | `text/plain;charset=utf-8` |
| Unicode | El contenido viaja como texto UTF-8 sin transformaciones |
| URL Blob | Se crea al descargar y se libera enseguida después del clic |
| Original | **Descargar original** no cambia: sigue usando el código del detalle |

## Decisiones

Las decisiones V1–V8 son las del backend, aprobadas por Juan el 03/11/2026. En la UI
aplican V1 (JSON y Blob), V6 (botón, pedido al tocar, nombre del archivo y aviso de
borrador) y V7 (owner y lector reciben lo mismo).

## Verificación

Pendiente.
