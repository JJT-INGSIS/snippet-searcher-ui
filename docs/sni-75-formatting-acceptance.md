# SNI-75 — Aceptación local de formato durable

Estado al 05/11/2026: aprobadas e implementadas operaciones durables para lint y
formato, ID generado por Snippets y retención terminal de siete días. La evidencia
del 04/11 se conserva como antecedente; la repetición con este protocolo se registra
en la sección del 05/11. Los merges y la activación real quedan a cargo del equipo.
El procedimiento inicial del 02/11 quedó preparado antes de integrar proveedores.

## Preparación segura

1. Registrar SHAs/digests exactos de UI, Snippets, PrintScript, Permissions,
   Asset y Redis. Confirmar que SNI-56/62/65/66 estén integrados y sus contratos
   publicados. Usar el Compose de infra de esa revisión; no copiar credenciales
   ni inventar rutas de descarga/progreso mientras falten los contratos.
2. Crear un proyecto local aislado, volúmenes propios y namespace Redis exclusivo.
   Usar identidad dev explícita: owner dev-thiago, lector dev-ana, tercero
   dev-bruno. Guardar el ID de cada dato con prefijo `SNI75-<fecha>-<uuid>`.
3. Ejecutar UI y proveedores reales. No sustituir respuestas de `/api`, PrintScript,
   Permissions ni Asset; sólo se admite configurar identidad de desarrollo.
   Cypress puede observar solicitudes reales sin responderlas.
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

## Ejecución local — 2026-11-04 (parcial)

