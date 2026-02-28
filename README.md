# Bitespeed Identity Reconciliation API

Backend service for reconciling customer identities across multiple purchases when users may use different emails/phone numbers.

## Live Deployment

- Base URL: `https://bitespeed-identity-reconciliation-hg.onrender.com`
- Health route: `GET /`
- Main route: `POST /identify`

## What Is Implemented

- `POST /identify` with full identity reconciliation logic
- Primary/secondary contact linking based on shared email or phone
- Merge handling when two existing primary contact groups become connected
- Deterministic response shape required by the task
- Input normalization and validation
  - accepts `phoneNumber` as string or number
  - supports `null` for either field
  - requires at least one of `email` or `phoneNumber`
- PostgreSQL with Prisma ORM
- Render + Neon deployment

## Tech Stack

- Node.js + TypeScript
- Express.js
- Prisma ORM
- PostgreSQL

## Project Structure

```txt
src/
  index.ts                    # app bootstrap + middleware + routes
  lib/prisma.ts               # Prisma client
  routes/identify.ts          # /identify route
  services/identifyService.ts # reconciliation logic
  types.ts                    # request/response typings
prisma/
  schema.prisma               # Contact model
```

## Data Model

`Contact` table fields:

- `id` (auto increment)
- `phoneNumber` (nullable)
- `email` (nullable)
- `linkedId` (nullable; points to primary contact id when secondary)
- `linkPrecedence` (`primary` or `secondary`)
- `createdAt`
- `updatedAt`
- `deletedAt` (nullable)

## Reconciliation Rules

1. No match by email/phone -> create a new `primary` contact.
2. Match found + new info arrives -> create a `secondary` contact under the oldest primary.
3. If multiple primary groups get connected by a new request:
   - oldest primary remains primary
   - newer primaries are demoted to secondary
   - their linked secondaries are re-parented to the oldest primary
4. Response always returns:
   - `primaryContatctId` (task-required key spelling)
   - all unique emails (primary first)
   - all unique phoneNumbers (primary first)
   - all secondary contact ids

## API Contract

### `POST /identify`

Request body (JSON):

```json
{
  "email": "string | null",
  "phoneNumber": "string | number | null"
}
```

At least one of `email` or `phoneNumber` must be present and non-empty.

Success response (`200`):

```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [2]
  }
}
```

Validation error (`400`):

```json
{
  "error": "Request body must contain at least one of: email, phoneNumber"
}
```

## Quick Test (Live)

```bash
curl -X POST https://bitespeed-identity-reconciliation-hg.onrender.com/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"lorraine@hillvalley.edu","phoneNumber":"123456"}'
```

## Run Locally

### 1. Clone + Install

```bash
git clone https://github.com/harshag121/Bitespeed_Identity_Reconciliation_hg.git
cd Bitespeed_Identity_Reconciliation_hg
npm install
```

### 2. Start PostgreSQL (Docker)

```bash
docker run --name bitespeed-pg \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=bitespeed \
  -p 5432:5432 \
  -d postgres:16-alpine
```

### 3. Configure Environment

Create `.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bitespeed?schema=public"
PORT=3000
```

### 4. Sync Schema + Run

```bash
npx prisma generate
npx prisma db push
npm run dev
```

Server will run at `http://localhost:3000`.

## NPM Scripts

- `npm run dev` -> run with ts-node-dev
- `npm run build` -> compile TypeScript
- `npm start` -> run compiled app (`dist/index.js`)
- `npm run prisma:generate`
- `npm run prisma:push`
- `npm run prisma:studio`

## Deploy (Free) - Render + Neon

1. Create PostgreSQL database in Neon.
2. Create Render Web Service from this repo.
3. Set Render build command:

```bash
npm ci && npx prisma generate && npx prisma db push && npm run build
```

4. Set Render start command:

```bash
npm start
```

5. Add Render env var:

- `DATABASE_URL=<your_neon_postgres_connection_string>`

Do not manually set `PORT` on Render.

## Submission Checklist

- GitHub repo published
- `/identify` endpoint implemented
- App deployed online
- Live endpoint added in README
- JSON request body supported (not form-data)
