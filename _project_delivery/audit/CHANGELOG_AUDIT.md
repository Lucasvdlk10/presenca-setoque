# Audit changelog

## 2026-11-07 — baseline before participant photo feature
- User requested a photo field at participant registration, persistent local photos, a thumbnail in the participant list, and double-click enlargement.
- Preflight confirmed local React/Vite + stdlib API + SQLite app; no git repository. Available RAM was 4.93 GB (67.9% used); keep builds sequential and avoid memory-heavy parallel work.
- Regression coverage: 2 `unittest` cases pass for photo persistence/readback, participant listing thumbnail flag, and rejection of invalid image contents without leaving a participant.
- Validation: `python -m py_compile api.py tests/test_participant_photos.py`, Vite production build (2261 modules), and `npm audit --omit=dev` (0 vulnerabilities) passed.
- Live API fixture round-trip returned a 201, `has_photo=1`, exact PNG bytes/type; fixture was removed. Final SQLite counts: 24 participants, 8 attendance facts, 0 photos.
- Isolated browser/Chrome screenshot attempt failed before DevToolsActivePort; visual browser QA remains unverified. App root and transformed React source returned HTTP 200.
- No Git repository is present; no commit created.

## 2026-11-07 — Grupo Se Toque branding and review copy
- Derived palette and art direction from the client’s canonical `site-novo-elite-web-architect` `.leia-web/DESIGN_DIRECTION.md` and `assets/css/site.css`.
- Applied branded identity in the existing React app without changing the attendance/photo/export logic; removed Google Fonts CDN dependency and branded PDF header.
- Production build succeeded; 2 API tests pass; dependency audit: 0 vulnerabilities; Vite and API health 200. Opened the app at `http://127.0.0.1:5173` in the default browser.
- Saved a code/build copy at `.../GRUPO SETOQUE/Sistema de Presença`; excluded SQLite, source workbook, dependencies and obsolete Vue root entry. Source remains canonical on Desktop; clone starts with no attendance data.
- Final source DB counts remain 24 participants, 8 attendance facts, 0 photos. Visual review pending.

## 2026-11-09 — Participants list, editing, and photo maintenance
- Reproduced the original failure in a task-owned headless browser with synthetic API responses: clicking the Participants sidebar entry left the view unchanged. Source inspection confirmed a noninteractive `div` and no participants page.
- Added `web/src/ParticipantsPanel.jsx`; wired semantic desktop and mobile navigation, all-record roster/search, active status, and per-person edit form for name, CPF, phone, email, birth date, notes, active status, and photo add/replace/remove.
- Extended `api.py` `PATCH` to validate updates, transactionally remap attendance and photo rows on CPF changes, and upsert/delete photo blobs without changing unrelated records.
- Added `tests/test_participant_management.py`. Focused test-first cycle went RED for unsupported photo/CPF updates, then GREEN. Full `python -m unittest discover -s tests -v`: 7 tests passed, including the 2 previous photo tests.
- `rtk npm run build`: passed with Vite 8.3.6, 2262 transformed modules. Synthetic UI E2E passed with active and inactive fixtures; profile fields and photo upload payload were submitted; mobile navigation passed with no horizontal overflow. Screenshot saved at `_project_delivery/audit/participants-qa-2026-11-09/mobile-390x844.png` (synthetic data only).
- Read-only canonical UI check: 24/24 participants rendered with 24 edit controls, 24 active, 0 inactive, no runtime exceptions. API health passed. Database stayed at 24 participants, 8 attendance records, 0 photo rows; no canonical write request was sent.
- Restarted only the existing task-owned API service after confirming it had no active clients and the schema/WAL were ready; port 18766 now serves the updated API. Existing Vite service remains at 127.0.0.1:5173. No Git repository; no commit, publish, or deploy.

## 2026-11-09 — Local authentication verification
- Re-ran the full isolated Python suite: 19 tests passed. Vite production build passed (8.3.6, 2263 modules).
- Confirmed current API health and auth-status endpoints return HTTP 200 on loopback; UI root returns HTTP 200. Current unauthenticated status reports `setup_required=false`; one local auth profile is configured. No credentials or token-bearing fields were accessed.
- Read-only SQLite checks returned integrity `ok`, 24 participants, 8 attendance records, 1 photo, and the two auth tables. No canonical mutation was sent.
- Rehashed the pre-auth SQLite backup; size and SHA-256 match its manifest and integrity check is `ok`. Verified the code-review copy has no SQLite database or XLSX source workbook.
- Prior synthetic browser E2E remains the UI fixture evidence for setup/login/profile/password/logout; live credentials were not exercised. No commit, publication, or deploy.

