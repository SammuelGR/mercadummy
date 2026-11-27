# Mercadummy 🛒💸

## Development

### Backend

Node.js 22 (22.22.3+) or 24 (24.15.0+).

In `backend/`, copy `.env.example` to `.env`. Set your database URLs or use the defaults with `docker compose up -d --wait`.

```bash
npm install
npx prisma migrate deploy
npm run start:dev
```
