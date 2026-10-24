# Probar la UI localmente — guía del equipo

Los repositorios ya deben estar clonados como carpetas hermanas:

```text
snippet-searcher/
├── snippet-searcher-ui/
├── snippet-searcher-infra/
├── snippets-service/
├── permissions-service/
└── printscript-service/
```

Los ejemplos usan PowerShell y `C:\dev\ingsis\snippet-searcher`. Cada integrante adapta esa ruta.
Requisitos: Git, Node.js 24/npm y Docker Desktop con motor Linux. Docker construye el backend;
para este recorrido no hace falta instalar Java o Gradle en la computadora ni encender VMs de Azure.

## 1. Tener el código actualizado

Usar el código integrado en `dev` de los cinco repositorios. Si el checkout está limpio, en cada repo:

```powershell
git switch dev
git pull --ff-only
```

Revisar `git status` antes; si hay trabajo local o ramas de un ticket en curso, conservarlo y coordinar su integración.
No borrar archivos ni usar reset para seguir esta guía. Las mejoras visuales SNI-35 se prepararon en
`feat/sni-35-ui-usability`; estarán en el recorrido habitual de `dev` después de integrar su PR.

Actualizar el código no actualiza automáticamente una imagen Docker ni un proceso Java que ya está ejecutándose.
El detalle requiere SNI-31 integrado en Snippets y las consultas de acceso de SNI-28 en Permissions.

## 2. Preparar el backend una sola vez

Abrir Docker Desktop y entrar al repo **de infra**:

```powershell
cd C:\dev\ingsis\snippet-searcher\snippet-searcher-infra
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Editar `.env` sin sobrescribir valores existentes:

| Variable | Qué completar |
| --- | --- |
| `GITHUB_ACTOR` | Usuario de GitHub del integrante |
| `GITHUB_TOKEN` | Su PAT con `read:packages` y acceso a los paquetes del equipo |
| `SNIPPETS_DB_PASSWORD` | Contraseña local de la base de Snippets |
| `PERMISSIONS_DB_PASSWORD` | Contraseña local de la base de Permissions |

Los puertos de bases pueden ajustarse con `SNIPPETS_DB_PORT` y `PERMISSIONS_DB_PORT` si están ocupados.
No cambiar contraseñas de una base ya inicializada esperando que eso modifique el volumen: consultar el README de infra.
Las credenciales pertenecen al `.env` de infra, ignorado por Git. No copiarlas a la UI ni compartirlas por chat.

Construir y levantar:

```powershell
docker compose config --quiet
docker compose build
docker compose up -d
docker compose ps
```

Detenerse y revisar el error si un comando falla. Esperar a que las dos bases estén `healthy` y Spring haya iniciado.
Ver los logs si es necesario:

```powershell
docker compose logs --tail 100 snippets-service permissions-service printscript-service
```

Snippets queda en `127.0.0.1:8080`, Permissions en `8081` y PrintScript en `8082`.
Para sesiones posteriores basta `docker compose up -d`. **Después de actualizar código de servicios**, reconstruirlos:

```powershell
docker compose up --build -d
```

Los datos se conservan en los volúmenes. Cada integrante tiene sus propios datos locales.

## 3. Preparar la UI una sola vez

Abrir otra terminal y entrar al repo **de la UI**:

```powershell
cd C:\dev\ingsis\snippet-searcher\snippet-searcher-ui
npm ci
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
```

Editar `.env.local`:

```dotenv
UI_DEV_ACTOR=dev-juanfran
API_PROXY_TARGET=http://127.0.0.1:8080
```

Cada integrante elige su identidad de desarrollo:

| Integrante | `UI_DEV_ACTOR` |
| --- | --- |
| Juan Francisco | `dev-juanfran` |
| Juanchi | `dev-juan` |
| Thiago | `dev-thiago` |

También existen `dev-ana` y `dev-bruno` para pruebas. Esto no es autenticación ni una contraseña.
Solo se utiliza con backend local en perfil `dev`. La UI no necesita tokens de GitHub ni secretos.

`API_PROXY_TARGET` apunta a **Snippets**, no a Permissions ni PrintScript. El puerto habitual con Compose es 8080.
La revisión asistida de SNI-35 usó temporalmente un backend Java en 18080; ese puerto solo sirve mientras ese proceso esté
levantado. Para el uso normal del equipo con Compose, conservar 8080. Reiniciar Vite después de editar `.env.local`.

Si cambió `package-lock.json` al actualizar la UI, volver a ejecutar `npm ci`.

## 4. Abrir la UI cada vez que se quiera usar

Con Docker/backend levantados, desde **`snippet-searcher-ui`**:

```powershell
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Abrir **http://127.0.0.1:5173/**. Dejar esa terminal abierta: es el proceso que sirve la UI.
Si PowerShell bloquea `npm.ps1`, usar `npm.cmd` con los mismos argumentos, sin cambiar la política del sistema.

