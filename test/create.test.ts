import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { test, type TestContext } from 'node:test';
import { createApp, type Immobilie } from '../src/app';

const ms1Url = 'http://ms1.local:3000';
const valid = {
  typ: 'Haus', zimmer: 5.5, flaeche: 145,
  ortschaftId: 'c3f8a4b2-9d1e-4f7a-8b2c-1e4d5a6b7c8d',
  preis: 1250000, verkaufsdatum: null,
};

async function setup(t: TestContext, ms1Status: number) {
  const stored: Immobilie[] = [];
  const request = t.mock.fn<typeof fetch>(async () => new Response(null, { status: ms1Status }));
  const server = createApp({
    ms1Url,
    request,
    async insert(immobilie) {
      stored.push(immobilie);
    },
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const { port } = server.address() as AddressInfo;

  return {
    stored,
    request,
    post: (body: object) => fetch(`http://127.0.0.1:${port}/immobilien`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  };
}

/** Prüft den HTTP-Aufruf an MS1 und das anschliessende Speichern bei Status 200. */
test('speichert eine Immobilie nach erfolgreicher MS1-Prüfung', async (t) => {
  const { stored, request, post } = await setup(t, 200);
  const response = await post(valid);
  assert.equal(response.status, 201);
  const { id, ...fields } = await response.json();
  assert.match(id, /^[0-9a-f-]{36}$/);
  assert.deepEqual(fields, valid);
  assert.deepEqual(stored, [{ id, ...valid }]);
  assert.equal(request.mock.callCount(), 1);
  const [url, options] = request.mock.calls[0].arguments;
  assert.equal(url, `${ms1Url}/ortschaften/${valid.ortschaftId}`);
  assert.equal(options?.method, 'GET');
});

/** Prüft, dass MS1-Status 404 einen Feldfehler auslöst und kein Datensatz entsteht. */
test('lehnt eine unbekannte Ortschaft ab', async (t) => {
  const { stored, post } = await setup(t, 404);
  const response = await post(valid);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: 'Validierungsfehler: Angegebene Ortschaft existiert nicht in MS1.',
    field: 'ortschaftId',
  });
  assert.equal(stored.length, 0);
});

/** Prüft, dass Zimmerzahl und Preis vor dem Aufruf von MS1 validiert werden. */
test('lehnt ungültige Zimmerzahlen und Preise ab', async (t) => {
  const { stored, request, post } = await setup(t, 200);
  for (const [field, value] of [['zimmer', -1], ['preis', 0]] as const) {
    const response = await post({ ...valid, [field]: value });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).field, field);
  }
  assert.equal(request.mock.callCount(), 0);
  assert.equal(stored.length, 0);
});

/** Prüft, dass bei einem MS1-Fehler keine Immobilie gespeichert wird. */
test('weist eine nicht prüfbare Ortschaft bei einem MS1-Fehler ab', async (t) => {
  const { stored, post } = await setup(t, 503);
  const response = await post(valid);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).field, 'ortschaftId');
  assert.equal(stored.length, 0);
});
