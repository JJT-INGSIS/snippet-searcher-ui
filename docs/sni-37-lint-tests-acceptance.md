# SNI-37 — Aceptación preparada, pendiente de integración

Estado al 06/11/2026: **preparación actualizada; aceptación integrada pendiente**.
SNI-63/64/77/78 y la UI de tests SNI-69 están integrados en `dev`. Falta la UI
SNI-67, asignada a Juan. Thiago confirmó mantener ese reparto y preparar esta
aceptación, sin implementar la tarea del compañero. OAuth no bloquea este recorrido.

La inspección de UI `a8a77d1` encontró la pestaña de lint con aviso de no disponible,
operaciones de lint sin integrar, filtros sin lint y detalle sin diagnósticos.
Este registro es una revisión de preparación, no una prueba de integración ejecutada.
Al integrar SNI-67 se deben sustituir estas observaciones por evidencia funcional.

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


## Puerta de entrada para la ejecución

Antes de crear datos, comprobar con la revisión integrada de SNI-67:

- Configuración: catálogo real por lenguaje/versión, guardar, no-op y progreso.
- Listado: filtro `lint`, orden `lint` y los estados compliant/not-compliant/pending/failed.
- Detalle: motivo y diagnósticos de la revisión vigente, sin diagnósticos superados.
- Errores: una dependencia caída no muestra lista vacía ni éxito.

Si falta alguna capacidad, registrar **BLOCKED / SNI-67**, no PASS ni un skip que
permita cerrar el ticket. Los selectores finales se toman del código que entregue
Juan; esta preparación no impone textos, controles ni identificadores nuevos.

## Datos listos para usar

[Fixture preparado](evidence/sni37-fixtures.json): contiene cuerpos reales de alta y
tests, aliases locales y expectativas. Es una plantilla **NOT_EXECUTED**, sin IDs
ni resultados inventados. Reemplazar `__RUN__` por un UUID al crear cada entorno.
El archivo no envía solicitudes ni modifica datos por sí mismo.

Orden de preparación en un proyecto nuevo `sni75-sni37-<fecha>-<uuid>` (prefijo requerido por el helper durable):

1. Registrar SHA de cada repo e identidad de sus imágenes. Usar servicios reales,
   volúmenes/namespace nuevos y actores del directorio dev; no reutilizar bases
   compartidas. La guía/overlay de [SNI-75](sni-75-formatting-acceptance.md) sirve
   para levantar proveedores, con imágenes de las revisiones registradas.
2. Para owner y lector, confirmar que el catálogo real contiene
   `mandatory-variable-or-literal-in-println` y guardar esa selección mediante
   `PUT /linting-rules/printscript/1.1`. Esperar terminal de los jobs creados.
   No inventar otra regla si el catálogo no la contiene: registrar incompatibilidad.
3. Crear los cuatro snippets de la plantilla con `POST /snippets`, actor explícito
   y una `Idempotency-Key` nueva por creación lógica. Conservar clave e IDs; un
   reintento de creación incierta debe reutilizar la misma clave y cuerpo.
4. Compartir los dos del owner con el lector usando
   `PUT /snippets/{id}/shares/dev-ana`. Guardar IDs por alias. El snippet del tercero
   no se comparte. Cada actor mantiene una muestra propia.
5. Crear los tres tests del snippet no conforme mediante
   `POST /snippets/{id}/tests`, sólo como owner. El lector puede consultarlos y
   ejecutar sus propias sesiones; no puede crearlos ni controlar sesiones ajenas.
6. Registrar respuestas de detalle y catálogo, revisiones y diagnósticos reales.
   Nunca escribir filas/estados directamente para hacer pasar la aceptación.

Expectativas concretas:

- `owner-good`: compliant. `owner-bad`: not-compliant con diagnósticos reales.
- El test de `owner-bad` que espera `3` debe pasar: prueba que PASSED no significa
  lint compliant. El que espera `4` y el que espera dos outputs deben fallar la
  comparación; no son fallas técnicas ni errores de sintaxis.
- Para el lector: owned contiene `reader-good`; shared contiene los dos del owner;
  all contiene esos tres, dentro del prefijo de esta ejecución. El tercero no ve
  esos snippets y obtiene 404 al pedirlos directamente.
