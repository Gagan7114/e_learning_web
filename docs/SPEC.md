# Build Prompt — "e-learning" (A Full-Featured Online Course Marketplace, Udemy-style)

> Use this document as the master prompt for an AI coding tool (Claude Code, Cursor, etc.) or a development team. It specifies the product vision, every user role, the full page map, feature specs, data models, and non-functional requirements. Build it in phases (see Section 12).

---

## 1. Project Overview

Build a production-grade online learning marketplace called **e-learning**. It is a two-sided platform where **instructors** publish and sell video courses, and **students** discover, purchase, and learn from them. An **admin** team governs the marketplace.

**Business model:** Pay-per-course marketplace (primary) with optional subscription tier later. Revenue split between platform and instructor (configurable, e.g. 50/50 default, adjustable per instructor or per acquisition channel).

**Core promise:** Anyone can teach, anyone can learn. Frictionless course creation, a polished video learning experience, trustworthy reviews, and reliable payouts.

**Design language:** Clean, modern, content-forward (think Udemy / Coursera). Generous whitespace, strong typography hierarchy, course thumbnails as hero elements, a clear primary CTA color, fully responsive (mobile-first), dark-mode optional.

---

## 2. User Roles & Permissions

| Role | Description | Can do |
|---|---|---|
| **Guest** | Unauthenticated visitor | Browse catalog, search, view course landing pages, read reviews, preview free lectures, sign up |
| **Student** | Registered learner | Everything a guest can, plus: purchase, enroll, learn, track progress, take quizzes, earn certificates, ask Q&A, review, manage wishlist/cart, message instructors |
| **Instructor** | Course creator | Everything a student can, plus: create/manage courses, upload content, build curriculum, set pricing/coupons, view analytics, answer Q&A, manage reviews, receive payouts, post announcements |
| **Admin / Staff** | Platform operator | Full governance: approve courses, manage users, moderate content & reviews, manage categories, handle refunds & payouts, configure platform, view global analytics, manage CMS pages, run promotions, support tickets |

A user account can hold **both** Student and Instructor capabilities (a single login, role-switch in the UI). Admin uses a separate, hardened panel. Implement **role-based access control (RBAC)** with granular permissions so staff sub-roles (e.g. Moderator, Finance, Support) are possible.

---

## 3. Recommended Tech Stack

Pick a coherent stack; this is a sensible default — adapt as needed.

- **Frontend:** Next.js (React) + TypeScript, Tailwind CSS, shadcn/ui component library, TanStack Query for data fetching, Zustand/Redux for client state.
- **Backend:** Node.js (NestJS or Express) **or** Django/DRF; REST or GraphQL API. Keep frontend and backend cleanly decoupled.
- **Database:** PostgreSQL (primary relational store). Redis for caching, sessions, rate-limiting, and queues.
- **Search:** Elasticsearch or Algolia/Meilisearch for fast faceted course search.
- **Video:** Upload to object storage (S3/GCS), transcode to HLS adaptive bitrate (Mux, AWS MediaConvert, or Cloudflare Stream), deliver via CDN with **signed/expiring URLs** so paid content can't be hot-linked. Auto-generate captions/subtitles.
- **File storage / CDN:** S3 + CloudFront (or Cloudflare R2/CDN) for images, attachments, certificates.
- **Payments:** Stripe (global) **and** Razorpay (India) — support cards, UPI, wallets, net-banking. Handle taxes/GST, invoices, and refunds.
- **Auth:** JWT/refresh tokens or session-based; OAuth (Google, Facebook, Apple, GitHub); email verification; optional 2FA.
- **Email/Notifications:** Transactional email (SendGrid/SES/Resend), in-app notifications, optional push (FCM) and SMS (Twilio) for OTP.
- **Background jobs:** Queue (BullMQ/Celery) for transcoding callbacks, emails, certificate generation, analytics rollups, payout batches.
- **Infra:** Containerized (Docker), CI/CD, environment-based config, observability (logs, metrics, error tracking via Sentry).

---

## 4. Full Site Map (All Pages)

