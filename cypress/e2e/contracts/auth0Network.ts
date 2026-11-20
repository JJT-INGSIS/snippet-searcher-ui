export const AUTH0_DOMAIN = 'jjt-snippet-searcher.us.auth0.com';
export const CLIENT_ID = 'BDuvRyQ6ryyye08Bs9ZEfRzw7AsskFs6';
export const AUDIENCE = 'https://jjt-snippets-dev.duckdns.org/api';
const ISSUER = 'https://' + AUTH0_DOMAIN + '/';
const TOKEN_SECONDS = 900;
const MILLIS = 1000;

export type FakeUser = {sub: string; name: string; email: string; accessToken: string};
type AuthorizeAnswer = {error?: string};

const base64Url = (value: object) =>
  btoa(unescape(encodeURIComponent(JSON.stringify(value)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function idToken(user: FakeUser, nonce: string) {
  const now = Math.floor(Date.now() / MILLIS);
  const claims = {iss: ISSUER, aud: CLIENT_ID, sub: user.sub, name: user.name, email: user.email, nonce, iat: now, exp: now + TOKEN_SECONDS};
  return base64Url({alg: 'RS256', typ: 'JWT'}) + '.' + base64Url(claims) + '.signature';
}

export function auth0Config(overrides: object = {}) {
  cy.intercept('GET', '/app-config.json', {environment: 'dev', identity: {
    mode: 'auth0', domain: AUTH0_DOMAIN, clientId: CLIENT_ID, audience: AUDIENCE, ...overrides,
  }});
}

export function auth0Network(user: () => FakeUser, answer: () => AuthorizeAnswer = () => ({})) {
  const cors = {'access-control-allow-origin': Cypress.config('baseUrl') ?? '', 'access-control-allow-credentials': 'true'};
  let nonce = '';
  cy.intercept('GET', 'https://' + AUTH0_DOMAIN + '/authorize*', req => {
    const query = new URL(req.url).searchParams;
    nonce = query.get('nonce') ?? '';
    const back = new URL(query.get('redirect_uri') ?? '');
    const error = answer().error;
    if (error) back.searchParams.set('error', error); else back.searchParams.set('code', 'code-' + user().sub);
    back.searchParams.set('state', query.get('state') ?? '');
    req.reply({statusCode: 302, headers: {location: back.toString()}});
  }).as('authorize');
  cy.intercept('OPTIONS', 'https://' + AUTH0_DOMAIN + '/oauth/token', {
    statusCode: 204, headers: {...cors, 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type, auth0-client'},
  });
  cy.intercept('POST', 'https://' + AUTH0_DOMAIN + '/oauth/token', req => {
    req.reply({statusCode: 200, headers: cors, body: {
      access_token: user().accessToken, id_token: idToken(user(), nonce), token_type: 'Bearer',
      expires_in: TOKEN_SECONDS, scope: 'openid profile email',
    }});
  }).as('token');
  cy.intercept('GET', 'https://' + AUTH0_DOMAIN + '/v2/logout*', req => {
    const back = new URL(req.url).searchParams.get('returnTo') ?? '/';
    req.reply({statusCode: 302, headers: {location: back}});
  }).as('logout');
}
