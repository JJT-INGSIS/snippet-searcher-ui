# SNI-75 — Aceptación local y límite de recuperación

Estado al 04/11/2026: navegador, HTTP, recuperación controlada, reentrega, fallas,
carreras y sesión interactiva ejecutados con proveedores reales. Sigue abierto
por la garantía de capacidad ante terminación remota incierta, explicada al final.
El procedimiento inicial del 02/11 quedó preparado antes de integrar proveedores.

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
el límite final de recuperación sigue abierto.

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

**Límite de cierre:** estos casos pasaron, pero no acreditan que un formato remoto
haya dejado de consumir CPU tras matar el cliente o vencer HTTP. El reconciliador
actual de formato libera/reintenta sin evidencia remota de terminación. La decisión
sobre extender las operaciones durables SNI-78 a formato o conservar UNKNOWN
está pendiente de Thiago. No se presenta esta parada controlada como prueba de
esa garantía ni se cierra el ticket ocultando el hallazgo.