### A. Public / Marketing
1. **Homepage** — hero, search bar, featured/trending/new courses, top categories, "what to learn next" personalized strip (logged in), top instructors, testimonials, value props, become-an-instructor CTA, footer.
2. **Browse / Categories** — all categories & subcategories grid, with subpages per category.
3. **Category Page** — courses in a category with filters & sorting, category-specific featured carousels, related topics.
4. **Search Results** — keyword search with **faceted filters** (rating, video duration, level, price free/paid, language, captions, topic, subcategory) and sort (most relevant, highest rated, newest, most enrolled, price low→high/high→low).
5. **Course Landing / Detail Page** — the conversion page (full spec in Section 5.1).
6. **Instructor Public Profile** — bio, credentials, total students, rating, list of their courses, social links.
7. **Topic / Tag Page** — SEO landing pages per skill/topic.
8. **Become an Instructor** — pitch page → onboarding flow.
9. **Pricing / Subscription** (if/when subscription enabled).
10. **Static / CMS pages** — About, Contact, FAQ, Help Center, Careers, Blog (optional), Terms of Service, Privacy Policy, Refund Policy, Cookie Policy, Accessibility statement.
11. **404 / error / maintenance** pages.

### B. Authentication
12. **Sign Up** (student & instructor toggle) — email + social.
13. **Log In** — email/social, "remember me".
14. **Forgot Password / Reset Password.**
15. **Email Verification / OTP.**
16. **Onboarding** — pick interests/goals (drives recommendations).

### C. Student Experience
17. **My Learning** — enrolled courses, progress %, "continue learning", filters (in-progress, completed, wishlist), lists/collections, archived.
18. **Course Player / Learning Page** — the core learning UX (full spec in Section 5.2).
19. **Wishlist.**
20. **Shopping Cart.**
21. **Checkout** — coupon entry, billing/GST details, payment method selection, order summary.
22. **Order Confirmation / Receipt.**
23. **Purchase History / My Orders** — invoices, refund requests.
24. **Certificates** — view, download (PDF), share to LinkedIn.
25. **Notifications Center.**
26. **Messages / Inbox** — conversations with instructors/support.
27. **Public Profile (own)** — editable.
28. **Account Settings** — profile, photo, headline, bio, links, email/password, notification preferences, payment methods, privacy, language, close account.

### D. Instructor Experience (Studio)
29. **Instructor Dashboard** — overview: revenue, enrollments, ratings, recent reviews & Q&A, performance trends, payout status.
30. **Courses List** — all their courses with status (draft, in review, published, unpublished).
31. **Course Builder** (multi-step wizard, full spec in Section 5.3):
    - Course landing page editor (title, subtitle, description, category, level, language, image, promo video, learning objectives, requirements, target audience)
    - Curriculum builder (sections → lectures; video, article, downloadable resources, quizzes, assignments, coding exercises)
    - Pricing & coupons
    - Course messages (welcome/congrats auto-messages)
    - Settings (status, visibility, drip schedule)
32. **Performance & Analytics** — revenue reports, enrollment over time, engagement (watch time, completion), traffic & conversion, students by geography, review trends.
33. **Reviews Management** — read, respond, report.
34. **Q&A Management** — answer learner questions per lecture.
35. **Communications / Announcements** — email enrolled students; bulk messaging.
36. **Coupons & Promotions.**
37. **Earnings & Payouts** — balance, transaction history, payout method setup, statements, tax docs.
38. **Instructor Profile editor.**

### E. Admin Panel (separate hardened app)
39. **Admin Dashboard** — KPIs: GMV, revenue, new users, new courses, refunds, top courses, system health.
40. **User Management** — search/filter, view profile, suspend/ban, impersonate (for support), role/permission assignment.
41. **Instructor Management** — applications, verification, revenue-share overrides.
42. **Course Management & Approval** — review queue, approve/reject with notes, feature/unfeature, unpublish, edit metadata, quality flags.
43. **Category & Topic Management** — CRUD categories, subcategories, topics, ordering.
44. **Review Moderation** — reported reviews, remove/restore.
45. **Content Moderation** — flagged Q&A, messages, course content.
46. **Financials** — orders, transactions, refunds, payout batches, instructor balances, reconciliation, tax/GST reports, invoices.
47. **Coupons & Site-wide Promotions** — create platform sales, banners, flash deals.
48. **CMS** — edit static pages, homepage sections, banners, navigation, footer.
49. **Email Templates** — manage transactional/marketing templates.
50. **Notifications / Announcements** — broadcast to user segments.
51. **Support / Tickets** — handle user issues; canned responses.
52. **Reports & Analytics** — exportable reports across users, courses, revenue, engagement.
53. **Settings / Configuration** — payment keys, revenue share defaults, currencies, languages, feature flags, SEO defaults, integrations, security policies, audit log.

---

## 5. Key Page Specifications (Deep Dive)

