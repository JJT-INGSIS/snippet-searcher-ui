# Aceptación final de ejecución y tests — 23/11/2026

Alcance: SNI-102 (US8–9), SNI-110 (US10), SNI-111 (US16).
La evidencia nueva usa UI `91575ff`, Snippets `42c736b`, Permissions `45b2b34`
y PrintScript `70533f7`. Se construyeron los tres jars desde esas fuentes,
con JDK 21, un worker y las convenciones locales mediante `--include-build`.
Los hashes completos están en el [JSON](evidence/thiago-execution-acceptance-2026-11-23.json).
No acredita imágenes desplegadas ni autenticación Auth0 de DEV/PROD.

## Casos comprobados con proveedores reales

Se usaron PostgreSQL 18.6 para ambas bases, Redis 7.4.7, Asset oficial fijado al
digest existente y Azurite 3.35.0. Datos, red y volúmenes nuevos del proyecto
`thiago-final-20261123`; aplicaciones locales en 18080–18082 y UI en 5173.
Sólo se suministró la identidad dev de la UI; no se simularon respuestas de API.

| Ticket | Evidencia comprobada |
| --- | --- |
| SNI-102 | API: definiciones exactas, dueño crea, lector ejecuta y no crea, tercero recibe 404, test de otro snippet rechazado. PASSED/FAILED conservan orden y bytes; inputs agotados y error de programa no se comparan como FAILED. Navegador: definición creada desde el modal, payload exacto y ejecución real coincidente/distinta. |
| SNI-110 | API: output antes del pedido de input, input idempotente/conflicto, otro actor sin acceso, edición durante ejecución conserva snapshot y cancelación libera cupo. Navegador: output incremental, input real, terminal COMPLETED, cancelación confirmada y nueva ejecución posible. |
| SNI-111 | Navegador: guardar `println(2);` produce resultados CURRENT con output `2`, uno PASSED y otro FAILED, sin revertir el guardado. Lector ve resultados; tercero recibe 404. Crear otra definición vuelve SUPERSEDED y oculta tests anteriores. |

Son seis funciones de aceptación API del verificador existente
`infra/scripts/verify_us8_10.py`, adaptando únicamente su acceso Compose de auditoría
al proyecto aislado. Navegador: un caso en `backend/automatic-tests.cy.ts` y dos
en `backend/execution.cy.ts`. Las suites se pueden ejecutar con la preparación
real de [SNI-36](sni-36-real-backend.md) y Redis/worker/outbox habilitados para US16;
los flags no están activos por defecto. Debe usarse un proyecto nuevo y puertos
locales libres, nunca credenciales ni fixtures de producción.

## Corrección de la sincronización de la prueba

El guardado real terminó después del límite de cuatro segundos que usaba la
aserción de texto. La prueba ahora observa el GET de detalle y el PUT de guardado,
espera sus respuestas con límite y exige HTTP 200, conservando todas las
aserciones de UI/resultados. No intercepta para fabricar éxito ni añade reintentos
de escrituras. Otro intento inicial recibió storage-unavailable por timeout Asset;
se conserva como falla de aquella ejecución, no se lo cuenta como PASS.

Validación: 270 tests unitarios UI, lint y build aprobados. Las tres aceptaciones
de navegador indicadas pasaron con los proveedores reales. Advertencias existentes:
bundle Vite grande y utilitario term-size de Cypress de otra arquitectura; las
últimas suites concluyeron con código 0. No se alteró producción.

## Qué conserva la revisión

La búsqueda de una definición en `ReadExecutionSnapshot` todavía carga la lista
acotada completa. Es una oportunidad de eficiencia, no un fallo demostrado;
no se agregó una operación nueva al puerto sólo para cerrar el ticket.
Se preservan autorización, snapshot, comparación exacta, NDJSON y capacidad.

Las correcciones previas siguen integradas: UI #34 (primer input rechazado),
Snippets #84 (historial perdido con ejecución terminada) y #85 (root local ausente).
Esta entrega agrega aceptación, no vuelve a implementar esos cambios.

Revisión cruzada solicitada a Juanfran y Juanchi; no hay evidencia de aprobación
humana ni de que otro integrante haya explicado el flujo. Para revisar SNI-110:
seguir `ExecutionSession`/`ExecutionInput`, terminal en `ExecutionRegistry` y la
liberación de capacidad en Snippets. Pregunta de defensa: ¿por qué un HTTP 202
al cancelar no prueba todavía que el intérprete terminó?
