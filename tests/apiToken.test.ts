import { describe, it } from 'node:test';
import assert from 'node:assert';
import type http from 'node:http';
import { API_TOKEN_HEADER, UNAUTHORIZED_MESSAGE, apiTokenFromRequest, verifyApiToken } from '@backend/server/auth/apiToken';

/** B4 — the shared, constant-time token check used by every ingress. */

describe('Verifica token API constant-time (B4)', () => {
  it('accepts an exact token and rejects a different one', () => {
    assert.strictEqual(verifyApiToken('secret-token', 'secret-token'), true);
    assert.strictEqual(verifyApiToken('secret-token', 'secret-tokeN'), false);
    assert.strictEqual(verifyApiToken('secret-token ', 'secret-token'), false);
  });

  it('rejects missing, empty and short values without throwing', () => {
    assert.strictEqual(verifyApiToken(undefined, 'secret-token'), false);
    assert.strictEqual(verifyApiToken('', 'secret-token'), false);
    assert.strictEqual(verifyApiToken('s', 'secret-token'), false);
    assert.strictEqual(verifyApiToken('short', 'a-much-longer-expected-token'), false);
    assert.strictEqual(verifyApiToken('anything', ''), false);
  });

  it('exposes the canonical header name and the B0 envelope message', () => {
    assert.strictEqual(API_TOKEN_HEADER, 'x-wikiforge-token');
    assert.strictEqual(UNAUTHORIZED_MESSAGE, 'Unauthorized: Invalid or missing X-WikiForge-Token');
  });
});

describe('Estrazione token dalla richiesta (B4)', () => {
  const request = (
    headers: Record<string, string | string[] | undefined>,
  ): Pick<http.IncomingMessage, 'headers'> => ({ headers: headers as http.IncomingHttpHeaders });

  it('reads X-WikiForge-Token as a string and trims it', () => {
    assert.strictEqual(apiTokenFromRequest(request({ 'x-wikiforge-token': ' secret-token ' })), 'secret-token');
  });

  it('reads the first value of a repeated X-WikiForge-Token header', () => {
    assert.strictEqual(
      apiTokenFromRequest(request({ 'x-wikiforge-token': ['secret-token', 'second'] })),
      'secret-token',
    );
  });

  it('accepts Authorization: Bearer with any casing', () => {
    assert.strictEqual(apiTokenFromRequest(request({ authorization: 'Bearer secret-token' })), 'secret-token');
    assert.strictEqual(apiTokenFromRequest(request({ authorization: 'bearer secret-token' })), 'secret-token');
  });

  it('accepts a raw Authorization header and an array form', () => {
    assert.strictEqual(apiTokenFromRequest(request({ authorization: 'secret-token' })), 'secret-token');
    assert.strictEqual(apiTokenFromRequest(request({ authorization: ['secret-token'] })), 'secret-token');
  });

  it('prefers X-WikiForge-Token over Authorization', () => {
    assert.strictEqual(
      apiTokenFromRequest(request({ 'x-wikiforge-token': 'direct', authorization: 'Bearer other' })),
      'direct',
    );
  });

  it('returns undefined for absent or blank headers', () => {
    assert.strictEqual(apiTokenFromRequest(request({})), undefined);
    assert.strictEqual(apiTokenFromRequest(request({ 'x-wikiforge-token': '   ' })), undefined);
    assert.strictEqual(apiTokenFromRequest(request({ 'x-wikiforge-token': [''] })), undefined);
    assert.strictEqual(apiTokenFromRequest(request({ authorization: 'Bearer   ' })), undefined);
    assert.strictEqual(apiTokenFromRequest(request({ authorization: [] })), undefined);
  });
});