### 5.1 Course Landing / Detail Page
This is the primary conversion surface. Must include:
- **Header block:** title, subtitle, rating (stars + count), enrolled student count, instructor name(s), last-updated date, language(s), captions available.
- **Promo video / preview:** auto-playable promo video; "Preview this course" opens free preview lectures in a modal.
- **Sticky purchase card:** price (with original/discounted, % off, countdown for limited offers), **Add to Cart**, **Buy Now**, **Add to Wishlist**, "30-Day Money-Back Guarantee", "Full lifetime access", includes (X hours video, Y articles, Z downloadable resources, certificate, mobile access), **Gift / Share / Apply Coupon**.
- **What you'll learn** (learning objectives grid).
- **Course content / curriculum:** sections + lectures with durations, expandable, free-preview badges, total length & lecture count.
- **Requirements**, **Description** (rich text), **Who this course is for**.
- **Instructor bio** block.
- **Reviews & ratings:** rating breakdown bars, search/filter reviews, helpful votes, instructor responses.
- **Related / "Students also bought"** carousel.
- **Frequently bought together / bundles** (optional).
- SEO: structured data (Course schema), shareable, OpenGraph.

### 5.2 Course Player / Learning Page
The learning experience for enrolled students:
- **Video player:** adaptive HLS, playback speed, quality selector, captions/subtitles & transcript, picture-in-picture, keyboard shortcuts, autoplay-next, resume from last position, remember volume/speed.
- **Curriculum sidebar:** collapsible sections, lecture list with completion checkmarks, durations, current-lecture highlight, search within course.
- **Progress tracking:** per-lecture and overall % complete, auto-mark complete.
- **Tabs under player:** Overview, **Q&A** (ask/search/upvote, instructor answers), **Notes** (timestamped, jump-to), **Announcements**, **Reviews** (leave/edit), **Learning tools** (downloadable resources, attachments).
- **Quizzes & assignments:** inline; auto-graded quizzes with explanations; assignment submission + peer/instructor feedback.
- **Coding exercises** (optional, for dev courses): in-browser editor with test cases.
- **Certificate:** unlocks at 100% completion (and/or passing required quizzes) → generate & download PsDF.
- **Bookmarks**, **report abuse**, share progress.

### 5.3 Course Builder (Instructor)
Step-by-step wizard with autosave and a completeness checklist:
1. **Intended learners** — learning objectives, prerequisites, target audience.
2. **Curriculum** — drag-and-drop sections & lectures; per lecture add: video upload (with transcode status), article (rich text), downloadable resources, quiz builder, assignment, coding exercise; set free-preview flag; reorder.
3. **Landing page** — title, subtitle, category & subcategory, topic, level (Beginner/Intermediate/Advanced/All), language, course image (with crop), promo video, rich description.
4. **Pricing** — choose price tier/currency, free vs paid.
5. **Promotions** — create coupons (% or flat, usage limits, expiry, referral coupons).
6. **Course messages** — welcome & congratulations auto-messages.
7. **Submit for review** — validation gate (min content, image, description length, etc.), then admin approval.

---

## 6. Core Feature Specifications

### Discovery & Catalog
- Faceted search (Section 4.4) with typo tolerance and autocomplete/suggestions.
- Personalized recommendations (based on interests, history, enrollments, "because you watched…").
- Trending, new, top-rated, bestseller badges, "Hot & New" labels.
- Categories → subcategories → topics taxonomy.
- Course bundles & "frequently bought together."

### Commerce
- Cart, wishlist, **Buy Now**.
- Coupons: instructor coupons + platform-wide sales + flash deals with countdowns.
- Multi-currency pricing; localized prices; **GST/tax** handling and compliant invoices.
- Checkout via Stripe + Razorpay (cards, UPI, wallets, net-banking, EMI optional).
- Gifting a course; redeem code.
- **30-day refund** flow (student request → policy check → admin/auto approve → reverse payout).
- Lifetime access to purchased courses.

### Learning
- Progress tracking & resume; completion certificates (auto-generated, verifiable via public URL/ID).
- Q&A per lecture; notes (timestamped); announcements; reviews & ratings.
- Quizzes (MCQ, multi-select, true/false) with auto-grading & explanations; assignments; optional coding exercises.
- Drip/scheduled content release (optional).
- Offline download (mobile app, if built).
- Subtitles/captions in multiple languages; transcripts.

### Instructor Tools
- Full course authoring (Section 5.3).
- Analytics: revenue, enrollments, engagement (watch time, completion), conversion, traffic sources, student demographics.
- Bulk student messaging & announcements.
- Coupon & promotion management.
- Reviews & Q&A management.
- Earnings dashboard, payout setup (bank/PayPal/Razorpay), statements, tax forms.
- Revenue-share transparency per sale (gross, platform fee, channel fee, net).