El navegador pide `/api/...` al mismo origen y Vite lo reenvía al Snippets configurado.
No hace falta un NGINX local para este recorrido. `npm run preview` sirve el build pero no este proxy de desarrollo.
`127.0.0.1` es la computadora de quien abre la dirección; no permite entrar a la máquina de otro integrante.

## 5. Recorrido manual

1. Abrir el listado. Una base nueva puede estar vacía: crear un snippet propio.
2. Pulsar **Nuevo snippet → Crear snippet**, completar nombre/código y elegir lenguaje y versión; guardar.
3. Buscarlo por nombre, buscar algo inexistente y limpiar filtros. Probar orden y paginación si hay suficientes registros.
4. Abrir su nombre para ver el detalle/código. Editar y guardar; cerrar/reabrir para comprobar los cambios.
5. Probar **Subir archivo** con `.prs` y elegir explícitamente una versión.
6. Achicar la ventana para móvil y recorrer controles con Tab; Escape cierra los diálogos cuando no hay un envío pendiente.

Listado, catálogo, alta, detalle y edición se verificaron contra servicios locales reales.
Compartir tiene su formulario integrado, pero su aceptación completa con backend real y otros actores sigue pendiente.
Tests, ejecución, formato y eliminación permanecen deshabilitados hasta sus historias correspondientes.
Ver [evidencia y límites de SNI-35](sni-35-validation.md).

## 6. Diagnóstico rápido

| Qué pasa | Qué revisar |
| --- | --- |
| No abre la página | La terminal de Vite debe seguir abierta y mostrar el puerto 5173 |
| Puerto 5173 ocupado | Ya hay una UI ejecutándose; usarla o detenerla en su terminal antes de iniciar otra |
| Página visible pero API falla | Docker/backend levantados y `API_PROXY_TARGET` correcto; revisar logs |
| Sin catálogo | Snippets actualizado con SNI-54; no hay catálogo inventado de respaldo |
| Detalle falla aunque el listado anda | Snippets actualizado con SNI-31 y Permissions con SNI-28; reconstruir/reiniciar imágenes antiguas |
| Error de identidad | `UI_DEV_ACTOR` válido y backend en perfil `dev`; reiniciar Vite tras cambiar configuración |
| Un snippet no aparece | Actor elegido, filtros y base local; los snippets de otra computadora no están en esta base |

## 7. Terminar

En **la terminal donde se ejecutó `npm run dev`**, pulsar **Ctrl+C** para detener la UI.
Cerrar la pestaña del navegador no detiene el proceso. Detener la UI tampoco detiene el backend.

Para bajar el backend levantado con Compose, desde **infra**:

```powershell
docker compose down
```

Esto conserva los volúmenes y sus datos. No agregar `--volumes` si se quieren conservar.
Si Snippets se inició aparte con Java/IntelliJ, detener también ese proceso desde su terminal/IDE.
