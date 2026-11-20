# SNI-51 — ejecución incremental en los paneles existentes

## Alcance y decisiones

Thiago aprobó el 28 de octubre de 2026 integrar el panel dentro del detalle del
snippet y del modal de tests. La alternativa de una pantalla dedicada daba más
espacio, pero agregaba navegación y una ruta. Se conservan React/MUI y los estilos
existentes, sin dependencias nuevas ni cambios de CD.

Se implementa el [contrato SNI-45 aprobado](https://github.com/JJT-INGSIS/snippet-searcher-infra/blob/001542761edc302f6e736e78efa71747e4035030/docs/architecture/execution-contract.md):
fetch con NDJSON y POST separados para inputs/cancelación. La UI sólo llama a
Snippets bajo `/api`, nunca a PrintScript. Axios y fetch reutilizan la selección
centralizada de identidad: header explícito en dev; sin actor arbitrario en prod.
La autenticación futura debe incorporar sus credenciales también al transporte fetch.

## Comportamiento

- Ejecutar un test usa el ID de una definición guardada. Los lectores compartidos
  pueden ejecutarla sin obtener permiso para editarla. El test nuevo debe guardarse primero.
- La ejecución interactiva utiliza el código guardado en el servidor; no envía el
  borrador del editor. El resultado identifica su sesión y advierte que la vigencia
  respecto del contenido actual no ha sido verificada.
- El output es de sólo lectura y conserva entradas vacías, duplicados, orden,
  espacios y Unicode. Cada llamada de output ocupa una fila; los números son presentación.
- El formulario de input sólo aparece ante `input-required`, envía su `requestId`
  y admite el string vacío. No agrega echo local. Bloquea doble envío y espera
  `input-accepted`; una confirmación POST tardía no cambia un prompt posterior.
  Ante entrega incierta sólo permite reenviar el mismo valor para ese requestId.
- Un único coordinador por contexto de API coordina TEST e INTERACTIVE y reserva
  desde antes del POST. La autoridad sobre capacidad/autorización permanece en
  Snippets; no promete coordinación entre pestañas o procesos.
- El reducer de eventos es puro: recibe un snapshot y devuelve un estado nuevo o
  un error tipado. La mutabilidad necesaria para suscripciones, abortos y requests
  queda en el borde de I/O, no en la progresión del dominio.
- El lector ensambla líneas y caracteres UTF-8 fragmentados, valida IDs, modo,
  eventos y secuencias, deduplica replay y limita la línea pendiente/salida por las
  cotas efectivas. No ordena ni normaliza el stream.
- EOF, timeout o un evento inválido sin terminal dejan resultado desconocido,
  conservando el output parcial. Reconectar consulta la sesión y continúa desde
  el último cursor aplicado. Nunca repite el POST de inicio automáticamente.
- Un inicio sin confirmación permite otro intento sólo por acción explícita y
  avisa de la incertidumbre. Una sesión conocida sigue reservada mientras no se
  confirme su término o el servidor rechace su acceso/existencia. Un 401/403/404
  elimina los outputs/prompt retenidos; no reconstruye permisos ni crea otra ejecución.
- Detener solicita cancelación; `202 CANCELLING` no significa CANCELLED. El estado
  terminal/evento del servidor es quien acredita la finalización. Cerrar/cambiar
  el panel aborta sus lecturas/inputs y solicita cancelar la sesión conocida;
  respuestas/eventos de una generación anterior se ignoran. Una cancelación que
  siga sin confirmar exige volver al panel y reconectar. Cerrar HTTP no prueba
  que haya terminado el intérprete.
- COMPLETED con PASSED/FAILED sólo se muestra según la comparación enviada por
  Snippets. Fallas técnicas, límites, errores de programa, interrupciones y
  cancelaciones no se convierten en diferencias de expectativas.

## Verificación y límites

```sh
npm test
npm run lint
npm run build
# En otra terminal: npm run dev -- --host 127.0.0.1
npm run test:contracts
```

Verificados el 28 de octubre de 2026: 73 pruebas Vitest, lint/build y 28 casos
Cypress. Las 15 pruebas HTTP de ejecución usan un servidor Node local: mantienen
el terminal retenido hasta observar el output, separan UTF-8 entre chunks, piden
inputs reales por HTTP, comprueban cursores, duplicados, pérdida de confirmaciones,
revocación de acceso y cancelación pendiente. Tres pruebas del reducer comprueban
inmutabilidad, límites UTF-8 y eventos tardíos durante cancelación.

Los cinco casos Cypress nuevos verifican el modal de tests, output/input, stop,
exclusión entre modos, reconexión y cambio de snippet. Para mantener abierto el
stream antes de afirmar sobre el DOM, algunos casos controlan un ReadableStream
en el navegador; start/input/cancel conservan el adaptador HTTP normal con
intercepciones. Los tests HTTP anteriores prueban el transporte real.

Esta es una implementación de UI contra contrato. No acredita endpoints de
SNI-48/SNI-49 ni ejecución integrada con el intérprete; esa aceptación corresponde
a SNI-53. El historial durable decidido para SNI-48 no se implementa ni simula en
el navegador. La advertencia de tamaño de bundle (>500 KiB) ya existía.