### Engagement & Retention
- Notifications: in-app + email (new course from followed instructor, Q&A answered, course updates, price drops on wishlist, abandoned cart, completion nudges).
- Follow instructors / wishlist alerts.
- Gamification (optional): streaks, badges, leaderboards.
- Reviews prompts at completion milestones.
- Email lifecycle: welcome, onboarding, re-engagement, post-purchase, completion congrats, certificate.

### Trust & Safety / Governance
- Course approval workflow with quality checks.
- Review & content moderation, abuse reporting.
- Instructor verification.
- Audit logs for admin actions.
- Fraud/refund-abuse detection signals.

---

## 7. Data Models (High-Level Schema)

Implement these core entities (fields abbreviated):

- **User**(id, name, email, password_hash, avatar, headline, bio, links, roles[], locale, is_verified, status, created_at)
- **InstructorProfile**(user_id, payout_method, tax_info, revenue_share, total_students, avg_rating)
- **Category**(id, name, slug, parent_id, order) — self-referential for subcategories
- **Topic/Tag**(id, name, slug)
- **Course**(id, instructor_id(s), title, subtitle, slug, description, category_id, subcategory_id, topics[], level, language(s), image, promo_video, price, currency, status[draft/review/published/unpublished], rating_avg, rating_count, students_count, duration_total, learning_objectives[], requirements[], target_audience[], published_at, updated_at)
- **Section**(id, course_id, title, order)
- **Lecture**(id, section_id, title, type[video/article/quiz/assignment/coding], content_ref, video_asset_id, duration, is_free_preview, order, resources[])
- **VideoAsset**(id, source_url, hls_url, status, captions[], thumbnails)
- **Resource/Attachment**(id, lecture_id, file_url, name, type)
- **Quiz**(id, lecture_id, questions[]) / **Question**(id, quiz_id, type, prompt, options[], correct[], explanation)
- **Assignment**(id, lecture_id, instructions, submissions[])
- **Enrollment**(id, user_id, course_id, enrolled_at, source[purchase/free/gift])
- **Progress**(id, enrollment_id, lecture_id, completed, last_position, completed_at)
- **Note**(id, user_id, lecture_id, timestamp, body)
- **QnA**(id, lecture_id, user_id, question, upvotes) / **QnAAnswer**(id, qna_id, user_id, body)
- **Review**(id, course_id, user_id, rating, body, helpful_count, instructor_response, created_at)
- **Certificate**(id, enrollment_id, serial, issued_at, pdf_url, verify_url)
- **Cart**(id, user_id) / **CartItem**(cart_id, course_id) — **Wishlist** similar
- **Coupon**(id, code, scope[course/platform], type[percent/flat], value, max_uses, used, starts_at, expires_at, course_id?)
- **Order**(id, user_id, total, currency, tax, discount, status, payment_ref, invoice_url, created_at) / **OrderItem**(order_id, course_id, price, instructor_id, platform_fee, instructor_earning)
- **Payment**(id, order_id, provider[stripe/razorpay], status, amount, raw_payload)
- **Refund**(id, order_item_id, status, reason, processed_at)
- **Payout**(id, instructor_id, amount, status, period, statement_url) / **EarningTransaction**(instructor_id, order_item_id, gross, fee, net)
- **Notification**(id, user_id, type, payload, read, created_at)
- **Message/Conversation/MessageItem** for inbox
- **CMSPage**(slug, title, body, status) / **Banner / HomepageSection** for CMS-driven layout
- **AuditLog**(actor_id, action, target, meta, created_at)
- **SupportTicket**(id, user_id, subject, status, messages[])

---

## 8. Design System & UX Guidelines

- **Component library:** buttons, inputs, selects, modals, tabs, accordions, cards (course card with thumbnail, title, instructor, rating, price, badges), carousels, rating stars, progress bars, breadcrumbs, pagination, toasts, skeleton loaders, empty states.
- **Course card** is a reusable hero element used across home/category/search/wishlist.
- **Responsive:** mobile-first; collapsible nav; sticky purchase card becomes bottom bar on mobile; player sidebar becomes drawer.
- **Accessibility:** WCAG 2.1 AA — keyboard nav, focus states, alt text, captions, sufficient contrast, ARIA on player and accordions.
- **Performance UX:** skeletons, lazy-loaded images, optimistic UI for cart/wishlist.
- **Theming:** central design tokens (colors, spacing, radius, typography); optional dark mode.
- **Localization-ready:** i18n strings, RTL support, currency & date formatting.

