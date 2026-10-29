export const emptyCodeMessage = 'El código no puede estar vacío. Agregá código antes de guardar.';

// Matches Kotlin String.isBlank(); unlike trim(), a UTF-8 BOM is not whitespace here.
function whitespace(character: string): boolean {
  const code = character.charCodeAt(0);
  return (code >= 9 && code <= 13) || (code >= 28 && code <= 32)
    || /^[\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]$/.test(character);
}

export function snippetCodeError(code: string): string | undefined {
  return Array.from(code).every(whitespace) ? emptyCodeMessage : undefined;
}
