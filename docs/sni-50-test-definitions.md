# SNI-50 — Definiciones de tests en la UI

Implementación local en `feat/sni-50-test-definitions`, desde `dev`. No implementa
el backend SNI-46 ni la ejecución SNI-47/48/49/51. La aceptación integrada real
corresponde a SNI-53, no a las interceptaciones de esta entrega.

## Contrato y comportamiento

Fuente: [contrato SNI-45](https://github.com/JJT-INGSIS/snippet-searcher-infra/blob/dev/docs/architecture/execution-contract.md).

- `GET /api/snippets/{uuid}/tests` → 200 JSON `{items: [...]}`.
- `POST /api/snippets/{uuid}/tests` → 201 JSON de la definición creada.
- Body: `{inputs: string[], expectedOutputs: string[]}`. Respuesta agrega `id`
  y `snippetId` UUID; no hay nombre, owner, actor ni resultado de ejecución en el body.
- Se conservan orden, duplicados, vacíos, espacios y Unicode. Una lista sin filas
  es `[]`; agregar una fila vacía representa `[""]`. Guardar no ejecuta el programa
  ni comprueba si las expectativas se cumplen.
- Se reutilizan Axios, identidad runtime y traducción de errores existentes.
  No hay llamadas del navegador a PrintScript, Permissions o Asset.
- Una representación incompatible, un UUID ajeno o una respuesta que modifica los
  valores enviados no confirma el guardado. La UI muestra el fallo, no una lista
  vacía ficticia ni un éxito optimista.

Desde el detalle, **Ver tests** abre el modal. Owner con capacidad de modificación
puede crear; un destinatario compartido solo consulta. Esto refleja el backend,
no reemplaza su autorización. Editar/borrar/ejecutar tests siguen deshabilitados.
`Test 1`, `Test 2` son etiquetas de presentación según el orden recibido: el UUID
es la identidad estable, no el número visual. No se inventa un nombre persistido.

## Decisiones y trade-offs

**Filas numeradas — aprobadas por Thiago el 26/10/2026**, tras explicar el contexto:
«bueno usa filas numericas y segui». Reemplazan los chips del componente provisto.
Permiten valores vacíos y repetidos y no requieren conocer JSON. Cuestan más
espacio vertical. Se descartó un editor de arrays JSON por su carga de sintaxis;
los chips existentes no representaban adecuadamente esta secuencia. Cambiar el
editor después no afecta al contrato HTTP ni a la persistencia.

Se conservan modal, tabs y componentes MUI existentes, sin nuevas dependencias ni
rediseño general. El cliente/DTO, hooks/cache y presentación permanecen separados.

**Caché por actor + snippet**, siguiendo la convención ya usada para detalle y
listados: `['testCases', actor, snippetId]`. Evita mezclar información entre
recursos/actores, a costa de entradas separadas. Se abortan lecturas desmontadas;
el modal se remonta por actor/snippet y descarta el borrador al cerrarse/navegar.
Los errores de refresco ocultan los datos cacheados en lugar de mantener visible
una lista potencialmente privada tras perder acceso.

**Guardado confirmado, no optimista:** se invalida solo la consulta del actor y
snippet que guardó; el modal se cierra después del 201 compatible, no después de
un GET adicional. Si falla, conserva el borrador. Un doble click no lanza otro POST
mientras haya uno pendiente. El rechazo del backend sigue siendo autoritativo.

**Sin retry automático del POST:** no hay idempotencia de creación de tests en
el contrato. Una respuesta perdida/5xx puede significar que sí se guardó. Se advierte
el riesgo de duplicación y se permite revisar el listado antes de una repetición
manual explícita. Esto no garantiza exactamente una creación ante fallos de red;
no se agrega una clave de idempotencia inventada ni se infiere éxito por coincidencia
de contenido. Chromium/proxies pueden repetir conexiones fuera del cliente: las
pruebas no se presentan como garantía de entrega exactamente una vez.

## Verificación reproducible

Con Node 24 y el lockfile existente:

```bash
npm ci
npm run build
npm run lint
npm test
```

En otra terminal, desde la raíz de la UI, iniciar el servidor local sin backend
(los tests siguientes interceptan únicamente los contratos HTTP):

```bash
npm run dev -- --host 127.0.0.1 --port 5190 --strictPort
```

```bash
npx cypress run --browser electron --config baseUrl=http://127.0.0.1:5190
```

Las pruebas cubren DTOs, transporte con servidor HTTP controlado, caché por actor/
snippet, creación con vacíos/duplicados, borrador ante fallo, lectura compartida,
lista fallida frente a vacía, navegación/respuesta tardía y edición móvil. Las
pruebas de conexión cortada del adaptador corren contra el servidor Node; la
prueba de incertidumbre en navegador usa 503 para no confundir retries de Chromium
tras una conexión destruida con retries de React Query.

Resultado local del 26/10/2026: **build y lint exitosos; 55 tests Vitest (25 nuevos)
y 23 tests Cypress de contrato (8 nuevos), sin fallos ni omisiones**. No se ejecutó
el recorrido con los endpoints reales de SNI-46, que siguen pendientes; no hay
evidencia de persistencia o autorización real de tests por esta suite.

Build conserva el aviso previo de bundle mayor a 500 KiB. La instalación reporta
vulnerabilidades del lockfile existente; no se aplicó `npm audit fix` ni se
actualizaron dependencias como parte de este ticket. Cypress 13.8.1/Electron emite
avisos locales de utilitarios Intel en macOS ARM; registrar el exit code de los
tests, no tratar esos avisos como evidencia de aprobación de seguridad.
