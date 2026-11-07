# Remediation and deployment preparation

The audit in `AUDIT.md` describes the pre-fix checkout. This change addresses its financial and outlet-isolation findings and prepares deployment; it does not provision or deploy a hosted project.

Implemented:

- Transactional loyalty reservations and coupon allocation, including competing first-order codes.
- Atomic loyalty earning with payment capture; expiry restores reserved points exactly once.
- Late released-discount captures are rejected/refunded, with crash recovery through cron.
- Durable refund intents, pending/failed/processed state handling, duplicate protection, explicit rejection retries and timeout reconciliation.
- Staff-outlet POS menu/tax selection and order-outlet receipt loading, with issuer snapshots.
- Outlet-scoped recipe replacement, stock eligibility checks after rejection, and fixed portion labels.
- Outlet ownership checks, CRM customer visibility, shared-staff credential/activation guards, atomic last-owner checks and guest-profile preservation.
- Production test-login/persistence guards, Supabase RLS migration, serverless SQL pool settings, health checks and Vercel scheduling.
- Clean lint scope, corrected test adapter typing, CI, deployment preflight and operational/rollback documentation.
- Mobile category navigation moved into reserved header space so it cannot cover ADD.

Validation:

- Full `npm run check` passed: typechecking, lint, 157 tests across 23 files, and production build.
- Migration applied to the local PGlite database; hosted databases were not changed.
- Migration repeatability and denial of public-role access tested with real Postgres RLS semantics in PGlite.
- Mobile 390×844 smoke: ADD passes hit testing, no horizontal overflow or browser page errors.
- `/api/health` returns 200 locally; unauthorized cron returns 401; unauthenticated admin redirects to sign-in.
- `npm audit --omit=dev`: zero vulnerabilities. Full audit retains 12 moderate development-tool findings, documented in `SECURITY-SCANNING.md`.
- GitHub CI additionally runs financial regressions against PostgreSQL 17; its actual run status must be checked after pushing.

The Snyk SCM import limitation is handled with a workspace-aware CLI workflow. The repository has no `SNYK_TOKEN` secret at preparation time, so an authenticated Snyk scan still needs account setup. Supabase/Vercel target selection, credentials and real provider acceptance checks remain deployment steps, documented in `DEPLOYMENT.md`.
