# Project continuity

Canonical path: `C:\Users\Lucas\Desktop\Sistema de Presença`. Standalone local attendance app; not part of LEIA IA, CRM, or other projects. Current stack: React/Vite frontend in `web/`, Python stdlib HTTP API in `api.py`, SQLite `presencas.sqlite3`; launcher `Abrir Sistema.bat`. Local data remains on device. Supabase SQL is a future schema reference only.

Current verified baseline (2026-11-07): frontend production build passed; npm audit reported 0 vulnerabilities; local API and Vite returned HTTP 200; SQLite held 24 participants and 8 attendance facts. App currently supports participant creation and attendance with period CSV/XLSX/PDF exports. No Git repository or automated test suite was present at baseline.

Feature completed: optional participant photo capture in the creation modal; browser downsizes to 720 px and JPEG before sending; SQLite stores image bytes in `participant_photos` (max 4 MiB, allowed JPEG/PNG/WebP with signature checks). The roster exposes `has_photo`, serves images from loopback API, renders a thumbnail, and opens a full preview by double-click (keyboard Enter/Space supported). Future Supabase model stores a Storage object path in `photo_path`.

Verification on 2026-11-07: two isolated Python API regression tests pass; `python -m py_compile` passes; `npm run build` succeeds (Vite 8.3.6, 2261 modules); `npm audit --omit=dev` reports 0 vulnerabilities; live API photo round-trip succeeded and fixture was removed. DB remains 24 participants, 8 attendance entries, 0 photo rows. The earlier isolated Chrome attempt failed; a desktop screenshot was later captured from the default Chrome session after the Setoque redesign.

## 2026-11-07 — Grupo Se Toque design
- Applied the current live website direction from `setoqueipatinga.com.br`: light rose paper, coral-red accents, rounded white cards/pill controls, softer shadows, and Inter/system typography. Added the official heart SVG to the sidebar and favicon; preserved attendance/photo/export behavior.
- Updated the app shell, labels, PDF report color/title and browser tab title; attendance, photo, export and local SQLite behavior remain unchanged.
- Built and served at `http://127.0.0.1:5173`; `/` and transformed React/CSS modules returned 200; API health returned 200.
- A code-only review copy was saved at `C:\Users\Lucas\Desktop\LEIA IA\MARKETING CORE\CLIENTES\GRUPO SETOQUE\Sistema de Presença`; the SQLite database and source workbook were intentionally left in the canonical Desktop project, and the copied legacy root Vue `index.html` was omitted. Preview opened via default browser.
- Two photo API tests, production build, and `npm audit --omit=dev` pass; original database remains 24 participants / 8 attendance records / 0 photos.
- Visual review by Lucas is pending. Project still has no Git repository.

## 2026-11-09 — Participants list and editing
- Root cause confirmed: the sidebar’s “Participantes” entry was a noninteractive `div`; no participants screen existed. Attendance loading kept only active records. The API update route omitted photo and CPF updates.
- Added accessible desktop/mobile navigation and a full participant screen that includes active and inactive records, search, and an edit action on each card. Edit form covers name, CPF, phone, email, birth date, notes, active status, and photo add/replace/remove.
- API `PATCH` now validates names, CPF format, active state, and photo payloads, updates a changed CPF transactionally across attendance and photo references, and upserts/removes the photo in the same transaction. Existing participant records were not edited during implementation.
- Verification on 2026-11-09: 5 participant-management API tests plus 2 existing photo tests pass; Vite 8.3.6 production build passes (2262 modules). Synthetic browser E2E verified active/inactive listing, per-person edit, CPF/name/phone save, photo upload payload, mobile navigation, and no horizontal overflow.
- Read-only live UI check matched all 24 canonical participants to 24 edit controls; 24 active, 0 inactive, 0 runtime exceptions. API health is OK; canonical counts remain 24 participants, 8 attendance records, 0 photo rows. No live record writes were sent.
- Restarted the previously task-owned API process on port 18766 after confirming no active API clients and that the existing schema was ready. No duplicate listener. Live UI remains on the existing Vite service at 127.0.0.1:5173.
- Synthetic mobile evidence: `_project_delivery/audit/participants-qa-2026-11-09/mobile-390x844.png`. No personal data in the screenshot. No Git repository, commit, publication, or deploy.

## 2026-11-09 — Local authentication verification
- Added single-profile local authentication with setup/login, hashed password storage, expiring sessions, protected data routes, profile edit, password change, and logout. The README and `audit/TECHNICAL_RULES.md` describe the contract and SQLite-at-rest limitation.
- Current verification: `python -m unittest discover -s tests -v` — 19 passed; `rtk npm run build` — passed (Vite 8.3.6, 2263 modules). Prior synthetic frontend E2E covered setup/login/profile/password/logout; no real credential was used in the E2E.
- Live loopback read-only probe: UI `/` HTTP 200; API health and `/api/auth/status` HTTP 200. Current status is `setup_required=false`, `authenticated=false` for the probe with no session cookie; one local auth profile is configured. No username, password, password hash, cookie, or session token was read.
- Current SQLite integrity is `ok`; counts are 24 participants, 8 attendance records, 1 photo. Auth tables exist. Verification used read-only connections; no participant mutation was sent.
- Pre-auth backup `_project_delivery/backups/pre-auth-2026-11-09/presencas.sqlite3` remains canonical-only: 57,344 bytes, SHA-256 matches its manifest, `PRAGMA integrity_check=ok`; it contains the pre-auth participant/attendance/photo tables and aggregate counts 24/8/1. The code-review copy has no SQLite database or XLSX workbook.
- The earlier first-run smoke result (`setup_required=true`) is superseded by the current configured-account state. Do not submit or request real credentials during verification. No Git repository, commit, publish, or deploy.

