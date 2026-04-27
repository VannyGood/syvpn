## SYVPN Backend

Production-ready API for the Telegram Mini App VPN service.

### Stack

- Node.js + TypeScript
- Express
- PostgreSQL + Prisma
- Telegram WebApp initData verification
- JWT auth
- Marzban API integration

### Setup

1) Install dependencies:

```bash
cd backend
npm install
```

2) Create `.env`:

```bash
cp .env.example .env
```

3) Point `DATABASE_URL` to your local Postgres (you can later switch host to VPS without code changes).

4) Generate Prisma client + migrate:

```bash
npm run prisma:generate
npm run prisma:migrate
```

5) Run dev server:

```bash
npm run dev
```

### VPS (Docker) setup (recommended)

This runs **API + PostgreSQL** on your Ubuntu VPS using Docker Compose.

1) Copy template and fill secrets:

```bash
cd backend
cp .env.vps.template .env
```

2) Start:

```bash
docker compose up -d --build
```

API will be on `http://YOUR_VPS_IP:8080`.

### Nginx (no domain)

If you want `http://YOUR_VPS_IP/api/...` (instead of port 8080), add a server block like:

```nginx
server {
  listen 80;
  server_name _;

  location /api/ {
    proxy_pass http://127.0.0.1:8080/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

### Endpoints

- `POST /auth/telegram` body: `{ "initData": "..." }` → returns `{ token, user }`
- `GET /me` (Bearer token)
- `GET /plans`
- `POST /subscribe` (Bearer token) body: `{ "plan_type": "monthly" | "yearly" }`
- `GET /config` (Bearer token)
- `GET /wallet` (Bearer token) *(mock balance from paid tx sum)*
- `POST /wallet/add` (Bearer token) body: `{ "amount": number, "currency": "TON"|"TRC20"|"WHISH" }` *(mock deposit, creates pending tx)*

### Marzban

Set these in `.env`:

- `MARZBAN_URL`
- `MARZBAN_USERNAME`
- `MARZBAN_PASSWORD`

This backend logs in and creates a Marzban user on `/subscribe`, then stores the returned `subscription_url` (config link).

