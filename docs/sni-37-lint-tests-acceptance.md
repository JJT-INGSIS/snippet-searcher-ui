# SNI-37 — Aceptación de lint y tests con proveedores reales

Ejecución local: **08/11/2026**, zona America/Argentina/Buenos_Aires.
SNI-67 está integrado en UI dev `7714786`. Se conserva el reparto de trabajo:
esta entrega prueba las implementaciones existentes; no reemplaza la UI de Juan.
OAuth/SNI-74 y Azure no forman parte de esta aceptación.

## Entorno y límites

Proyecto nuevo `sni75-sni37-20261108-729f51`: UI, Snippets, Permissions,
PrintScript, PostgreSQL, Redis y Asset/Azurite reales. Identidad dev explícita,
volúmenes nuevos y puertos ligados a localhost. Las imágenes de QA son arm64
locales: esta ejecución no certifica las imágenes amd64 ni un despliegue en VMs.
SHAs, imágenes, JAR, entradas, IDs y resultados están en
[evidencia de ejecución](evidence/sni37-2026-11-08.json).

Snippets se construyó desde el dev integrado `5ca5bf8`, sin incluir el adaptador
Auth0 todavía en revisión. Infra procede de `773e1ae`; las imágenes locales de
PrintScript y Permissions conservan las revisiones identificadas en la evidencia.
El overlay local fija `AUTH_MODE=dev`, proveedor vía proxy en 18083 y CORS para
UI 5175. No se modifican CD ni recursos de Azure.

El proxy no fabrica resultados exitosos: pasa respuestas de PrintScript real,
inyecta 503 sólo para un literal de fixture o retiene una solicitud identificada.
En Cypress sólo se suministra `/app-config.json` para seleccionar actor dev;
ninguna respuesta `/api` se reemplaza.

## Matriz ejecutada

| Caso | Evidencia verificable |
| --- | --- |
| Defaults reales | Alta de dev-juan con revisión del catálogo y evaluación conforme |
| Selección vacía | `{}` permite expresión en println; activar la regla cambia su resultado |
| No-op | Misma selección conserva revisión, `changed=false`, `jobId=null`; UI deshabilita Guardar sin cambios |
| Guardado | Una infracción o 503 de lint no revierte el contenido confirmado |
| Persistencia | Antes/después de reiniciar Snippets: detalles, estados y revisiones idénticos |
| Listado | 36 combinaciones de actor/relación/dirección/tamaño, count y conjuntos completos; filtros de cada estado |
| UI y páginas | Ocho snippets del lector en páginas de cinco/tres, orden lint y filtro; cuatro estados reales |
| Diagnósticos | Texto, regla, línea y columna comparados contra el detalle real |
| Superado/técnico | `SUPERSEDED` sin diagnósticos viejos; fallo técnico separado de infracciones; borrador del owner conservado |
| Permisos | Lector sin edición/sharing/creación de tests; tercero 404; sesiones privadas de su ejecutor |
| Tests | Owner/lector ejecutan: espera `3` PASSED, `4` y dos outputs FAILED; el código continúa lint not-compliant |
| Dependencias | PrintScript y Permissions caídos: 502 y UI sin lista vacía ficticia; Asset caído: lista 200, detalle 503; restauración verificada |
| UI de reglas | Guardado real, lote de 12, progreso terminal; edición posterior cambia lint sin perder el código guardado |
| Carreras | Edición/cambio de reglas confirmados mientras se retiene una operación vieja; publicación sólo de la revisión ganadora |
| Recuperación | Interrupción con avance parcial, reinicio de Redis/Snippets y reentrega del evento; ACK, sin duplicar ítems/auditorías ni retener cupos |

Las pruebas de contratos con respuestas controladas no se cuentan como aceptación
real. Las fases Cypress omiten expresamente los escenarios de otras fases:
se agregan los resultados de healthy, processor-down, storage-down,
permissions-down y batch, no se interpreta una fase aislada como la matriz completa.
La comparación manual comprueba resultados de tests, no la aceptación completa
US10; se conserva el alcance acordado en Linear.

## Reproducción

