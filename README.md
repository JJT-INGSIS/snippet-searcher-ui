# Snippet Searcher UI

Cliente web basado en la UI de la cátedra, con React, MUI, Vite y React Query. Permite crear, editar, buscar, compartir, descargar, ejecutar y probar snippets, y configurar las reglas personales de formato y lint. [Proyecto de origen](https://github.com/austral-ingsis/printscript-ui)

## Desarrollo local

Usá Node 24 y npm. Levantá el backend desde el repo de infraestructura con Docker Compose. El frontend local usa Vite y el proxy hacia Snippets. [Configuración del stack](https://github.com/JJT-INGSIS/snippet-searcher-infra#readme)

Desde este repo, copiá `.env.example` a `.env.local` si todavía no existe y ejecutá:

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Abrí `http://127.0.0.1:5173/`. `API_PROXY_TARGET` apunta a Snippets (el ejemplo usa `http://127.0.0.1:8080`). Vite retira el prefijo `/api` al reenviar. `UI_DEV_ACTOR` selecciona el actor del catálogo local y requiere el perfil `dev` del backend. Vite debe reiniciarse al cambiar estas variables.

## Integración con Snippets

El navegador llama a `/api` en el mismo origen. Auth0 gestiona la sesión desplegada y el cliente adjunta el access token. Snippets valida identidad y acceso, y expone las capacidades que habilitan acciones en la UI. [Contratos HTTP de Snippets](https://github.com/JJT-INGSIS/snippets-service/blob/dev/docs/ui-integration.md)

- **Guardado.** Archivo y editor envían texto en `code`. El alta conserva en memoria su clave de idempotencia y el mismo pedido mientras el resultado sea incierto. La UI valida código en blanco antes de guardar. Un refresco fallido después de una confirmación se informa por separado.
- **Formato y lint.** Las reglas se guardan por lenguaje y versión. Después del guardado, la UI consulta el progreso del trabajo. La descarga formateada pide el código guardado y genera el archivo en el navegador con la extensión del lenguaje. La descarga original usa el código del detalle.
- **Ejecución y tests.** Las sesiones usan el código guardado y reciben eventos NDJSON. Si se corta el stream, la UI permite reconectar desde el último evento recibido. El estado terminal del servidor confirma la finalización. El panel de resultados automáticos muestra los tests vigentes de la última actualización y actualiza el progreso mientras el detalle está abierto.

## Verificación

| Comando | Qué comprueba |
| --- | --- |
| `npm run lint` · `npm test` · `npm run build` | ESLint, tests Vitest y bundle en `dist/`. |
| `npm run test:contracts` | Cypress con Vite iniciado. Intercepta las respuestas para probar el contrato de UI. |
| `npm run test:backend` · `npm run test:browser:backend` | Pruebas explícitas con backend local y actor de prueba. Crean datos en el entorno local. Los recorridos de fondo requieren el publicador y consumidor habilitados. |
| `npm run test:container` | Imagen y configuración runtime con Docker. |

Las PR apuntan a `dev`.

## Despliegue

La guía cubre la imagen, la configuración pública de Auth0, New Relic Browser y la promoción por digest. [Guía de despliegue](docs/deployment.md)
