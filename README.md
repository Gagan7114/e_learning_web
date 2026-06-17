# e-learning — Online Course Marketplace (Phase 1 MVP)

A Udemy-style, two-sided course marketplace where **instructors** publish and sell video
courses and **students** discover, purchase, and learn from them, governed by an **admin**.

Built with the requested stack: **Node.js + Express + Drizzle ORM + PostgreSQL** on the
backend and **React + Vite + TypeScript + Tailwind** on the frontend.

> This is a working **Phase 1 vertical slice** of the full spec in [`docs/SPEC.md`](docs/SPEC.md).
> The complete core marketplace loop runs end-to-end: browse → course landing → sign up →
> purchase → enroll → learn (video, progress, quizzes, notes, Q&A) → review → certificate,
> plus an instructor studio and an admin panel.

---

## Tech stack

| Layer | Choice |
|---|---|
| Backend | Node.js, Express, TypeScript (ESM) |
| ORM / DB | Drizzle ORM + PostgreSQL (`pg` driver) |
| Auth | JWT access tokens + httpOnly refresh-token cookie, bcrypt password hashing, RBAC |
| Validation | Zod |
| Frontend | React 18, Vite, TypeScript |
| Styling | Tailwind CSS (custom design tokens) |
| Data fetching | TanStack Query |
| Client state | Zustand (auth + toasts) |
| Routing | React Router |

---

## Project structure

```
project/
├── server/                 # Express + Drizzle API
│   ├── src/
│   │   ├── db/             # schema.ts (Drizzle), index.ts (pool), seed.ts
│   │   ├── middleware/     # auth (JWT/RBAC), validate (zod), error handling
│   │   ├── modules/        # feature modules (auth, courses, cart, orders, learning, …)
│   │   ├── utils/          # jwt, password, helpers (asyncHandler, ApiError, slugify)
│   │   ├── routes.ts       # mounts all module routers under /api
│   │   ├── app.ts          # express app (helmet, cors, cookies)
│   │   └── index.ts        # entrypoint (verifies DB, starts server)
│   ├── drizzle/            # generated SQL migration
│   └── .env                # DATABASE_URL + secrets (gitignored)
├── web/                    # React + Vite SPA
│   └── src/
│       ├── components/     # Layout, Navbar, CourseCard, UI primitives, guards
│       ├── lib/            # api client (axios + token refresh), formatters, types
│       ├── pages/          # all routed pages (public, student, instructor, admin)
│       └── store/          # zustand stores (auth, toast)
├── docs/SPEC.md           # the original full product spec
└── package.json           # npm workspaces + dev scripts
```

---

## Database isolation (important)

The provided `DATABASE_URL` points at an `e_learning` Postgres database that **already
contained another project's tables** (a Prisma app: `User`, `Course`, `ResetToken`, …).
To avoid touching that data, **all of this app's tables live in a dedicated `elearning`
Postgres schema**. The existing `public` tables are never read or modified.

---

## Getting started

### Prerequisites
- Node.js 18+ (built and tested on Node 24)
- A running PostgreSQL instance (the app uses the one in `server/.env`)

### 1. Install dependencies
```bash
npm install            # installs root + both workspaces
```

### 2. Configure the database
`server/.env` is already set to the provided connection string:
```
DATABASE_URL=postgresql://postgres:gagan@localhost:5432/e_learning
```
Change it if your Postgres differs. (See `server/.env.example` for all variables.)

### 3. Create the schema + seed demo data
```bash
npm run db:push        # applies the Drizzle schema into the `elearning` schema
npm run db:seed        # seeds users, categories, courses, reviews, enrollments
```
> If `drizzle-kit push` ever prompts interactively (it introspects the whole DB and may ask
> about the unrelated `public` enums), apply the generated SQL directly instead — the schema
> was created from `server/drizzle/0000_init.sql` into the `elearning` schema.

### 4. Run both apps
```bash
npm run dev            # starts API (http://localhost:4000) + web (http://localhost:5173)
```
Then open **http://localhost:5173**. The Vite dev server proxies `/api` to the backend.

---

## Demo accounts

All seeded accounts use the password **`Password123!`**

| Email | Roles | Notes |
|---|---|---|
| `admin@e-learning.dev` | admin + instructor + student | Full admin panel |
| `sarah@e-learning.dev` | instructor | Owns React/Node/TypeScript courses |
| `david@e-learning.dev` | instructor | Owns Data Science + Marketing courses |
| `maria@e-learning.dev` | instructor | Owns the UX Design course |
| `alex@e-learning.dev` | student | Pre-enrolled in 3 courses |
| `priya@e-learning.dev` | student | — |
| `tom@e-learning.dev` | student | — |

