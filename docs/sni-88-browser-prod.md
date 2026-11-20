# SNI-88 — Browser separado por ambiente

La UI selecciona el agente por el ambiente del runtime y su origin HTTPS exacta.
DEV conserva su entidad `1103564597`; PROD usa `snippet-searcher-prod-ui`, entidad
`1103565589` de la misma cuenta `8718557`, creada el 20/11/2026. La configuración
Browser es pública y sirve para ingesta de navegador; no incluye la licencia de
servidor, credenciales de Auth0 ni JWT.

Se comparte la inicialización y las restricciones de privacidad existentes:
PageView/Timing/JSErrors, sin AJAX, distributed tracing, cookies, replay ni session
trace. Se admite sólo `/` o `/rules`, sin query ni fragmento. Callback, URLs con IDs,
localhost y origins/ambientes cruzados no inicializan el agente. La falla de carga
de Browser no impide iniciar la UI.

Una entidad por ambiente permite comparar PROD/DEV sin contaminar métricas y
alertas; cuesta mantener dos configuraciones públicas y promover una UI nueva.
La alternativa de reutilizar la entidad DEV reduce configuración pero mezcla sus
datos; no se eligió. Se conserva el alcance de privacidad de DEV en vez de activar
todas las capacidades del loader recomendado por el asistente de instalación.
Marco de trade-offs: capítulos 2/21 del
[índice de Fundamentals of Software Architecture, 2e](https://www.oreilly.com/library/view/fundamentals-of-software/9781098175504/).
La aplicación concreta es del proyecto.

Esto prepara instrumentación: el cierre requiere promover el digest verificado
en DEV, activar Auth0 en PROD y consultar recepción real en la entidad PROD.