Preparar un proyecto local nuevo con los tres proveedores, bases, Redis y Asset,
sin datos compartidos. Seguir el overlay/runbook de
[SNI-75](sni-75-formatting-acceptance.md), fijar las imágenes registradas y habilitar
`PRINTSCRIPT_OPERATIONS_ENABLED=true`. Para las primeras fases deshabilitar
`SNIPPETS_WORKER_ENABLED` y `SNIPPETS_OUTBOX_ENABLED`: permite observar
`pending/SUPERSEDED` de forma determinista. No publicar bases ni Redis.

```sh
python3 scripts/sni75_fault_proxy.py --control /tmp/sni37-control.json
# En otra terminal, con snippets-service como carpeta hermana:
python3 ../snippets-service/scripts/verify_lint_queries.py \
  --base-url http://127.0.0.1:18080 --phase healthy \
  --evidence /tmp/sni37-queries.json --fault-control /tmp/sni37-control.json
python3 scripts/verify_sni37.py --queries /tmp/sni37-queries.json \
  --evidence /tmp/sni37-functional.json --phase fixtures
```

El helper de consultas usa prefijo SNI64 por su procedencia; el proyecto aislado,
UUID e IDs registrados lo atribuyen inequívocamente a esta ejecución SNI-37.
El helper funcional agrega tres fixtures para la paginación UI y comprueba las
combinaciones de acceso/orden y las seis ejecuciones manuales.

Levantar UI con `API_PROXY_TARGET=http://127.0.0.1:18080`, actor dev y puerto 5175.
Ejecutar Cypress con la fase healthy:

```sh
npx cypress run \
  --config baseUrl=http://127.0.0.1:5175,specPattern=cypress/e2e/backend/lint.cy.ts \
  --env SNI37_EVIDENCE_FILE=/tmp/sni37-functional.json,SNI37_PHASE=healthy
```

Capturar `snapshot` con verify_sni37.py, reiniciar sólo Snippets y ejecutar
`verify-snapshot`. Detener cada proveedor por separado, esperar la parada y
usar fase Cypress processor-down/storage-down/permissions-down. Para las dos
primeras correr también la fase homónima de verify_lint_queries.py. Restaurar
cada proveedor y esperar su disponibilidad funcional antes de seguir; comprobar
`recovered`. No ejecutar reinicios en paralelo con pruebas de navegador.

Después habilitar worker/outbox y recrear sólo Snippets. El helper de recuperación
exige proyecto `sni75-sni37-*`, overlay `acceptance.yaml` y actor dev-juanfran:

```sh
python3 scripts/verify_sni37_recovery.py \
  --compose-dir /ruta/al/infra-aislado --project sni75-sni37-<fecha>-<uuid> \
  --control /tmp/sni37-control.json --evidence /tmp/sni37-recovery.json --phase prepare
```

Ejecutar fase Cypress batch, agregando
`SNI37_BATCH_FILE=/tmp/sni37-recovery.json`; espera los 12 snippets creados en prepare.
Luego ejecutar el helper de recuperación una vez por fase, en orden:
`code-race`, `rules-race`, `recovery`. Sólo él interrumpe servicios/reentrega un
evento del proyecto indicado. Consulta SQL para evidencia sin alterar resultados.

Un intento de reglas superadas puede terminar `COMPLETED` en la auditoría interna:
eso no acredita que se publicó. La prueba contrasta la revisión del puntero
`current_lint_assessment` y el detalle público tras terminar ambos trabajos.
Para código reemplazado también se verifica el ítem `SUPERSEDED`. Esta distinción
sigue la implementación existente; no se cambió producto para satisfacer el test.

Las carreras usan una señal del proxy y timestamps del cambio confirmado,
no una espera que sólo haga probable la concurrencia. La recuperación exige
avance parcial observado y compara ítems/auditorías tras consumir y confirmar
el duplicado. No se presenta una mera convergencia como prueba de no duplicación.

## Entrega

El PR contiene scripts, escenarios reales, evidencia JSON y capturas seleccionadas.
El fixture original [sni37-fixtures.json](evidence/sni37-fixtures.json) se conserva
como plantilla NOT_EXECUTED; los resultados están separados en el registro fechado.
No se reescribe evidencia anterior de SNI-36/53/64/69/75 como si fuera esta UI.
Al finalizar se detiene únicamente el proyecto local y sus procesos de QA,
conservando volúmenes. El merge queda a cargo de Thiago.