**Demo coupon:** `LAUNCH50` (50% off, platform-wide).

The login page has one-click buttons to fill these credentials.

---

## What's implemented (Phase 1)

**Public / catalog**
- Homepage (hero search, featured/trending/new shelves, category grid, instructor CTA)
- Browse, Category pages, faceted Search (price, rating, level, language, sort, pagination)
- Course landing page (sticky purchase card, curriculum accordion, free-preview modal,
  rating breakdown, reviews, instructor bio, "students also bought")
- Public instructor profiles, certificate verification page, CMS/static pages

**Auth & accounts**
- Register (student or instructor), login, silent refresh, logout, role-switch,
  "become an instructor", account settings, notifications center

**Student**
- Cart, wishlist, checkout (coupon validation, payment-method selection — mock gateway
  settles instantly; Stripe/Razorpay are stubbed and ready to wire), order confirmation,
  purchase history, **30-day refund** flow
- **My Learning** with progress, and the **course player**: video with resume + autoplay-next,
  curriculum sidebar with completion, per-lecture progress, auto-graded **quizzes** with
  explanations, timestamped **notes**, **Q&A**, in-player **reviews**, and **certificate**
  generation at 100% (verifiable by serial)

**Instructor studio**
- Dashboard (students, revenue, rating, reviews), course list
- **Course builder** wizard: landing page editor, curriculum (sections + lectures,
  free-preview toggles), pricing, submit-for-review with a validation gate
- Earnings & payouts view with transparent revenue split per sale

**Admin panel**
- KPI dashboard (GMV, users, courses, pending review, refunds, top courses)
- Course approval queue (approve / reject-with-note / feature)
- User management (search, suspend/reactivate, roles)
- Category & subcategory CRUD
- Revenue split + audit logging on admin actions

**Cross-cutting**
- RBAC on every protected endpoint, signed JWTs, hashed passwords, zod validation,
  helmet, CORS, idempotent enrollment, transactional checkout with revenue split.

---

## API quick reference

Base URL: `http://localhost:4000/api`

| Area | Examples |
|---|---|
| Auth | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `GET /auth/me` |
| Catalog | `GET /courses?q=&category=&level=&price=&rating=&sort=`, `GET /courses/:slug` |
| Cart/Wishlist | `GET/POST/DELETE /cart`, `/cart/wishlist` |
| Checkout | `POST /orders/validate-coupon`, `POST /orders/checkout`, `POST /orders/:id/refund` |
| Learning | `GET /learning/my-courses`, `GET /learning/:slug`, `POST /learning/lectures/:id/progress` |
| Reviews/Q&A | `POST /courses/:slug/reviews`, `GET/POST /lectures/:id/qna` |
| Instructor | `GET/POST/PUT /instructor/courses…`, `POST /instructor/courses/:id/submit` |
| Admin | `GET /admin/dashboard`, `POST /admin/courses/:id/approve` |

A health check is at `GET /api/health`.

---

## Useful scripts

| Command | What it does |
|---|---|
| `npm run dev` | Run API + web together |
| `npm run dev:server` / `npm run dev:web` | Run one side |
| `npm run db:push` | Apply Drizzle schema to the database |
| `npm run db:seed` | Re-seed demo data (truncates the `elearning` schema first) |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run build` | Type-check + build both apps |

---

## Notes, trade-offs & next steps

This is an MVP slice, not the entire spec. Deliberately **stubbed or simplified**:
- **Payments**: a `mock` provider settles instantly; Stripe/Razorpay are selectable and the
  data model (orders, payments, earnings, refunds) is built to plug them in via webhooks.
- **Video**: courses play direct MP4 URLs (seeded with Google's public sample videos).
  Production would upload to object storage, transcode to HLS, and serve **signed URLs**
  (the lecture-gating that hides paid content from non-enrolled users is already in place).
- **Search** is Postgres `ILIKE` + filters (no Elasticsearch/Algolia yet).
- **Email, Redis, background jobs, OAuth, 2FA, i18n** are out of scope for Phase 1.

See [`docs/SPEC.md`](docs/SPEC.md) Sections 11–12 for the Phase 2/3 roadmap.
