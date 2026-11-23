# ms2 – Microservice 2: Immobilien

Dieser Service ist für die Verwaltung der Immobilien zuständig (Projekt 5: Immobilienplattform).

- **Verantwortung Phase A:** Teilgruppe A (Dev)
- **Verantwortung Phase B:** Teilgruppe B (Ops)

## Lokal ausführen

Node.js 20 und eine PostgreSQL-Datenbank für MS2 werden benötigt.
Setze `DATABASE_URL` auf die Verbindung zu dieser Datenbank. Der Service legt
seine Tabelle beim Start an, falls sie noch fehlt. `PORT` ist optional
(Standard: `3000`). Setze `MS1_URL` auf die Basis-URL von MS1, falls dessen API
nicht unter `http://localhost:3001` erreichbar ist.

```bash
npm ci
npm run dev
npm test
```

Die Tests benötigen keine laufende Datenbank und keinen laufenden MS1-Service.
