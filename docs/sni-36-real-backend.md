# SNI-36 — Aceptación con proveedores reales

Esta suite comprueba US5–7 base: creación/actualización, listado/detalle y sharing.
No certifica lint, ejecución de tests, Auth0, HTTPS ni despliegues. No utiliza
respuestas ficticias de Permissions, PostgreSQL, PrintScript, Asset o Azurite.
La suite normal `npm test` continúa siendo independiente de Docker.

## Preparación local aislada

Usar los cuatro proveedores y la UI de `dev`, conservando los otros checkouts y
sus cambios. El README de infra explica credenciales BuildKit y contraseñas en
`.env` ignorado por Git. No copiar ese archivo a la UI ni imprimir su contenido.
Usar un proyecto Compose nuevo para no activar Asset sobre datos preexistentes.
Los comandos siguientes son Bash y se ejecutan desde infra:

```bash
export SNI36_PROJECT=sni36-$(date +%s)
export STORAGE_PROVIDER=asset
export SNIPPETS_DB_PORT=15436 PERMISSIONS_DB_PORT=15437
dc() { docker compose -p "$SNI36_PROJECT" --profile assets "$@"; }
dc build printscript-service
dc build snippets-service
dc build permissions-service
dc up -d --wait --wait-timeout 180 asset-service azurite snippets-db permissions-db
dc up -d snippets-service permissions-service printscript-service
```

Los puertos localhost 8080–8082 y 15436–15437 deben estar libres. Esperar a que
`GET http://127.0.0.1:8080/languages` y `GET http://127.0.0.1:8081/actuator/health`
respondan correctamente. Asset/Azurite no publican puertos. Las bases y blobs
son volúmenes nuevos del proyecto generado; no se copian datos reales.

En otra terminal, desde UI:

