import 'dotenv/config';
import { Pool } from 'pg';
import { createApp } from './app';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });

async function start() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS immobilien (
      id UUID PRIMARY KEY,
      typ TEXT NOT NULL,
      zimmer DOUBLE PRECISION NOT NULL CHECK (zimmer > 0),
      flaeche DOUBLE PRECISION NOT NULL CHECK (flaeche > 0),
      ortschaft_id UUID NOT NULL,
      preis NUMERIC NOT NULL CHECK (preis > 0),
      verkaufsdatum DATE
    )
  `);

  const app = createApp({
    ms1Url: process.env.MS1_URL || 'http://localhost:3001',
    async insert({ id, typ, zimmer, flaeche, ortschaftId, preis, verkaufsdatum }) {
      await pool.query(
        `INSERT INTO immobilien (id, typ, zimmer, flaeche, ortschaft_id, preis, verkaufsdatum)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, typ, zimmer, flaeche, ortschaftId, preis, verkaufsdatum],
      );
    },
  });

  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => console.log(`MS2 hört auf Port ${port}`));
}

pool.on('error', (error) => console.error('MS2-Datenbankverbindung unterbrochen', error));
start().catch(async (error) => {
  console.error('MS2 konnte nicht gestartet werden', error);
  await pool.end();
  process.exitCode = 1;
});
