# SNI-55: código vacío

Thiago aprobó el 28/10/2026 rechazar código vacío y compuesto sólo por espacios,
tabs o saltos de línea. La alternativa de rechazar únicamente longitud cero
permitía guardar un editor visualmente vacío. El costo aceptado es impedir nuevos
guardados de esos programas, aunque el intérprete pudiera aceptarlos.

El editor, la carga de archivos y el adaptador de escritura comparten la validación.
El backend vuelve a validar y responde 400 invalid-request con field=code antes de
consultar Language, reservar una creación o modificar el snippet. El mensaje es
visible y permite corregir el borrador; no depende sólo del estado del botón.

La UI reproduce String.isBlank de Kotlin, incluidos espacios Unicode, sin recortar
ni normalizar código admitido. Un BOM no cuenta como espacio en esa operación.
Los comentarios se delegan a la validación del lenguaje. Los blobs históricos
siguen siendo legibles: no se cambia AssetEnvelope ni se migran datos. Inputs y
outputs vacíos de tests mantienen su significado.

Verificación: tests del contrato de escritura, carga de archivos, lectura histórica
y navegador para creación vacía, reemplazo en blanco y upload en blanco con
reselección del mismo archivo. Estas pruebas de UI usan fixtures de contrato;
la validación HTTP/BD real se prueba en snippets-service.