```bash
UI_DEV_ACTOR=dev-thiago npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

En una tercera terminal, también desde UI:

```bash
export SNI36_EVIDENCE_FILE=$(mktemp /tmp/sni36-evidence.XXXXXX)
SNI36_PHASE=healthy npm run test:backend -- tests/backend-acceptance.test.ts
npm run test:browser:backend -- --spec cypress/e2e/backend/sharing.cy.ts
```

La evidencia contiene IDs, nombres y código de prueba, sin credenciales; es externa
al repo y privada. Los actores configurados son Thiago (`dev-thiago`), Ana
(`dev-ana`) y Bruno (`dev-bruno`). La configuración pública de identidad dev en
Cypress se sustituye para cambiar de actor; **ninguna respuesta `/api` se simula**.
Esto no representa autenticación de producción.

## Qué comprueba

- El adaptador HTTP real crea dos snippets del owner y uno del destinatario,
  actualiza código UTF-8 y conserva identidad, contenido y capacidades. Ocho
  lecturas concurrentes durante una actualización sólo admiten metadatos/código
  de la misma revisión, sin combinar versiones.
- Búsqueda real de destinatarios, primer share 201 y repetición compatible 200.
- Orden ascendente/descendente, filtro sin coincidencias, paginación con count
  total, owned/shared/all y ausencia de duplicados por relaciones de acceso.
- Compartido puede leer código exacto; no puede editar ni compartir nuevamente.
  El tercer actor recibe 404 al consultar y no ve el snippet en su listado.
- Navegador crea, actualiza y comparte; muestra detalle de solo lectura en móvil.
- Las fases siguientes exigen fallos reales y recreación de componentes. Un
  endpoint no disponible no cuenta como una lista vacía ni un guardado exitoso.

Las filas de prueba llevan prefijo SNI36 y se conservan: no existe eliminación
pública. La comprobación de PENDING significa que no se publica como confirmado;
las reservas internas de creaciones fallidas no se borran para hacer pasar el test.

## Fallos reales de proveedores

En infra, con la misma función `dc` y el mismo proyecto:

```bash
dc stop permissions-service
```

En la terminal de pruebas UI:

```bash
SNI36_PHASE=permissions-down npm run test:backend -- tests/backend-acceptance.test.ts
npm run test:browser:backend -- --spec cypress/e2e/backend/sharing.cy.ts --env SNI36_PHASE=permissions-down
```

Restaurar Permissions, esperar su health y detener Asset:

```bash
# Desde infra
dc up -d permissions-service
dc stop asset-service
```

```bash
# Desde UI
SNI36_PHASE=storage-down npm run test:backend -- tests/backend-acceptance.test.ts
npm run test:browser:backend -- --spec cypress/e2e/backend/sharing.cy.ts --env SNI36_PHASE=storage-down,SNI36_EVIDENCE_FILE="$SNI36_EVIDENCE_FILE"
```

Restaurar Asset y esperar su health antes de continuar. La suite comprueba que
fallar al preparar contenido no cambia el nombre confirmado ni fabrica contenido.

## Rechazo real de escritura en PostgreSQL

Esta inyección es **sólo para la base local aislada**. Rechaza un nombre nuevo para
el UUID exacto de la evidencia; no apaga PostgreSQL ni reemplaza Asset por un mock.
Desde la terminal UI, obtener los valores y pasarlos a la terminal de infra:

```bash
node -e 'const r=JSON.parse(require("fs").readFileSync(process.env.SNI36_EVIDENCE_FILE,"utf8")); console.log(JSON.stringify({id:r.id,bad:r.name+"-must-not-commit"}))'
```

En infra, completar `SNI36_ID` y `SNI36_BAD_NAME` con esos dos valores de prueba:

```bash
dc up -d --wait asset-service
dc exec -T snippets-db psql -U snippets -d snippets -v ON_ERROR_STOP=1 -v id="$SNI36_ID" -v bad="$SNI36_BAD_NAME" <<'SQL'
ALTER TABLE snippets ADD CONSTRAINT sni36_reject_update
CHECK (id <> :'id'::uuid OR name <> :'bad') NOT VALID;
SQL
```

En UI ejecutar la fase; luego retirar siempre la restricción desde infra:

```bash
SNI36_PHASE=metadata-write-failure npm run test:backend -- tests/backend-acceptance.test.ts
```

```bash
dc exec -T snippets-db psql -U snippets -d snippets -v ON_ERROR_STOP=1 -c 'ALTER TABLE snippets DROP CONSTRAINT sni36_reject_update;'
```

La comprobación exige rechazo técnico, código anterior exacto y sharing intacto.
No debe relajarse una aserción a éxito para ocultar una actualización parcial.

## Recreación conservando volúmenes

Restaurar primero todos los proveedores. Desde infra:

```bash
dc up -d --no-deps --force-recreate --wait --wait-timeout 180 snippets-db permissions-db azurite asset-service
dc up -d --no-deps --force-recreate snippets-service permissions-service printscript-service
```

Esperar la salud HTTP y ejecutar desde UI:

```bash
SNI36_PHASE=after-recreate npm run test:backend -- tests/backend-acceptance.test.ts
```

El código, los metadatos, el acceso compartido y la denegación al tercer actor
deben coincidir con la evidencia previa. Revisar el estado real de las filas:

```bash
dc exec -T snippets-db psql -U snippets -d snippets -c "SELECT state, count(*) FROM snippets WHERE name LIKE 'SNI36-%' GROUP BY state;"
```

Al terminar, `dc down` retira únicamente el proyecto aislado y conserva volúmenes.
No usar `--volumes`, no detener otros proyectos ni reutilizar estos datos en prod.

## Evidencia de esta entrega

Ejecutado el **28/10/2026**, en macOS ARM64 con Docker local, Node 24.10.0,
Cypress 13.8.1/Electron y construcciones locales de los Dockerfiles de dev.
No se desplegó en Azure ni se certifica con esto el transporte HTTPS o Auth0.

| Repositorio | Revisión utilizada |
| --- | --- |
| snippet-searcher-infra | `001542761edc302f6e736e78efa71747e4035030` |
| snippets-service | `025f0cbf84927e6611609ee5ef9638509c83506e` |
| permissions-service | `46e7af36864c36b824376ff06dfd7a0a69726b75` |
| printscript-service | `2fb2928fb2baf30fa7ada4cafd386a4a2936e054` |
| snippet-searcher-ui | `1b2485d943a1fe9984eecf34799d4d3bcd4859cc` |

| Escenario | Resultado |
| --- | --- |
| API: tres actores, creación/update, lecturas concurrentes, filtros/orden/paginación, compartir repetido | PASS |
| API: Permissions detenido, 502 dependency-failure en listado/detalle/share | PASS |
| API: Asset detenido, 503 storage-unavailable y metadatos anteriores intactos | PASS |
| API: PostgreSQL rechaza el UPDATE real, 503 metadata-unavailable y versión anterior legible | PASS |
| API: recreación de ambas bases, Asset/Azurite y aplicaciones con volúmenes conservados | PASS |
| Navegador: crear/editar/compartir; destinatario sólo lectura en móvil; tercero excluido | PASS |
| Navegador: fallo real de Permissions, error visible sin vacío ficticio | PASS |
| Navegador: fallo real de Asset, sin contenido fabricado ni creación confirmada; borrador conservado | PASS |

Son **cinco escenarios API y tres escenarios de navegador**, ejecutados en fases
separadas: los casos de otras fases aparecen como skipped/pending por selección,
no como verificaciones omitidas de la entrega. También pasaron 55 tests de la
suite normal, lint, build y git diff --check. El rechazo de escritura se inyectó
con la restricción SQL acotada descrita arriba y se retiró al terminar.

Snippet de persistencia: `e3ffc867-d3e0-480e-80d2-7757dfab43ca`. Tras recrear los componentes, el
owner y Ana recuperaron el mismo código UTF-8 y los mismos metadatos/capacidades;
Bruno continuó recibiendo 404. El proveedor efectivo era `asset`; el directorio
de contenido local tenía **cero archivos**, de modo que no se certificó un
fallback accidental al adaptador local.

El proyecto conservó ocho snippets CONFIRMED y una reserva PENDING de la creación
fallida con Asset detenido. Se comprobó que esa reserva no aparece en el listado
público (`count=0` para su nombre); no se borró para ocultar el fallo. Las pruebas
locales dejaron datos con prefijo SNI36, sin modificar el proyecto Docker ajeno.

Capturas locales ignoradas por Git: `sni36-owner-shared`, `sni36-reader-mobile`,
`sni36-permissions-outage`, `sni36-storage-outage` y
`sni36-creation-not-confirmed`, bajo cypress/screenshots/sharing.cy.ts/.
Cypress conserva avisos previos de utilitarios macOS de otra arquitectura y Vite
su aviso de tamaño del bundle; las ejecuciones indicadas concluyeron con código 0.
No se cambiaron dependencias, contratos ni implementación de producción.

