# ZelenGrad

ZelenGrad is a full-stack TypeScript course project for managing municipal green assets, maintenance work, citizen incident reports, and tree adoptions.

## Project Tree

```text
ZelenGrad/
├─ backend/
│  ├─ prisma/
│  │  └─ schema.prisma
│  ├─ src/
│  │  ├─ config/
│  │  ├─ lib/
│  │  ├─ middleware/
│  │  ├─ realtime/
│  │  ├─ routes/
│  │  ├─ app.ts
│  │  └─ server.ts
│  ├─ Dockerfile
│  ├─ package.json
│  └─ tsconfig.json
├─ frontend/
│  ├─ src/
│  │  ├─ layouts/
│  │  ├─ pages/
│  │  ├─ styles/
│  │  ├─ api.ts
│  │  ├─ main.tsx
│  │  └─ router.tsx
│  ├─ Dockerfile
│  ├─ index.html
│  ├─ package.json
│  ├─ tsconfig.json
│  └─ vite.config.ts
├─ docker-compose.yml
├─ package.json
└─ .env.example
```

## Local Development

```bash
cp .env.example .env
npm run dev
```

Services:

- Frontend SPA: http://localhost:5173
- Backend API: http://localhost:3000/api
- SSE stream: http://localhost:3000/api/events
- PostgreSQL: localhost:5432

## Domain Foundation

The initial architecture follows the course brief roles and views:

- Anonymous users can browse the public map and statistics.
- Citizens can adopt assets, report incidents, and view their forest history.
- Employees can work maintenance tasks and verify incident reports.
- Managers/Admins can manage zones, users, assets, and monitor the live dashboard.
