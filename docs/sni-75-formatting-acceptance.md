# SNI-75 — Aceptación preparada, pendiente de proveedores

Estado al 02/11/2026: procedimiento preparado. **No ejecutado ni aceptado**:
faltan entregas de infraestructura Redis, lote de formato, UI y descarga
(SNI-56/62/65/66). No se sustituyen esas entregas ni se aprueban usando mocks.

## Preparación segura

1. Registrar SHAs/digests exactos de UI, Snippets, PrintScript, Permissions,
   Asset y Redis. Confirmar que SNI-56/62/65/66 estén integrados y sus contratos
   publicados. Usar el Compose de infra de esa revisión; no copiar credenciales
   ni inventar rutas de descarga/progreso mientras falten los contratos.
2. Crear un proyecto local aislado, volúmenes propios y namespace Redis exclusivo.
   Usar identidad dev explícita: owner dev-thiago, lector dev-ana, tercero
   dev-bruno. Guardar el ID de cada dato con prefijo `SNI75-<fecha>-<uuid>`.
3. Ejecutar UI y proveedores reales. No interceptar `/api`, PrintScript,
   Permissions ni Asset; sólo se admite configurar identidad de desarrollo.
4. Preparar al menos tres snippets del owner con diferencias de formato reales
   aceptadas por el catálogo publicado, y uno de otro owner para probar alcance.
   Compartir uno con el lector. Registrar el original UTF-8 y su SHA-256 antes
   de cada operación. No usar reglas inventadas ni confundir parser con formato.

## Matriz obligatoria

| Caso | Acción | Evidencia exigida |
| --- | --- | --- |
| Configuración | Guardar reglas reales desde UI y repetir sin cambios | Config/revisión/job registrados; respuesta no espera el lote; no-op según contrato |
| Alcance | Observar el lote hasta terminal | Sólo owner/lenguaje/versión afectados; procesados/pendientes/fallidos coherentes |
| Original | Descargar original como owner y lector | Bytes/hash iguales al original, incluso después del lote |
| Derivado | Descargar formateado vigente como owner y lector | Formato coincide con el motor real y revisión; nombre/extensión correctos |
| Tercero | Acceder directamente a detalle/descarga/progreso | Denegación según contrato; no entrega bytes ni avance privado |
| Interrupción | Detener sólo worker o Redis del proyecto durante un lote | Progreso durable antes/después; recuperación sin repetir efectos lógicos |
| Reentrega | Reentregar el mismo evento por el mecanismo de pruebas del contrato | Sin nuevos elementos lógicos ni incremento doble del progreso |
| Falla individual | Inducir indisponibilidad acotada de un blob propio del fixture | Original conservado, item técnico distinto de éxito, otros items avanzan |
| Carrera de código | Editar un snippet mientras se procesa el derivado anterior | Derivado viejo nunca se ofrece como actual; original nuevo intacto |
| Carrera de reglas | Guardar nuevas reglas durante el primer lote | La revisión nueva no es sobrescrita por resultados anteriores |
| Presupuesto | Mantener una ejecución interactiva real y ejecutar el lote | Admisión respeta presupuesto común; sesión manual sigue operativa |

## Evidencia y cierre

Por caso: fecha, revisiones, IDs, comandos/acción UI, resultado esperado/obtenido,
HTTP relevante, consultas de sólo lectura a jobs/items y captura de navegador.
Registrar duración de guardar y duración del lote por separado, sin inventar SLA.
No capturar secretos ni copiar código de usuarios ajenos al fixture.

Reutilizar guías de recuperación de SNI-58 y contratos de SNI-61/62/66: esta
aceptación no define otro algoritmo ni otro sistema de progreso. Si no hay UI
pública interactiva, usar integración interna real y declarar el límite de US10.

Un criterio obligatorio fallido o pendiente impide cerrar SNI-75. Apagar sólo
procesos/contenedores del proyecto aislado, conservando volúmenes; nunca borrar
recursos previos para ocultar fallos. No habilitar features ni encender VMs de
Azure como parte de esta preparación.
