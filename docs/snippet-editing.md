# Guardar sólo cambios reales — SNI-115

El editor habilita Guardar cambios sólo si el borrador es válido y difiere de la
versión guardada en nombre, descripción, lenguaje, versión o código. Volver al
valor original o subir un archivo idéntico no habilita el guardado. Después de
guardar, la lectura actualizada del servidor pasa a ser la comparación vigente.
Un error de guardado conserva el borrador para reintentar.

Se reutiliza `hasUnsavedChanges` en `canSaveEditDraft`; el hook vuelve a comprobar
esa condición al enviar. No se agregan decisiones distintas al botón y al envío.
Se comparan valores exactos: no se recortan espacios ni se confunden descripción
nula y vacía, porque el contrato distingue esos valores.

Se descarta usar un PUT idéntico como botón de reevaluación de lint. Evitarlo
reduce llamadas, nuevas revisiones y trabajos innecesarios, pero elimina ese
atajo accidental. El recálculo por cambio de reglas depende del procesamiento
de fondo, no de una edición ficticia. El backend conserva su contrato: este
cambio no deduplica pedidos de otros clientes ni resuelve concurrencia de edición.

En PROD se comprobó que faltaban Redis y los flags de publicador/consumidor.
Eso explica los trabajos pendientes de reglas y tests; es una corrección de
runtime separada, no un motivo para alterar sus handlers ni ocultar PENDING.

Verificación local: 272 tests Vitest; lint y build aprobados; ocho casos Cypress
de `snippet-update.cy.ts` aprobados con transporte simulado. Cubren guardado inicial
deshabilitado, reversión, archivo idéntico, respuesta guardada y ediciones válidas.
Estas pruebas no acreditan activación de workers ni despliegue en PROD.