## 2026-11-09 — Participant-name editor and sidebar hover
- Confirmed in the canonical Group Se Toque Sistema de Presença that the attendance-row name had no edit handler; the final legacy CSS hover rule forced white text over the light sidebar. Initial synthetic browser check reproduced both issues.
- Double-clicking a participant name now opens the existing full edit dialog in a portal while keeping the attendance view behind it. The existing fields and photo controls remain available; the E2E confirmed an editable name field and Save button without submitting changes. Enter and Space also open the dialog.
- The dialog exposes role `dialog`/`aria-modal=true`; its backdrop blocks interaction with the profile control behind it. Sidebar text uses the theme’s dark ink color on a blush hover highlight.
- Synthetic API E2E at 1280×860 and 390×844 passed: hover color `rgb(29, 30, 27)` over `rgb(248, 233, 229)`, mobile width/scrollWidth 390/390, no runtime errors, and only mocked GET requests. No canonical API writes or database mutations.
- Full Python suite: 19 tests passed. Vite 8.3.6 production build passed with 2,263 modules. No commit, publication, or deploy. Evidence: `_project_delivery/audit/participant-ui-qa-2026-11-09-03/`.

## 2026-11-09 — Default meeting date
- The attendance app now defaults to the latest scheduled meeting on or before the device’s local date: today when it is Monday/Wednesday, otherwise the prior Monday/Wednesday. When that meeting falls in the previous month, the month/year selectors follow it.
- Changing the month/year manually retains the existing fallback to the first scheduled meeting in the selected month when the prior date is not valid there.
- Synthetic browser test was RED before the change (it chose November 2 for the November 9–12 cases and future dates at month boundaries) and GREEN afterward across six frozen-date cases: Nov 9→Nov 9; Nov 10→Nov 9; Nov 11→Nov 11; Nov 12→Nov 11; Dec 1→Nov 30; Jan 1, 2027→Dec 30, 2026.
- UI E2E had zero runtime errors and only mocked GET requests; no real API writes or database mutation. Python suite: 19 passed. Vite 8.3.6 build: 2,263 modules. Evidence: `_project_delivery/audit/date-default-qa-2026-11-09/`. No commit, publish, or deploy.

## 2026-11-10 — Supabase backend and public preview preparation
- Lucas confirmed a public GitHub Pages preview with Supabase Auth/RLS. The Pages site will be public; keep the source repository private if the account plan permits. Do not make the source repository public without separate confirmation.
- The target is a new project tentatively named `sistema-presenca-setoque` in `sa-east-1`. The local SQLite database, workbook, participants, attendance rows, and photos remain canonical-only; no data migration or upload is authorized by this request.
- Added `supabase/migrations/20261110000100_initial_schema.sql` with normalized transactional tables, private admin roles, RLS, a private photo bucket, a transactional attendance RPC, and `analytics` star-schema views. Added `supabase/README.md` and `tests/test_supabase_schema_contract.py`.
- Added a Supabase API adapter and synthetic Node tests, and started frontend changes for local/Supabase mode, email login, private signed photo URLs, and GitHub Pages base paths. The adapter suite passes 8 tests; the full isolated Python suite passes 26 tests. JavaScript syntax checks passed for the adapter modules.
- No Vite build or JSX/browser QA has run for the new frontend changes: `@supabase/supabase-js` is not installed. A System Restore point was required before installation, but Windows refused a new point because another point was created within the last 1,440 minutes; verification confirmed the requested point was not created. No install or policy bypass occurred.
- A separate Supabase CLI profile file exists at `C:\Users\Lucas\.supabase\profiles\presenca-setoque.yaml`; a PowerShell login window was opened using that profile and token name `presencia-setoque`. No token was entered and no remote account/project was changed. The app test user's email is still unprovided; no test account or weak password was created.
- No Supabase project, migration, Git repository, commit, GitHub Pages deployment, Hostinger change, or data transfer has occurred. Complete secure CLI authorization and the restore-point prerequisite before continuing with SDK installation, remote schema validation, or publication.

## 2026-11-11 — Verified Supabase/GitHub state
- Private GitHub repo `Lucasvdlk10/presenca-setoque` exists. Source worktree is `main` with an allowlisted initial app file set staged, but no commit/push. Local participant data, SQLite, workbook, backup and QA evidence excluded.
- Installed `@supabase/supabase-js`. Vite production build passed; adapter Node tests 8/8 and Python suite 26/26 passed.
- CLI enumerated organization `Grupo Se Toque` and healthy project `Presença`, ref `rixniksfvpfequvmimbe`, region `sa-east-1`. Sheila's ownership is not established; confirm with Lucas. Project is not linked and migration not applied. Inspect existing schema before dry-run/apply.
- Interactive CLI login has not been confirmed. JSON-mode shell attempts fail with NonInteractiveError; a separate Windows Terminal tab “Supabase CLI Se Toque Login” is open. Complete `supabase login --name presenca-setoque` there and verify org listing. Do not paste token in chat.
- Pages config prepared but not enabled/deployed; URL and publishable key must be set as repo Actions Variables. Do not use service-role key in client. No test login created.
- Git stage review excludes local database/workbook, backups, QA snapshots and local launcher. `git diff --cached --check` only flags trailing blank line in existing `web/src/style.css`; no spaces/tabs issue. Workflow was linted by patch tool, but its deployment config should be inspected before commit.
