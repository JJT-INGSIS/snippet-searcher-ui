# SNI-35 — Diseño y usabilidad

## Alcance y decisiones

Implementación local en `feat/sni-35-ui-usability`, sobre `dev` de UI
`c914eeca93bb3c117bdf391e047578671a746cf2`. Fecha: 2026-10-24.
No incluye despliegues ni cambios de código de backend/infra. La integración de UI se realiza mediante PR a `dev`.

1. **Conservar React 18, Vite 5, MUI 5 y React Query 3.** Se reutilizan primitivas MUI y los componentes de la cátedra;
   se extraen responsabilidades concretas, sin un segundo sistema visual ni dependencias nuevas.
2. **Interfaz clara y editor oscuro.** Fondo `#f5f7fa`, superficies blancas, acento Sportmatch `#4ea8ff`;
   botones y texto de acción `#1769aa`, más oscuro para su contraste con blanco. Marca: Snippet Searcher.
3. **Tipografía local.** Geist Sans para interfaz, Geist Mono para código. WOFF2 de Vercel, revisión
   `75d647056bcbd9eaba3a14b1b58290d0692685d6` del repositorio `vercel/geist-font`:
   `fonts/Geist/webfonts/Geist[wght].woff2`, `fonts/GeistMono/webfonts/GeistMono[wght].woff2` y `LICENSE.txt`.
   Copias bajo `public/fonts/`, licencia SIL Open Font License. Sin llamadas a proveedores de fuentes en runtime.
4. **Estado con dueño concreto.** `useSnippetList` reemplaza el contexto global de paginación; conserva la solicitud
   aplicada, deriva totales del servidor y reinicia/recupera páginas. `useSnippetCreation` coordina intención inmutable,
   bloqueo y reintentos; `useSnippetEditor` conserva borradores durante refrescos. Las pantallas componen la presentación.
5. **Lecturas cancelables.** Nombre con debounce de 350 ms, claves por actor/filtros/página; Axios recibe `AbortSignal`.
   Durante un cambio de búsqueda no se muestran resultados anteriores como si fueran actuales. No se cancelan mutaciones.
6. **Estado confirmado.** Se conserva `Idempotency-Key`, actor y payload al reintentar un alta incierta, incluso al cerrar/reabrir.
   Su duración es la memoria de la página, no almacenamiento persistente. Un guardado confirmado y un refresco fallido son estados distintos.
7. **Accesibilidad y móvil.** Diálogos con título/descripción, cierre y foco gestionados por MUI, errores de formulario enfocados,
   botones nativos para abrir filas, skip link, etiquetas, foco visible y movimiento reducido. Tabla con scroll local;
   formularios apilados. No se incorpora una herramienta de auditoría ni se afirma certificación WCAG.
8. **Capacidades reales.** No se simulan lint, ejecución, tests, formato o eliminación. No se agregan endpoints, Auth0,
   CORS, NGINX ni CD. Se retira el temporizador heredado de `SnippetBox` que ocultaba el editor al encontrar `snake_case_variable`.

## Verificaciones

| Comprobación | Resultado |
| --- | --- |
| ESLint | Sin errores ni advertencias |
| Vitest unitario / servidor HTTP de contrato | 30 pruebas correctas: DTOs, configuración, errores, idempotencia, cancelación, upload y mensajes |
| TypeScript + build Vite | Correcto; advertencia existente de bundle mayor a 500 kB, sin cambiar el límite |
| Cypress de contratos | 15/15 correctas (7 de integración + 8 de usabilidad) |
| Adaptador contra backend real | POST 201, replay 200, conflicto 409, PUT 200, parser 422 con diagnósticos |
| Cypress contra backend real | Catálogo 200, upload `.PRS`/nombre con puntos/CRLF, versión 1.1 explícita, POST 201, búsqueda, total cero y limpiar filtros |
| Destinatarios reales | `GET /users?page=0&page_size=5&name=Ana`: 200, destinatario `dev-ana` |
| Teclado en navegador | Enter abre el detalle desde el botón de fila; cerrar devuelve el foco al mismo botón |
| Revisión visual | Escritorio y móvil 390 px, estado vacío y formulario con editor oscuro |
| Detalle y edición reales, después de actualizar SNI-31 | GET 200 con código/capacidades reales; nombre modificado desde la UI, persistencia y código exacto comprobados, nombre original restaurado |

Los contratos Cypress incluyen: cambio de página/filtros/tamaño, `count=0`, recuperación cuando disminuye el total,
respuesta tardía, error/reintento, borrador tras refetch, permanencia del editor después de 5 segundos,
Escape y restauración de foco, expiración de mensajes, creación incierta, diagnóstico, solo lectura y sharing con reintento.

### Backend local utilizado

Servicios locales y PostgreSQL de infra; Snippets Java con perfil `dev` en puerto 18080 y Vite:

```powershell
$env:UI_DEV_ACTOR = 'dev-juanfran'
$env:API_PROXY_TARGET = 'http://127.0.0.1:18080'
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Con Compose completo y Snippets en 8080, usar ese puerto en `API_PROXY_TARGET`.
La prueba no utiliza VMs ni modifica producción. Las bases y el volumen local se conservan.
Quedaron registros de prueba identificados `SNI-35-browser-...` (incluido un intento de prueba anterior) y un
`SNI-34 adapter smoke ...` creado por el verificador existente. No se agrega un borrado fuera de alcance.

En otra terminal:

```powershell
npm run lint
npm test
npm run build
npm run test:contracts
npm run test:backend
npm run test:browser:backend
```

Los tests unitarios requieren loopback para su servidor HTTP. Cypress requiere Vite; solo los dos últimos comandos requieren backend.
`test:contracts` no comparte el patrón de specs con `test:browser:backend` y puede seguir ejecutándose sin servicios reales.
Capturas locales (ignoradas por Git): `cypress/screenshots/sni35-browser-desktop.png` y
`cypress/screenshots/usability.cy.ts/sni35-{desktop,mobile,empty-mobile,upload-desktop}.png`.

## Límites y pendientes

- **Actualización de la evidencia, 2026-10-24:** el error inicial del detalle provenía de ejecutar el backend anterior a SNI-31.
  Se actualizó el checkout limpio de Snippets a `dev`, commit `3d68ed7` (PR #34), se compiló con `bootJar` y se reinició
  en el mismo puerto 18080, conservando datos y storage local. Permissions ya ejecutaba `949885c`, con la consulta de acceso necesaria.
  `GET /snippets/6da15a25-e782-4cfb-a527-c831590638f0` respondió 200, código exacto `println(35);\r\n`, relación owned
  y capacidades de modificar/compartir. Se abrió el detalle en el navegador y se guardó un cambio de nombre; otra lectura HTTP
  confirmó su persistencia y el código exacto. Se restauró el nombre original desde la UI. Captura: `cypress/screenshots/sni35-real-detail.png`.
- **Sharing público:** sigue pendiente de aceptación real; su formulario está probado con contratos interceptados.
  Las pruebas locales de detalle/edición no cierran por sí solas US6 ni la aceptación completa con Asset Service.
- **Seguridad/despliegue:** Auth0, HTTPS, CORS, proxy y aceptación contra storage oficial pertenecen a sus tickets.
- **Rendimiento:** se mantiene la advertencia de tamaño heredada. No se agregaron imports de todas las gramáticas ni dependencias visuales.
- **Revisión del usuario:** la publicación de la rama fue autorizada después de las pruebas. La descripción de PR se presenta
  para aprobación antes de crearla. El estado de Linear permanece en progreso hasta revisión e integración.
