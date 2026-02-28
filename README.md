# Bitespeed Identity Reconciliation

A RESTful web service that identifies and tracks a customer's identity across multiple purchases made with different contact information.

## Live Endpoint

> Deploy to Render / Railway / Fly.io and paste the URL here after deployment.

---

## Tech Stack

| Layer     | Choice                             |
|-----------|------------------------------------|
| Runtime   | Node.js 20                         |
| Language  | TypeScript 5                       |
| Framework | Express 4                          |
| ORM       | Prisma 5                           |
| Database  | PostgreSQL                         |

---

## Project Structure

```
src/
├── index.ts                  # Express app entry point
├── types.ts                  # Shared TypeScript types
├── lib/
│   └── prisma.ts             # Prisma client singleton
├── routes/
│   └── identify.ts           # POST /identify route handler
└── services/
    └── identifyService.ts    # Core identity reconciliation logic
prisma/
└── schema.prisma             # Database schema
```

---

## Getting Started

### Prerequisites
- Node.js >= 18
- npm >= 9

### Install & Run Locally

```bash
# 1. Clone the repository
git clone <repo-url>
cd bitespeed-identity-reconciliation

# 2. Install dependencies
npm install

# 3. Start PostgreSQL locally (Docker)
docker run --name bitespeed-pg \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=bitespeed \
  -p 5432:5432 \
  -d postgres:16-alpine

# 4. Create .env file
echo 'DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bitespeed?schema=public"' > .env
echo 'PORT=3000' >> .env

# 5. Push schema & generate Prisma client
npx prisma db push
npx prisma generate

# 6. Start dev server (with hot reload)
npm run dev
```

The server starts at `http://localhost:3000`.

### Production Build

```bash
npm run build   # compiles TypeScript -> dist/
npm start       # runs compiled JS
```

---

## API

### `POST /identify`

Identifies a contact and consolidates all linked contact information.

**Request Body** (JSON)

| Field         | Type   | Required      |
|---------------|--------|---------------|
| `email`       | string | at least one  |
| `phoneNumber` | string \\| number | at least one  |

**Example Request**

```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "lorraine@hillvalley.edu", "phoneNumber": "123456"}'
```

**Example Response** `200 OK`

```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [23]
  }
}
```

**Error Response** `400 Bad Request`

```json
{ "error": "At least one of email or phoneNumber must be provided." }
```

---

## Business Logic

1. **No existing matches** -> create a new `primary` contact.
2. **Match found with new information** -> create a `secondary` contact linked to the existing primary.
3. **Two separate primaries linked by a new request** -> the older primary stays; the newer one is demoted to `secondary` and all its dependents are re-parented.

---

## Deployment Notes

1. Set `DATABASE_URL` in your host (Render/Railway/Fly) to a PostgreSQL connection string.
2. Build command:
   ```bash
   npm ci && npx prisma generate && npx prisma db push && npm run build
   ```
3. Start command:
   ```bash
   npm start
   ```
