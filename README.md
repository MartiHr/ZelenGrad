# ZelenGrad

ZelenGrad is a full-stack TypeScript university course project for managing municipal green assets, zone operations, maintenance work, citizen incident reports, tree adoptions, rewards, and administrative audit history.

## Tech Stack

- Monorepo: npm workspaces
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL with Prisma
- Frontend: React, TypeScript, Vite, React Router v7
- Maps: Leaflet and React Leaflet
- Realtime: Server-Sent Events for live dashboard/activity updates
- Local orchestration: Docker Compose

## Project Structure

```text
ZelenGrad/
|-- backend/
|   |-- prisma/
|   |   |-- migrations/
|   |   |-- schema.prisma
|   |   `-- seed.ts
|   |-- src/
|   |   |-- config/
|   |   |-- lib/
|   |   |-- middleware/
|   |   |-- realtime/
|   |   |-- routes/
|   |   |-- services/
|   |   |-- validators/
|   |   |-- app.ts
|   |   `-- server.ts
|   |-- Dockerfile
|   |-- package.json
|   `-- tsconfig.json
|-- frontend/
|   |-- src/
|   |   |-- auth/
|   |   |-- components/
|   |   |-- incidents/
|   |   |-- layouts/
|   |   |-- map/
|   |   |-- pages/
|   |   |-- styles/
|   |   |-- api.ts
|   |   |-- main.tsx
|   |   |-- router.tsx
|   |   `-- validation.ts
|   |-- Dockerfile
|   |-- index.html
|   |-- package.json
|   `-- vite.config.ts
|-- docker-compose.yml
|-- package.json
`-- .env.example
```

## Local Development

Install dependencies:

```bash
npm install
```

Create environment files from the example:

```bash
cp .env.example .env
```

Start the full stack with Docker:

```bash
npm run dev
```

Useful URLs:

- Frontend SPA: http://localhost:5173
- Backend API: http://localhost:3000/api
- SSE stream: http://localhost:3000/api/events
- PostgreSQL: localhost:5432

Common commands:

```bash
npm run dev:detached
npm run down
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run typecheck --workspace backend
npm run typecheck --workspace frontend
npm run build --workspace frontend
```

Prisma Studio:

```bash
npm run prisma:studio --workspace backend
```

## Seeded Accounts

After seeding, all demo users use `password123`.

| Role | Email |
| --- | --- |
| Admin | `admin@zelengrad.test` |
| Manager | `manager@zelengrad.test` |
| Employee | `employee@zelengrad.test` |
| Citizen | `citizen@zelengrad.test` |

## Roles And Main Workflows

- Anonymous users can browse the public green map and inspect asset details.
- Citizens can register/login, report incidents, adopt trees, record care activity, upload care photos, and view rewards in My Forest.
- Employees can review assigned zones, inspect worklists, update maintenance progress, and review incidents where permitted.
- Managers can manage assets, zones, zone staff assignments, maintenance tasks, incident triage, and dashboard operations.
- Admins can manage users, deactivate/reactivate accounts, access the audit log, and use all manager workflows.

## Frontend Routes

Core public/auth routes:

- `/` role-aware home
- `/map` public green map and asset catalog
- `/login`
- `/register`
- `/about`

Asset workflows:

- `/assets/new` focused asset registration with map coordinate picking, GPS, zone selection, and image upload
- `/assets/:assetId` asset details
- `/assets/:assetId/edit` asset registry editor
- `/assets/:assetId/report` incident report form for an asset
- `/assets/:assetId/maintenance/new` maintenance scheduling form for an asset

Operations:

- `/dashboard` live operational overview for managers/admins
- `/worklist` maintenance worklist
- `/worklist/:taskId` maintenance task detail
- `/worklist/:taskId/edit` task editor for managers/admins
- `/incidents` incident review queue
- `/incidents/:incidentId` incident details
- `/incidents/:incidentId/edit` incident triage editor

Zones, users, and audit:

- `/zones` assigned zone view for staff and zone management for managers/admins
- `/zones/new` focused zone creation with boundary drawing and GeoJSON editing
- `/users` admin user management with deactivate/reactivate actions
- `/audit` admin audit view with actor/action/entity/date filters
- `/profile`
- `/my-forest` citizen adoptions, care history, uploaded care images, and rewards

## Backend API Areas

The Express API is organized around these resource areas:

- `auth`: login, registration, current user
- `users`: profile/admin user operations, staff lookup, deactivate/reactivate
- `assets`: green asset catalog, asset detail/history, create/update/archive
- `uploads`: uploaded asset and care-log images stored under backend uploads and served statically
- `zones`: zone listing, management, boundary storage, staff assignments, assigned-zone view
- `maintenance`: task listing, task detail, scheduling, editing, status transitions, completion logs
- `incidents`: reporting, review queue, details, triage, status workflow
- `adoptions`: citizen tree adoption and care logging
- `dashboard`: operational summary
- `audit`: admin audit overview
- `events`: SSE stream for live updates

## Realtime And Uploads

SSE is exposed at:

```text
GET /api/events
```

The dashboard and live notification UI consume this stream for operational updates such as incidents, maintenance changes, asset changes, and adoptions.

Image uploads are handled by backend upload routes and saved as real files for:

- asset photos
- citizen care-log photos

## Notes

- The UI uses focused views for create/edit workflows so detail pages stay readable.
- Maps default to Sofia and use Leaflet for assets and zone boundaries.
