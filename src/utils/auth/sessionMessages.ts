const failures: Record<string, string> = {
  access_denied: 'Se canceló el inicio de sesión o no se otorgó el acceso.',
  missing_transaction: 'El enlace de inicio de sesión no es válido o ya se usó.',
  invalid_state: 'El enlace de inicio de sesión no es válido o ya se usó.',
  unauthorized: 'Tu cuenta no tiene acceso a esta aplicación.',
};

const fallback = 'Ocurrió un problema al iniciar sesión.';

export function sessionFailureMessage(code: string | null): string {
  return code && Object.prototype.hasOwnProperty.call(failures, code) ? failures[code] : fallback;
}

export function initialsOf(name: string): string {
  const words = name.split(/[\s@._-]+/).filter(Boolean);
  return words.slice(0, 2).map(word => word[0].toUpperCase()).join('') || '?';
}
