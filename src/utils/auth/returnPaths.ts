export const CALLBACK_PATH = '/auth/callback';
export const LOGOUT_RETURN_PATH = '/';
export const HOME_PATH = '/';
export const ALLOWED_RETURN_PATHS: readonly string[] = ['/', '/rules'];

export function safeReturnTo(value: unknown): string {
  return typeof value === 'string' && ALLOWED_RETURN_PATHS.includes(value) ? value : HOME_PATH;
}

export const absoluteAppUrl = (path: string) => window.location.origin + path;