---

## 9. Non-Functional Requirements

- **Security:** hashed passwords (bcrypt/argon2), JWT/refresh rotation, HTTPS everywhere, CSRF/XSS/SQLi protection, rate limiting, input validation, signed video URLs, secure payment webhooks with signature verification, secrets in env/secret manager, PCI-compliant (delegate card data to Stripe/Razorpay), GDPR-style data export/delete, role-based access on every endpoint.
- **Performance & Scalability:** CDN for static & video, DB indexing, Redis caching, pagination everywhere, background jobs for heavy tasks, horizontal scalability, image/video optimization.
- **Reliability:** graceful error handling, idempotent payment/webhook handling, retries with backoff for jobs, monitoring & alerting, backups & disaster recovery.
- **SEO:** SSR/SSG for public pages, clean slugs, sitemap.xml, robots.txt, canonical tags, structured data (Course, Review, BreadcrumbList), fast Core Web Vitals, OpenGraph/Twitter cards.
- **Observability:** centralized logging, error tracking (Sentry), product analytics, admin audit trail.
- **Testing:** unit + integration + E2E for critical flows (signup, checkout, enrollment, player, payout).
- **API:** versioned, documented (OpenAPI/Swagger), consistent error format.

---

## 10. Integrations

- **Payments:** Stripe + Razorpay (incl. UPI/wallets/net-banking, GST invoices).
- **Email:** SendGrid/SES/Resend (transactional + marketing).
- **Video:** Mux / Cloudflare Stream / AWS MediaConvert + S3 + CloudFront.
- **Search:** Algolia / Meilisearch / Elasticsearch.
- **Auth/OAuth:** Google, Facebook, Apple, GitHub.
- **Analytics:** GA4 + product analytics (PostHog/Mixpanel).
- **Notifications:** FCM (push), Twilio (SMS/OTP).
- **Optional:** LinkedIn certificate sharing, Zoom/live-class for cohort courses, affiliate tracking.

---

## 11. Optional / Advanced Modules (Phase 3+)

- **Subscription plan** ("e-learning Pro") — all-access library, separate billing & revenue model.
- **Live classes / cohorts** — scheduled sessions, calendar, attendance.
- **Business/Teams** — org accounts, seat management, team analytics, SSO.
- **Affiliate program** — referral links, commission tracking, payouts.
- **Mobile apps** (iOS/Android) — offline downloads, push.
- **AI features** — course recommendations, auto-generated summaries/quizzes, AI study assistant, auto-captions/translation.
- **Gamification** — streaks, badges, XP, leaderboards.

---

## 12. Suggested Build Phases

**Phase 1 — MVP (core marketplace loop):**
Auth + roles, course CRUD & curriculum, video upload/playback (HLS, signed URLs), course landing page, search & categories, cart/checkout (Stripe + Razorpay), enrollment, course player with progress, reviews & ratings, basic student & instructor dashboards, basic admin (course approval, user mgmt), transactional emails.

**Phase 2 — Marketplace maturity:**
Wishlist, coupons & promotions, Q&A, notes, quizzes & assignments, certificates, instructor analytics & payouts, refunds, notifications center, messaging, full admin (financials, moderation, CMS, reports), recommendations, faceted search polish, SEO.

**Phase 3 — Scale & differentiation:**
Subscriptions, live/cohort classes, teams/business, affiliate program, mobile apps, AI features, gamification, advanced analytics & A/B testing.

---

## 13. Acceptance Criteria (Definition of Done)

- A guest can search, open a course landing page, preview free lectures, sign up, purchase via Stripe/Razorpay, and immediately start learning.
- A student can track progress, take a quiz, ask a Q&A, leave a review, and download a certificate at 100%.
- An instructor can create a course end-to-end, submit for review, get published after admin approval, see analytics, and view earnings/payouts.
- An admin can approve/reject courses, manage users & categories, process a refund, run a sitewide promo, and edit a CMS page.
- All paid video is protected (signed URLs), payments reconcile correctly with instructor earnings, and the app is responsive, secure, and SEO-friendly.

---

**Instruction to the builder:** Implement the above as a cohesive, production-ready application named **e-learning**. Prioritize the Phase 1 MVP first as a fully working vertical slice, keep the codebase modular and well-documented, write tests for critical flows, and ensure security and payment correctness throughout. Use the data models in Section 7 as the schema foundation and the page map in Section 4 as the routing/navigation blueprint.