# ⌨️ TypeForge

> **A high-performance, full-stack typing intelligence platform.**  
> Real-time keystroke analytics, progressive skill-building modules, and a serverless event-driven achievement engine — engineered to give zero input lag at 200 WPM.

<br/>

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js_14-black?style=for-the-badge&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Upstash](https://img.shields.io/badge/Upstash_QStash-00E9A3?style=for-the-badge&logo=upstash&logoColor=black)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

</div>

---

## ✨ Features

### 🎹 Ghost Keyboard — Zero-Latency Visual Observer
A live QWERTY keyboard renders in real-time as you type, with physics-accurate key depression animations. Engineered with zero input lag:
- **`React.memo`** on every `KeyCap` — prevents re-renders on unrelated keystroke events
- **O(1) `Set` lookups** via `React.useMemo` — `allowedKeys` array is converted once to a `Set`, making per-keystroke membership checks constant-time regardless of lesson size
- **Pure observer pattern** — the component has zero interaction with the typing engine, Zustand stores, or session submission. It receives a single `activeKey` prop and renders. Nothing more.

### 🏟️ Arena — Free Practice Mode
Unstructured, full-dictionary typing tests in both **timed** (15s / 30s / 60s / 120s) and **word-count** (10 / 25 / 50 / 100) modes. The engine tracks WPM, raw WPM, accuracy, and consistency score using character-based WPM calculation (the same formula as Monkeytype/TypeRacer) — immune to backspace patterns that inflate or deflate word-count metrics.

### 🎓 Academy — Progressive Curriculum
A structured 10-lesson curriculum with a server-enforced **Progression Gate**. Each lesson introduces a new key cluster. The backend validates session results against a minimum WPM and accuracy threshold before unlocking the next stage — preventing users from gaming progression with accidental completions.

### 📊 Analytics & Weak-Key Heatmap
An interactive SVG keyboard heatmap highlights your most error-prone keys based on aggregated session history. Every keystroke event is compacted and shipped to the backend, where the analytics pipeline aggregates per-key error rates and average latency into a persistent `weak_keys` table.

### 🏆 Serverless Achievement Engine
Achievements are evaluated and unlocked via a fully serverless, event-driven pipeline (see Architecture below). Zero idle polling. Zero persistent workers. An achievement unlock triggers an XP reward written transactionally to the database, with ranks updating in real-time.

### 🌗 System-Aware Dark / Light Mode
Built with `next-themes` + Tailwind's `class` strategy. Respects your OS preference out of the box (`defaultTheme="system"`). A hydration-safe `ThemeToggle` component prevents React SSR/client mismatch errors using a `mounted` state guard. The hardcoded `className="dark"` was intentionally removed from `<html>` — `next-themes` owns the class injection.

### 🛡️ Anti-Cheat & Data Integrity
Every completed session is validated server-side before hitting the database:
- WPM ceiling checks against elapsed time
- Accuracy ceiling checks against keystroke ratios
- Suspicious pattern detection on keystroke latency distribution

Flagged sessions are stored but excluded from stats and progression calculations.

---

## 🏗️ Architecture

TypeForge is a **Turborepo monorepo** with two deployable apps and a shared types package.

```
typeforge/
├── apps/
│   ├── web/          # Next.js 14 (App Router) — deployed to Vercel
│   └── api/          # Node.js / Express   — deployed to Render
├── packages/
│   └── shared/       # Zod schemas, TypeScript types, shared constants
└── turbo.json
```

### The Session Data Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  USER FINISHES TYPING SESSION                                               │
│       │                                                                     │
│       ▼                                                                     │
│  [Next.js Frontend]  ──── POST /api/sessions ────►  [Express Backend]      │
│       │                    (JWT-authenticated)           │                  │
│       │                                           ① Zod validation         │
│       │                                           ② Anti-cheat check       │
│       │                                           ③ DB transaction:        │
│       │                                              - INSERT typing_session│
│       │                                              - UPDATE user XP/rank  │
│       │                                              - UPDATE lesson stage  │
│       │                                           ④ Return 201 immediately │
│       │                                                   │                 │
│       │                                           ⑤ dispatchSessionJobs()  │
│       │                                              → QStash publishJSON() │
│       │                                                   │                 │
│       │                                    ┌──────────────┘                 │
│       │                                    ▼                                │
│       │                          [Upstash QStash]                           │
│       │                          Queues delivery with                       │
│       │                          3x retry + backoff                         │
│       │                                    │                                │
│       │                                    ▼                                │
│       │                    POST /api/webhooks/process-session               │
│       │                       [Express "God Handler"]                       │
│       │                       ① Verify HMAC signature                      │
│       │                       ② Zod validate body                          │
│       │                       ③ Promise.all([                              │
│       │                            processAnalytics(),   ← weak_keys upsert│
│       │                            processAchievements(), ← XP + unlocks   │
│       │                            processStreak(),       ← daily streak   │
│       │                          ])                                         │
│       │                       ④ 200 OK → QStash marks delivered            │
│       │                          500 → QStash retries automatically        │
│       │                                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Why QStash over BullMQ/Redis?
The original implementation used Redis + BullMQ with 4 persistent polling queues (`bull:analytics`, `bull:achievements`, `bull:streaks`, `bull:archival`). This was migrated using the **Strangler Fig pattern** — old BullMQ code is preserved in `/* === BACKUP: OLD BULLMQ === */` blocks for instant rollback.

| Dimension | BullMQ (before) | QStash (after) |
|---|---|---|
| **Infrastructure** | Persistent Redis connection | Zero persistent connections |
| **Scaling** | Worker processes per queue | Serverless on every delivery |
| **Cost** | Redis idle time billed 24/7 | Pay per message delivered |
| **Reliability** | Manual retry logic | Built-in 3x retry + exponential backoff |
| **Security** | Internal queue | HMAC-signed webhook — verifiable |

### Zero-Latency Typing Engine
The core typing engine (`useTypingEngine.ts`) enforces a **zero-render mandate** during active typing:

- All per-keystroke state lives in `engineRef` (a plain mutable object — zero Zustand overhead)
- Character DOM nodes are mutated directly via `charRefs` grid (`span.className = ...`)
- Caret position uses direct `caretRef.current.style` CSS transforms
- Zustand is called **only** on: session start (once), every 500ms stats tick (once per interval), and session completion (once)

This guarantees **zero React re-renders** in the hot keystroke path, achieving consistent sub-5ms input response regardless of session length or word count.

---

## 🖥️ Screenshots

| Arena (Practice Mode) | Academy (Curriculum) |
|---|---|
| *Live keyboard + WPM counter* | *Progressive lesson unlock system* |

| Stats Dashboard | Weak-Key Heatmap |
|---|---|
| *Session history + streak* | *SVG keyboard with error-rate colouring* |

---

## 🚀 Local Setup

### Prerequisites
- Node.js ≥ 20
- PostgreSQL ≥ 15 (running locally or via Docker)
- [ngrok](https://ngrok.com/) (required to test QStash webhook delivery locally — QStash needs a public HTTPS URL to POST back to)
- An [Upstash](https://console.upstash.com/qstash) account (free tier is sufficient)

### 1. Clone & Install

```bash
git clone https://github.com/Garvit-Sharmaa/TypeForge.git
cd TypeForge

# Install all workspace dependencies (Turborepo)
npm install
```

### 2. Configure Environment Variables

**Backend** — create `apps/api/.env`:

```env
# ── Server ──────────────────────────────────────────────────
NODE_ENV=development
API_PORT=4000
API_SECRET_KEY=your-32-char-minimum-secret-key-here

# ── PostgreSQL ───────────────────────────────────────────────
DATABASE_URL=postgresql://typingmaster:password@localhost:5432/typingmaster
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=typingmaster
POSTGRES_PASSWORD=your-db-password
POSTGRES_DB=typingmaster

# ── JWT ──────────────────────────────────────────────────────
JWT_SECRET=your-32-char-minimum-jwt-secret-here
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-32-char-minimum-refresh-secret-here
JWT_REFRESH_EXPIRES_IN=7d

# ── QStash (get from console.upstash.com/qstash) ────────────
QSTASH_TOKEN=qstash_token_xxxxxxxxxxxxxxxxxxxx
QSTASH_CURRENT_SIGNING_KEY=sig_xxxxxxxxxxxxxxxxxxxx
QSTASH_NEXT_SIGNING_KEY=sig_xxxxxxxxxxxxxxxxxxxx

# ── Public API URL (your ngrok HTTPS URL in local dev) ───────
# QStash needs a public HTTPS endpoint to POST the webhook to.
# Leave unset to disable QStash dispatch in local dev.
PUBLIC_API_URL=https://your-ngrok-subdomain.ngrok-free.app

# ── Observability ────────────────────────────────────────────
LOG_LEVEL=info
```

**Frontend** — create `apps/web/.env.local`:

```env
# Points the Next.js frontend at your local Express server
NEXT_PUBLIC_API_URL=http://localhost:4000

# Used for OpenGraph metadata
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Database Setup

```bash
# Run migrations (creates all tables, functions, and seed data)
cd apps/api
npm run migrate
```

### 4. Start ngrok (for QStash webhook testing)

```bash
# In a dedicated terminal — keep this running
ngrok http 4000

# Copy the Forwarding URL (e.g. https://abc123.ngrok-free.app)
# Paste it as PUBLIC_API_URL in apps/api/.env
```

> [!NOTE]
> If `PUBLIC_API_URL` is not set, the backend will log a warning and skip QStash dispatch. The session will still save to the database; only the post-session analytics, achievements, and streak update will not run.

### 5. Run the Application

```bash
# From the monorepo root — starts both apps concurrently via Turborepo
npm run dev

# Or start them individually:
cd apps/api && npm run dev   # → http://localhost:4000
cd apps/web && npm run dev   # → http://localhost:3000
```

---

## 🌐 Environment Variables Reference

### Backend (`apps/api/.env`)

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | ✅ | `development` \| `production` \| `test` |
| `API_PORT` | ✅ | Port the Express server listens on (default: `4000`) |
| `API_SECRET_KEY` | ✅ | Min 32 chars. Used for internal request signing |
| `DATABASE_URL` | ✅ | Full PostgreSQL connection string |
| `POSTGRES_*` | ✅ | Individual PG connection fields (host, port, user, etc.) |
| `JWT_SECRET` | ✅ | Min 32 chars. Signs access tokens (15min expiry) |
| `JWT_REFRESH_SECRET` | ✅ | Min 32 chars. Signs refresh tokens (7 day expiry) |
| `QSTASH_TOKEN` | ⚠️ Prod | Authenticates outbound `publishJSON()` calls to Upstash |
| `QSTASH_CURRENT_SIGNING_KEY` | ⚠️ Prod | Verifies inbound webhook HMAC signatures |
| `QSTASH_NEXT_SIGNING_KEY` | ⚠️ Prod | Key-rotation support for zero-downtime signing key rollover |
| `PUBLIC_API_URL` | ⚠️ Prod | Public HTTPS URL of this API. QStash POSTs the webhook here |
| `LOG_LEVEL` | ❌ | Pino log level. Default: `info` |
| `SENTRY_DSN` | ❌ | Optional Sentry error tracking DSN |

### Frontend (`apps/web/.env.local`)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ | Base URL of the Express API (e.g. `https://api.typeforge.app`) |
| `NEXT_PUBLIC_APP_URL` | ❌ | Used to construct OpenGraph canonical URLs |

> [!IMPORTANT]
> The three `QSTASH_*` variables and `PUBLIC_API_URL` are optional in local development. The server boots without them — QStash dispatch is silently skipped with a warning log if `PUBLIC_API_URL` is unset.

---

## 📦 Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| **Frontend** | Next.js 14 (App Router) | React Server Components + Client Islands |
| **Styling** | Tailwind CSS + `next-themes` | `darkMode: "class"`, system-aware toggle |
| **Animation** | Framer Motion | Page transitions, lesson card reveals |
| **State** | Zustand | Auth, typing session, analytics |
| **Backend** | Node.js + Express | REST API, JWT auth, Zod validation |
| **Database** | PostgreSQL | Parameterized queries via `pg` (no ORM) |
| **Async Jobs** | Upstash QStash | Push-based, HMAC-signed, serverless |
| **Monorepo** | Turborepo | Shared `@typing-master/shared` package |
| **Deployment** | Vercel (web) + Render (api) | |

---

## 📁 Project Structure

```
apps/
├── web/src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (auth)/             # Login, Register
│   │   └── (dashboard)/        # Arena, Academy, Stats
│   ├── components/
│   │   ├── typing/
│   │   │   └── LiveKeyboard.tsx   # Ghost keyboard (React.memo + O(1) Set)
│   │   ├── ThemeProvider.tsx      # next-themes client boundary wrapper
│   │   └── ThemeToggle.tsx        # Hydration-safe Sun/Moon toggle
│   ├── hooks/
│   │   ├── useTypingEngine.ts     # Core engine (zero-render hot path)
│   │   └── useAuth.ts             # JWT hydration + auto-refresh
│   └── store/                  # Zustand stores (userStore, typingStore, analyticsStore)
│
└── api/src/
    ├── modules/
    │   ├── auth/               # Register, login, refresh, /me
    │   ├── sessions/           # Submit session, anti-cheat, XP calculation
    │   ├── lessons/            # Curriculum listing, progress gate, word filtering
    │   ├── analytics/          # Dashboard data, weak-key aggregation
    │   └── webhooks/
    │       └── webhooks.router.ts  # QStash "God Handler" — signature verify + fan-out
    ├── workers/
    │   ├── analyticsWorker.ts  # Pure fn: per-key error stats → weak_keys upsert
    │   ├── achievementWorker.ts # Pure fn: condition eval → achievement unlock + XP
    │   └── streakWorker.ts     # Pure fn: daily streak increment (idempotent)
    └── config/
        └── bullmq.ts           # QStash producer (old BullMQ preserved in BACKUP blocks)
```

---

## 📄 License

MIT — see [LICENSE](LICENSE)

---

<div align="center">

Built with precision by **Garvit Sharma**  
[GitHub](https://github.com/Garvit-Sharmaa) · [LinkedIn](https://linkedin.com/in/garvit-bhardwaj)

</div>