- Comparar conjuntos y count con páginas de tamaño 1 y 2, ambos sentidos y cada
  relación. `sort=lint` es lexicográfico, con desempate por ID ascendente según el
  contrato vigente; no asumir un orden de severidad ni el orden de creación.

## Estados y fallos reproducibles

Preparar los casos en fases separadas, restaurando cada componente antes de seguir:

| Caso | Preparación/control | Qué registrar |
| --- | --- | --- |
| Defaults | Actor dev sin configuración previa, catálogo atribuido y alta válida | Resultado real y revisión de defaults; no deducir defaults desde `{}` |
| Pending superado | Worker/outbox del proyecto detenidos; cambiar selección efectiva después de evaluar | pending + SUPERSEDED, sin diagnósticos ni hash anteriores; luego reactivar y esperar reevaluación |
| Failed | Proxy local sólo inyecta 503 en POST /linting para un literal único del fixture | Guardado confirmado, lint failed y motivo; validación/catálogo restantes reales |
| Código/reglas en carrera | Retener una operación identificada antes de completarla y confirmar la edición/cambio antes de liberarla | IDs/orden temporal, revisión ganadora y descarte del resultado anterior; no usar sleep como única prueba |
| PrintScript caído | Detener sólo el proveedor propio | Listado/detalle afectados con error explícito; no lista vacía ni cumplimiento ficticio |
| Asset caído | Detener sólo Asset propio | Listado disponible, detalle 503 y recuperación posterior sin perder original |
| Permissions caído | Detener sólo Permissions propio | Error explícito y ausencia de datos privados/resultado vacío ficticio |
| Recuperación | Worker/outbox habilitados, interrumpir con avance parcial y reentregar el evento | Progreso conservado, ACK y ausencia de duplicados lógicos |

Los helpers existentes son evidencia de capacidades, no sustituyen la aceptación
UI pendiente. Desde carpetas hermanas, en el proyecto aislado:

```sh
# Sólo para consultas con worker/outbox deshabilitados: evita que pending desaparezca.
python3 ../snippets-service/scripts/verify_lint_queries.py \
  --base-url http://127.0.0.1:18080 --phase healthy \
  --evidence /tmp/sni37-queries.json --fault-control /tmp/sni37-control.json

# Con worker/outbox habilitados y proveedor durable listo: prueba del lote real.
python3 scripts/verify_durable_processing.py \
  --compose-dir /ruta/al/infra-aislado --project sni75-sni37-<fecha>-<uuid> \
  --control /tmp/sni37-control.json --evidence /tmp/sni37-batch.json --phase lint_batch
```

Se conserva el prefijo `sni75-*` porque el helper existente lo exige; el sufijo
`sni37-*` distingue este entorno. No reutilizar proyectos anteriores ni eliminar
volúmenes para repetir la aceptación. La cobertura del helper sigue siendo API/lote.
El proxy se inicia con `scripts/sni75_fault_proxy.py --control /tmp/sni37-control.json`
y sólo Snippets del proyecto apunta a él. Nunca conectarlo a un ambiente compartido.

Para permisos/storage desde navegador ya existe `cypress/e2e/backend/sharing.cy.ts`
(fases healthy/permissions-down/storage-down); usa proveedores reales y sólo fija
la identidad dev en app-config. Las pruebas de `cypress/e2e/contracts` sí usan una
API controlada y no deben presentarse como aceptación real.

## Entrega de evidencia a completar

Para cada fila de la matriz registrar `PENDING`, `PASS`, `FAIL` o `BLOCKED`, junto
con revisión/imagen, alias/ID, actor, solicitud/acción, esperado, obtenido y archivo
HTTP/captura. No guardar tokens, claves ni credenciales. En este PR todas las
verificaciones funcionales de SNI-37 permanecen **PENDING / NOT_EXECUTED**.
La evidencia anterior de SNI-64/69/75 sólo respalda sus casos documentados y sus
revisiones; no certifica la futura UI de lint. Un caso obligatorio pendiente,
bloqueado o fallido conserva SNI-37 abierto.