Las dependencias ya se integraron. Proyecto nuevo `sni75-20261104-0d4c2d`,
volúmenes y namespace propios, sin modificaciones de datos anteriores ni Azure.
Bases: UI `42f870e`, Snippets `b427b79`, PrintScript `6dff722`, Permissions
`500331e`, infra `f531287`, más corrección tmpfs `27e74a0` (infra PR #41).

- `python3 scripts/verify_sni75.py --evidence /private/tmp/sni75-evidence.json`:
  PASS. Guardado 0,226 s; el primer progreso era PENDING y luego COMPLETED
  16/16, 0 fallidos. Repetir selección no creó otro lote. Alcance, originales,
  variantes vigentes, UTF-8 y autorización owner/lector/tercero comprobados.
- `npx cypress run --config baseUrl=http://localhost:5175,specPattern=cypress/e2e/backend/formatting.cy.ts --env SNI75_EVIDENCE=/private/tmp/sni75-evidence.json`:
  PASS, 1 prueba, 35 s. Guardado desde UI de una regla del catálogo real,
  progreso terminal, descargas `.prs` original/formateado para ambos actores,
  bytes comparados con respuestas reales, creación/liberación de Blob URL y
  tercero 404. Sólo se suministró app-config de identidad dev; no se simularon APIs.

La primera preparación usó un ID de regla de un test de contrato y recibió 422;
se corrigió al ID real antes de obtener esta evidencia. Los fixtures sintéticos
anteriores se conservaron y se incluyeron al contar el alcance (16).

**Estado de esa primera fase:** entonces faltaban interrupción/reentrega, falla
individual, carreras y convivencia. Los resultados posteriores se detallan abajo;
el límite de recuperación de esa versión motivó la extensión aprobada el 05/11.

### Recuperación y fallos ejecutados

Evidencia estructurada: [sni75-2026-11-04.json](evidence/sni75-2026-11-04.json).
Los fixtures son sintéticos. Los servicios generan realmente el código formateado;
el proxy sólo demora solicitudes seleccionadas o inyecta una falla declarada.

- Worker detenido con un item durable, Redis reiniciado y worker recuperado:
  terminó 16/16; la repetición final terminó 24/24. Reentrega del mismo envelope con consumo/ACK confirmado en
  Redis: mismos IDs, referencias y conteos, sin duplicados lógicos.
- Falla 503 limitada a un fixture: tres intentos, `LANGUAGE_UNAVAILABLE`,
  PARTIAL con 16 éxitos/1 fallo. Original intacto y descarga posible al retirar
  la falla. No se simularon resultados exitosos del proveedor.
- Código editado con su solicitud antigua retenida en el proxy: el lote terminó
  con el original nuevo y ninguna descarga presentó el código anterior.
- Reglas cambiadas mientras el formato antiguo estaba retenido: item anterior
  SUPERSEDED, nueva revisión terminó y fue la descargada. Si la carrera ocurre
  en el último item, el job viejo puede terminar COMPLETED con ese item
  SUPERSEDED: se verifica el item y la publicación, no se exige otro estado al job.
- Ejecución pública interactiva real mantuvo un permiso manual durante el lote,
  recibió `Ana`, emitió `Hola, Ana` y terminó COMPLETED. El lote también terminó
  24/24. La sesión se respondió durante el procesamiento, antes de su timeout
  de input; no se aumentaron los límites del motor.

La preparación de carreras requirió ampliar la espera del test bajo carga local
(30 s para alcanzar un fixture al final del lote no bastaban). Es un límite del
harness, no un SLA ni un cambio de tiempos de la aplicación.

### Cómo repetir

Usar un checkout/archivo aislado de los SHAs indicados, con los nombres de carpetas
que espera el Compose de infra. Copiar [sni75-acceptance.yaml](evidence/sni75-acceptance.yaml)
a `acceptance.yaml` dentro de ese infra. Preparar `.env` y `secrets/redis_password`
ignorados según sus guías; no registrarlos en evidencia. El overlay requiere
Compose con soporte de `!override`. Elegir un proyecto NUEVO `sni75-<fecha>-<uuid>`.
Construir secuencialmente Snippets, Permissions y PrintScript con los tres archivos
Compose (`compose.yaml`, `compose.redis.yaml`, `acceptance.yaml`); luego iniciar
con perfil `assets`. Asset/Azurite y Redis son los definidos por ese infra.
Los puertos locales del overlay son 18080/18081/18082/19095; escoger puertos libres.
La ejecución usó `SNIPPETS_DB_PORT=25436` y `PERMISSIONS_DB_PORT=25437` en el
`.env` privado para evitar puertos de PostgreSQL ya ocupados.

1. Ejecutar `verify_sni75.py` y después Cypress con el archivo de evidencia,
   como arriba. Vite usa `API_PROXY_TARGET=http://127.0.0.1:18080`.
2. Iniciar el proxy opt-in (escucha en el host para acceso desde Docker):
   `python3 scripts/sni75_fault_proxy.py --control /tmp/sni75-control.json`.
   Reconfigurar sólo Snippets del proyecto propio con
   `SNI75_PRINTSCRIPT_BASE_URL=http://host.docker.internal:18083`; conservar volúmenes.
3. Ejecutar las fases en ese mismo proyecto y con el mismo archivo de control:

```sh
python3 scripts/verify_sni75_recovery.py \
  --compose-dir /ruta/al/infra-aislado --project sni75-<identificador-nuevo> \
  --proxy-control /tmp/sni75-control.json --evidence /tmp/sni75-advanced.json
```

El script no elimina volúmenes: sólo detiene/reinicia Snippets y Redis del proyecto
explícito durante recuperación. Para repetir una fase aislada, preparar primero
una selección distinta; el script exige que guardar reglas cree un lote nuevo.
Detener luego los procesos propios y `docker compose ... stop`, sin `down -v`.

**Hallazgo histórico del 04/11, resuelto por el protocolo del 05/11:** esa parada
controlada no acreditaba la terminación remota. Ahora el consumidor conserva el
cupo ante incertidumbre, consulta el mismo ID y exige terminación o un fence
durable antes de reintentar. El proveedor conserva capacidad hasta el retorno
real del cálculo. Las pruebas de motor controlado acreditan ese último límite;
las pruebas reales de abajo acreditan recuperación entre servicios.


## Protocolo durable — 2026-11-05

Implementación de proveedor `129c5f1` y consumidor `d224758` (documentación
posterior `99aece6`). Se reutilizó el proyecto aislado y se conservaron todos los
fixtures anteriores; por eso aumentó el tamaño del lote. Las imágenes de runtime
se construyeron desde los JARs del build local aprobado, sin recompilar dentro de
las VMs. Revisiones, hashes y resultados se registran en
[sni75-2026-11-05.json](evidence/sni75-2026-11-05.json).

`verify_durable_processing.py` usa proveedores, PostgreSQL y Redis reales. El
proxy sólo retrasa transporte o inyecta el error declarado; no inventa resultados.

- **Respuesta perdida:** PrintScript aceptó la operación; se retuvo su respuesta y
  se mató Snippets. Tras reiniciar, recuperó el mismo ID/permiso y publicó el
  resultado; un solo inicio lógico, con prueba `REMOTE_RESULT_PERSISTED`.
- **Inicio demorado:** el PUT quedó retenido antes del proveedor; la recuperación
  creó un tombstone CANCELLED antes de liberar el transporte. El PUT antiguo
  siguió cancelado y el nuevo intento terminó. Un 404 aislado nunca liberó cupo.
- **Persistencia:** un resultado COMPLETED conservó el mismo registro tras reiniciar
  Redis y PrintScript. Se esperó el intervalo AOF configurado: no se afirma
  durabilidad fsync-always ni ejecución física exactamente una vez.
- **Lint real:** configuración `{}` dejó ambos fixtures compliant; la regla real de
  println identificó el caso no conforme, conservó tres evaluaciones por fixture,
  no cambió el original y permitió filtrar al lector autorizado (count=1). El
  tercero recibió 404.
- **Recuperación/reentrega:** worker detenido y Redis reiniciado durante el lote;
  48/48 finales. Reentrega consumida y ACKeada sin alterar IDs, referencias ni conteos.
- **Falla aislada:** 48 éxitos/1 fallo, tres intentos del fixture con 503 inyectado;
  motivo final `REMOTE_OPERATION_CANCELLED` tras fencing y agotamiento de reintentos.
  Original intacto y descarga real disponible al retirar la falla.
- **Carrera de código:** edición durante el cálculo antiguo retenido; lote 50/50,
  original nuevo intacto y derivado vigente sin contenido anterior.
- **Carrera de reglas:** lote anterior SUPERSEDED, item retenido SUPERSEDED y
  nuevo lote 51/51. La descarga corresponde a la revisión ganadora.
- **Convivencia interactiva:** sesión pública mantuvo un permiso manual durante
  el lote, recibió `Ana`, emitió `Hola, Ana` y terminó COMPLETED; el lote terminó
  52/52. No se modificó el timeout de input.
- **Navegador:** Cypress 1/1, 81 s; catálogo y guardado reales, progreso terminal,
  descarga UTF-8 original/formateada como owner y lector, variante almacenada,
  liberación de Blob URLs y tercero 404. Sólo se simuló la identidad dev.
- **HTTP/formato:** 48/48 procesados, sin fallos; guardar tardó 0,0208 s, devolvió
  progreso PENDING y repetir la misma configuración no creó otro lote. Alcance,
  UTF-8, originales, derivados almacenados y autorización comprobados.

Para repetir las cuatro pruebas del protocolo, iniciar el proxy y usar el mismo
archivo de control en un proyecto aislado habilitado con el overlay actualizado:

```sh
python3 scripts/verify_durable_processing.py \
  --compose-dir /ruta/al/infra-aislado --project sni75-<identificador-nuevo> \
  --control /tmp/sni75-control.json --evidence /tmp/sni78-durable.json
```

El proveedor requiere operaciones habilitadas y modo `single-stop-first`, ya
expresados en el overlay de aceptación. Producción conserva el feature apagado
por defecto. Los tests de proveedor usan Redis real y un motor controlado para
comprobar cancelación mientras CPU sigue viva, pérdida de escritura final y
retroceso del registro RUNNING a PENDING; no se confunden con las pruebas HTTP
entre servicios.

Una repetición inicial de HTTP recibió correctamente `changed=false` porque la
selección ya era la misma; se preparó otra selección antes de repetir. No se
borraron datos para forzar un resultado. Las esperas del harness se ampliaron a
300 s para el corpus sintético acumulado; no son un SLA ni cambian los timeouts
de las aplicaciones.

**Resultado del 05/11:** todas las fases locales documentadas pasaron. Builds de
proveedor (149 tests), consumidor (658, 18 opt-in omitidos) y UI (144), lint,
Ruff y navegador aprobados. Pendientes únicamente de integración de estas PRs
y activación operativa posterior; no se afirma un despliegue en Azure.
