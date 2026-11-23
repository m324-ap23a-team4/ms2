import { randomUUID } from 'node:crypto';
import express, { type ErrorRequestHandler } from 'express';
import { isCalendarDate } from './date';

export interface Immobilie {
  id: string;
  typ: string;
  zimmer: number;
  flaeche: number;
  ortschaftId: string;
  preis: number;
  verkaufsdatum: string | null;
}

interface ImmobilienDependencies {
  insert(immobilie: Immobilie): Promise<void>;
  ms1Url: string;
  request?: typeof fetch;
}

export function createApp({ insert, ms1Url, request = fetch }: ImmobilienDependencies) {
  const app = express();

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'ms2' });
  });

  app.post('/immobilien', express.json(), async (req, res) => {
    const { typ, zimmer, flaeche, ortschaftId, preis, verkaufsdatum = null } = req.body ?? {};

    if (typeof typ !== 'string' || !typ.trim()) {
      return res.status(400).json({ error: 'Validierungsfehler: Typ muss angegeben werden.', field: 'typ' });
    }
    for (const [field, value] of Object.entries({ zimmer, flaeche, preis })) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        return res.status(400).json({ error: `Validierungsfehler: ${field} muss grösser als 0 sein.`, field });
      }
    }
    if (typeof ortschaftId !== 'string' || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(ortschaftId)) {
      return res.status(400).json({ error: 'Validierungsfehler: Ortschaft-ID muss eine gültige UUID sein.', field: 'ortschaftId' });
    }
    if (verkaufsdatum !== null && !isCalendarDate(verkaufsdatum)) {
      return res.status(400).json({ error: 'Validierungsfehler: Verkaufsdatum muss null oder ein gültiges Datum im Format YYYY-MM-DD sein.', field: 'verkaufsdatum' });
    }

    let status: number;
    try {
      const response = await request(`${ms1Url.replace(/\/+$/, '')}/ortschaften/${ortschaftId}`, {
        method: 'GET',
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
      });
      status = response.status;
      await response.body?.cancel();
    } catch (error) {
      console.error('MS1-Validierung fehlgeschlagen', error);
      status = 0;
    }
    if (status === 404) {
      return res.status(400).json({
        error: 'Validierungsfehler: Angegebene Ortschaft existiert nicht in MS1.',
        field: 'ortschaftId',
      });
    }
    if (status !== 200) {
      return res.status(400).json({
        error: 'Validierungsfehler: Angegebene Ortschaft konnte in MS1 nicht geprüft werden.',
        field: 'ortschaftId',
      });
    }

    const immobilie: Immobilie = {
      id: randomUUID(), typ: typ.trim(), zimmer, flaeche, ortschaftId, preis, verkaufsdatum,
    };
    await insert(immobilie);
    return res.status(201).json(immobilie);
  });

  const handleError: ErrorRequestHandler = (error, _req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Validierungsfehler: Ungültiger JSON-Body.', field: 'body' });
    }
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request-Body ist zu gross.' });
    }
    console.error(error);
    return res.status(500).json({ error: 'Interner Serverfehler.' });
  };
  app.use(handleError);
  return app;
}
