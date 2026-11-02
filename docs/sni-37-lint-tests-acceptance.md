# SNI-37 — Aceptación preparada, pendiente de integración

Estado al 02/11/2026: **no aceptado**. Requiere SNI-63/64 y UI SNI-67 integrados,
además de proveedores reales. El catálogo de SNI-60 todavía debe exponer defaults
para respetar la decisión aprobada en SNI-63. Tests manuales ya implementados no
acreditan por sí solos cumplimiento de lint.

## Preparación

Registrar SHAs/digests y contratos públicos de las entregas integradas. Ejecutar
UI, Snippets, Permissions, PrintScript, PostgreSQL, Redis y Asset reales, con
volúmenes/namespace aislados y actores dev-thiago (owner), dev-ana (lector) y
dev-bruno (tercero). Crear datos `SNI37-<fecha>-<uuid>` y guardar sus IDs.
No simular respuestas de backend ni modificar datos existentes.

Crear snippets sintácticamente válidos que cumplan/incumplan reglas del catálogo
real, un trabajo pendiente y un fallo técnico controlado. Registrar revisión de
código/reglas/procesador de cada resultado esperado. Compartir una mezcla con
el lector e incluir propios de ambos actores para probar relaciones.

## Casos obligatorios

| Área | Verificación |
| --- | --- |
| Defaults | Crear sin configuración usa defaults reales; no se inventan reglas locales |
| Selección vacía | Guardar {} desactiva reglas; repetir configuración no crea otro lote |
| Guardado | Infracción y caída de lint no revierten contenido sintácticamente válido confirmado |
| Persistencia | Reiniciar aplicación conserva configuración/resultado/estado técnico de la revisión |
| Listado | Propios/compartidos/ambos muestran cumplimiento real; tests aprobados no sustituyen lint |
| Filtro/orden | Comparar conjuntos completos con páginas de tamaño 1/2; count antes de paginar y desempate estable |
| Estado | Pendiente, error técnico, incumplimiento y resultado superado se distinguen en UI |
| Detalle | Diagnósticos/posiciones corresponden exactamente a código/reglas/procesador mostrados |
| Carrera | Cambiar código/reglas durante evaluación nunca publica diagnóstico anterior como vigente |
| Acceso | Owner modifica; lector consulta sin editar reglas/código ni controlar sesiones ajenas; tercero denegado |
| Dependencias | Caída de Permissions/Asset/PrintScript no produce lista vacía ni cumplimiento ficticio |
| Tests | Owner/lector consultan y ejecutan tests según contrato; outputs exactos y error distinto de comparación fallida |
| Recuperación | Lote de reglas interrumpido/reentregado conserva avance y no duplica elementos lógicos |

Las rutas, selectores y comandos finales deben provenir de las entregas reales
de SNI-63/64/67, no de esta guía. Reutilizar pruebas/evidencia vigente de SNI-36
para permisos/storage y SNI-53 para tests; volver a comprobar las fronteras
modificadas. No reabrir toda la aceptación de US10 ni mezclar formato/OAuth.

## Registro de resultados

Crear una fila por caso con entorno/SHAs, IDs de fixture, entrada exacta,
resultado esperado/obtenido, HTTP y captura. Para filtro/paginación registrar
IDs y count de todas las páginas, incluidos ceros. Para una carrera registrar
el orden temporal de commits y evaluación; no usar esperas que sólo hagan
probable el caso. Para fallas indicar qué componente se interrumpió y su
restauración. Un caso omitido o obligatorio fallido mantiene abierto SNI-37.

Al terminar, detener únicamente el entorno aislado conservando sus volúmenes.
Sin despliegues Azure, sin cambios de CD y sin limpieza destructiva.
