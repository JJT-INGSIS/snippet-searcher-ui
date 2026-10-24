# SNI-34 — evidencia de verificación

Fecha: 24 de octubre de 2026.

## Base y alcance

- UI upstream: austral-ingsis/printscript-ui, 8ac3338873602e5263365670cd3b88d48202365e.
- Node 24.19.0 / npm 11.17.0, Windows.
- Se mantiene React 18, MUI 5, React Query 3 y Vite 5. Se agrega Vitest 3.2.6 compatible con esa base.
- No se implementaron endpoints de otras historias, Auth0, CORS, NGINX ni CD de UI.
- El lint heredado tenía dos @ts-expect-error sin explicación; se documentaron para que el check existente pase.
- Los tests upstream asumían un POST con código en la respuesta y rutas de login inexistentes: se reemplazaron por contratos explícitos.

## Checks ejecutados

- Instalación inicial con npm ci --ignore-scripts y posterior instalación oficial de Cypress. Al terminar se verificó npm ci limpio, lint, tests y build. npm rebuild cypress esbuild también pasó; los dos scripts permitidos quedaron fijados por versión en package.json.
- npm run lint.
- npm test: 26 casos unitarios y de integración HTTP contra un servidor local de contrato.
- npm run build: TypeScript y bundle de producción.
- npm run test:contracts: 7 pruebas de navegador Cypress/Electron, con contratos interceptados.
- git diff --check.

Después de las pruebas se detuvo Vite y el Compose local iniciado para verificarlas, conservando volúmenes y datos.

Las pruebas incluyen: descripción nullable/empty, código con espacios/saltos, listas sin contenido, capacidad de solo lectura,
acknowledgments sin Snippet fabricado, errores y diagnósticos, aislamiento por actor, clave y payload estables tras desconexión,
rechazo de otra identidad, catálogo faltante, upload JSON, refresco fallido después de guardar y sharing no confirmado.

## Escrituras contra backend local real

Se inició el Compose local existente, sin rebuild ni cambios a repos de backend.

Imagen Snippets utilizada:
`sha256:18b1e5cd3d814f03aac507d12670c1da0a256f9e4728362df5cfc963d09019b1` (construida 12 de octubre).
Perfil Spring confirmado por logs: dev. PostgreSQL: migraciones validadas, versión de esquema 2.

Se ejecutó `npm run test:backend`, usando el adaptador de UI a través del proxy Vite `/api`:

| Pedido | Resultado |
| --- | --- |
| POST /snippets con clave UUID | 201 y metadatos, sin code/owner |
| Repetir misma clave y body | 200, mismo UUID |
| Misma clave con otro body | 409 creation-conflict |
| PUT /snippets/{id} con reemplazo completo | 200, metadatos actualizados |
| POST con código inválido | 422 invalid-code con diagnostics |

UUID de la prueba ejecutada: `d1550ad1-b625-4dbf-8c33-d9a384b83caa`.
Se dejó ese registro identificado como prueba local. No existe endpoint de borrado en esta tanda.

Esta prueba verifica el adaptador y la reescritura del proxy, **no el recorrido completo del navegador con un catálogo real**.
La imagen local es evidencia del contrato de escrituras implementado; no certifica todos los cambios posteriores de dev ni Asset Service.

## Pendientes reales

- GET /languages: dependencia explícita de backend, asignada a Juan Francisco en SNI-54. No hay valores de fallback. La creación desde UI queda sin selector válido mientras falte.
- GET /snippets, GET /snippets/{id}, GET /users y PUT /snippets/{id}/shares/{userId}: pruebas de contrato, no aceptación de backend.
- La aceptación con endpoints reales, ownership y almacenamiento oficial corresponde a SNI-36.
- CORS/HTTPS, UI desplegada en Swarm y Auth0 están fuera de esta verificación.
- La recuperación de la clave POST tras recargar la página no está implementada; el límite se informa en formulario y README.
- La corrección de count=0 y reinicio de página al filtrar sigue en SNI-35.
- El build informa el aviso de tamaño de chunk heredado. No se introdujo una tarea de optimización del bundle.
- La instalación heredada reportó 39 vulnerabilidades de dependencias antes de este cambio. Revisar la actualización en una tarea acotada antes del despliegue; no se usó npm audit fix --force.

## Estado de entrega

Implementación en feat/sni-34-http-ui para revisión mediante PR a dev. Estas son verificaciones locales previas a la integración; no sustituyen CI en GitHub ni la aceptación completa de SNI-36.
El fork remoto y sus ramas base conservan el historial de la cátedra.