## 2026-11-09 — Participant-name popup and sidebar hover correction
- TDD baseline reproduced both reported issues: double-clicking the attendance-row name did not open the editor; hovering a non-active sidebar option computed white text on the light theme.
- Added a name trigger that opens the existing participant editor in a React portal without changing the attendance view. Keyboard Enter/Space is supported; the dialog has modal semantics, and the overlay is above/blocks the profile controls.
- Corrected the final sidebar cascade to use muted base text and dark ink text over a blush hover surface.
- Synthetic E2E passed at 1280×860 and 390×844 using only mocked GET responses: populated editable field and Save control, role/aria-modal, background blocking, correct hover colors, mobile scrollWidth=390, and zero runtime errors. No save request or canonical API/database mutation.
- Full unit suite passed (19 tests); Vite 8.3.6 build passed (2,263 modules). Visual evidence is in `_project_delivery/audit/participant-ui-qa-2026-11-09-03/`. No commit, publication, or deploy.

## 2026-11-09 — Default meeting date selection
- Reproduced the issue with a frozen-date browser fixture: the page selected the first meeting in the month instead of the latest meeting on or before today.
- Added a shared Monday/Wednesday schedule and initialize the selected date/month/year from the latest scheduled meeting on/before local today. If it falls in the prior month/year, the selectors align to that date; manual period changes retain their existing behavior.
- RED→GREEN E2E cases: 2026-11-09→09; 2026-11-10→09; 2026-11-11→11; 2026-11-12→11; 2026-12-01→2026-11-30; 2027-01-01→2026-12-30. The selected option and month/year labels all matched expected values.
- Test used a mocked API and only GET fixture requests; no canonical writes, no runtime errors. Python suite passed (19); Vite 8.3.6 build passed (2,263 modules). Screenshots: `_project_delivery/audit/date-default-qa-2026-11-09/`. No commit, publish, or deploy.

## 2026-11-10 — Supabase backend preparation (in progress)
- Added the initial fresh-project migration, Supabase README, and static schema contract tests. The schema separates normalized write tables from `analytics` fact/dimension views; admin RLS protects records and a private Storage bucket holds participant photos.
- Verification: 7 static migration-contract tests passed; 8 Supabase-adapter Node tests passed; `node --check` passed for backend/adapter modules; full Python suite passed (26). The migration has not been applied or exercised against Postgres; frontend build and JSX/browser QA have not run.
- No existing SQLite, workbook, backups, participant records, or photos were uploaded. No GitHub repo/page, Supabase project, Auth user, deployment, or Hostinger change has been created.
- Supabase SDK installation is paused: Windows rejected the required System Restore point because a point already exists within the last 1,440 minutes; the requested point was verified absent. No bypass or installation was performed.
- A dedicated local Supabase profile file and PowerShell login window were prepared, but no PAT/password was entered and no authentication was completed. The test user's email remains unprovided; no default or weak password was created.
## 2026-11-11 — Supabase CLI profile investigation and GitHub Pages source preparation

- The named Supabase CLI profile file is not a usable v2.121.0 auth profile; passing it through `--profile` returns `ProfileLoadError: Unsupported Config Type`. CLI automatic login fails in this environment because it has no interactive TTY; no access token was entered and no new-account login was verified.
- `supabase projects list` returned only the existing Lucas CRM and staging projects (neither is the Setoque project). Do not link or modify either one. A separate Se Toque login window is open for the user to finish the standard login flow; verify via `supabase projects list` afterward before creating anything.
- Initialized local Git on `main`; added privacy `.gitignore` and a Pages workflow that publishes `dist/` only. No staging, commit, remote creation, push, migration, or deployment performed yet.
- The `@supabase/supabase-js` package is absent, so the Pages production build is not currently verified. Windows restore point must succeed before software installation; previous restore-point request was refused, so no install/policy bypass was made.
- No local participant database, workbook, backup, photo, credential, or auth secret was staged/uploaded. Repository visibility remains private by default; Pages publication will be public.
## 2026-11-11 — Supabase/GitHub setup resumed

- CLI access now enumerates organization `Grupo Se Toque` and project `Presença` (`rixniksfvpfequvmimbe`, `sa-east-1`, `ACTIVE_HEALTHY`). The project is not linked; no migration or remote database write has occurred. Confirm account ownership and inspect current schema before dry-run.
- Private repository `Lucasvdlk10/presenca-setoque` exists. Initial app files are staged, not committed/pushed. SQLite, XLSX, backups, QA evidence and local launch scripts are excluded.
- Installed Supabase JS SDK. Production Vite build passed; adapter tests 8/8 and Python tests 26/26 passed.
- Pages workflow and env example prepared; Pages not enabled/deployed. Production Actions Variables are still missing.
- Login tab was opened but login completion has not been confirmed. No auth secret or participant data was put into Git.
## 2026-11-11 — Grant application access to initial users

- Root cause: both Supabase Auth users were confirmed, unbanned, and had successful Auth sign-ins, but had no app profile or active admin role; app correctly denied access after authentication.
- Added active `admin` role rows and display profiles for the two requested owner-created users in one transaction.
- Verified both rows by read-back. No password read/change, no participant data change.
- User can refresh the Pages app and sign in. Recommend rotating chat-shared credentials after access is restored.
