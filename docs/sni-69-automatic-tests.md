# SNI-69 — Resultados automáticos

El detalle incorpora un panel de sólo lectura para los tests del último update.
La consulta `/snippets/{id}/automatic-tests` usa el mismo transporte e identidad
que el resto de la aplicación. El backend verifica acceso vigente y revisión;
la UI nunca deduce aprobación a partir del éxito del guardado.

La clave de caché incluye actor y snippet. Guardar contenido o crear tests
invalida esa clave. Hay polling espaciado durante PENDING/RUNNING/RETRY/UNKNOWN,
sólo con el detalle abierto y pestaña activa. Un error detiene el polling y
oculta datos en caché; el botón permite reintentar explícitamente.

PASSED/FAILED son comparaciones; errores del programa, errores técnicos y
resultado desconocido tienen estados propios. Outputs se presentan como lista
JSON para conservar orden, duplicados y strings vacíos. SUPERSEDED y
UNVERIFIABLE ocultan resultados históricos. No se agregan sesiones compartidas,
historial público ni acciones para volver a ejecutar automáticamente.

Verificación local 02/11/2026: `npm test` (103 pruebas), lint y build exitosos.
`cypress/e2e/backend/automatic-tests.cy.ts` pasó con API, PostgreSQL, Redis,
PrintScript, Permissions, Asset y Azurite reales. Comprueba guardado desde UI,
PASSED/FAILED con output real, owner/lector/tercero e invalidación por otro test.
Sólo se configura la identidad dev; no se simulan respuestas de proveedores.

Ejecutar con todos esos proveedores y UI en localhost:

```sh
npx cypress run --config specPattern=cypress/e2e/backend/automatic-tests.cy.ts
```

Requiere la API de SNI-69 en snippets-service; no se desplegó en Azure.
