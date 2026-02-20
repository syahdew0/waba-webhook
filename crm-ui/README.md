# CRM UI (Vue)

## Run

1. Install dependencies

```bash
cd crm-ui
npm install
```

2. Start frontend dev server

```bash
npm run dev
```

Frontend runs on `http://localhost:5173` and proxies `/api` + `/health` to backend `http://localhost:3000`.

## Required backend routes

- `GET /health/db`
- `GET /api/conversations`
- `GET /api/messages?wa_id=...`
