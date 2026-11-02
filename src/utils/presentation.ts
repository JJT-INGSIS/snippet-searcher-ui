import {ComplianceEnum} from './snippet';
import {ApiError} from './api/errors';
import {emptyCodeMessage} from './codeValidation';

export const lintLabels: Record<ComplianceEnum, string> = {
  'not-implemented': 'Sin evaluación', pending: 'Pendiente', failed: 'No se pudo evaluar',
  compliant: 'Sin infracciones', 'not-compliant': 'Con infracciones',
};
const problemMessages: Record<string, string> = {
  'invalid-request': 'Revisá los campos indicados y volvé a intentarlo.',
  'invalid-code': 'El código tiene errores. Revisá los diagnósticos antes de guardar.',
  'unsupported-language': 'Ese lenguaje no está disponible.',
  'unsupported-version': 'Esa versión no está disponible. Consultá el catálogo de lenguajes.',
  'identity-unavailable': 'No hay una identidad habilitada para esta operación.',
  'creation-conflict': 'Esta solicitud ya se usó con otros datos. Revisá la creación anterior.',
  'snippet-pending': 'La creación todavía no está confirmada. Reintentá la misma solicitud.',
  'snippet-not-found': 'El snippet no existe o no tenés acceso.',
  'modification-denied': 'Solo el propietario puede modificar este snippet.',
  'share-denied': 'No tenés permiso para compartir este snippet.',
  'invalid-recipient': 'Elegí un destinatario disponible.',
  'dependency-failure': 'No pudimos comunicarnos con un servicio necesario. Volvé a intentarlo.',
  'metadata-unavailable': 'No pudimos acceder a los metadatos. Volvé a intentarlo.',
  'storage-unavailable': 'No pudimos acceder al contenido. Volvé a intentarlo.',
  'technical-failure': 'Ocurrió un problema al procesar la solicitud. Volvé a intentarlo.',
};
export function errorMessage(error: Error): string {
  if (!(error instanceof ApiError)) return 'No pudimos completar la operación. Volvé a intentarlo.';
  const category = error.problem?.type.replace('urn:snippets:problem:', '');
  if (category === 'invalid-request' && error.problem?.field === 'code') return emptyCodeMessage;
  if (category && problemMessages[category]) return problemMessages[category];
  if (error.uncertain) return 'No recibimos confirmación del servidor. Revisá tu conexión y volvé a intentarlo.';
  return 'No pudimos completar la operación. Revisá los datos e intentá nuevamente.';
}
