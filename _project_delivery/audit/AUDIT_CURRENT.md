# Current audit

- Project: local attendance registration app in `C:\Users\Lucas\Desktop\Sistema de Presença`.
- Stack: React + Vite; Python standard-library API bound to loopback; local SQLite DB.
- Baseline evidence from previous task: `npm run build` passed; `npm audit --omit=dev` reported zero vulnerabilities; API/UI health routes returned 200; DB contained 24 participants and 8 attendance rows.
- Local-only privacy: CPF data remains in the SQLite DB; do not expose the API outside loopback.
- Implemented feature: optional participant photo, client-side resize to 720 px/JPEG, local SQLite BLOB table (`participant_photos`), MIME/signature/size validation, `has_photo` in participant list, binary photo GET route, thumbnail with double-click lightbox and keyboard open/close control; future Supabase model includes `photo_path`.
- Verification: two isolated Python API tests pass; API Python compile passes; Vite production build passes (2261 modules); `npm audit --omit=dev` shows 0 vulnerabilities. Live round-trip returned image/png bytes exactly and was cleaned up.
- Final DB check: 24 participants, 8 attendance rows, 0 participant photo records; migration only added the empty photo table. API reports healthy; UI root and transformed React source return HTTP 200.
- Desktop Chrome capture at 1456×773 confirmed the new rose/coral layout, rounded cards and controls, official heart logo, statistics and roster without visible clipping; on 2026-11-09, the Participants screen was also visually checked at 390×844 with synthetic fixtures (`audit/participants-qa-2026-11-09/mobile-390x844.png`), with no horizontal overflow. Lucas’s broader branding feedback remains pending.
- Git: project is not a Git repository; no commit is available.
- 2026-11-07 follow-up: refreshed from current official-site palette (paper #FFF6F2, coral #C4313C/#DD3C4E, blush #F0D5CE, muted #735053, ink #1D1E1B); official heart SVG in sidebar and favicon; 18–24px surfaces and pill controls; lighter sidebar and softer shadows. PDF header uses the coral brand color.
- Build: Vite 8.3.6, 2261 modules, passed; two API regression tests pass; npm audit 0 vulnerabilities. Live endpoints UI 200, API health 200.
- Preview URL opened in the default browser: `http://127.0.0.1:5173`.
- Copy saved in Grupo Setoque client folder without SQLite/source workbook and without old root Vue index; canonical project/data remain at Desktop path. Current database verified unchanged: 24 participants, 8 attendance, 0 photos.
- The code-review copy remains without `node_modules` and personal data, so it is not an independently seeded running instance. Lucas's follow-up feedback on participant double-click and sidebar hover was applied to the canonical project and verified in the new entry below; the review copy remains unchanged.
- 2026-11-09 Participants delivery: desktop/mobile navigation opens a searchable full roster (active and inactive) with an edit action per record; name, CPF, phone, email, birth date, notes, active status, and photo add/replace/remove are editable.
- The API transactionally remaps attendance and photo foreign keys when CPF changes; photo replace/remove and duplicate/invalid CPF behavior are covered by isolated tests.
- Verification: `python -m unittest discover -s tests -v` — 7 passed; `rtk npm run build` — passed (Vite 8.3.6, 2262 modules); synthetic UI E2E passed for two records, editing, photo payload, mobile navigation, and overflow.
- Canonical DB read-only validation: 24 participant cards and edit controls match API count; 24 active, 0 inactive, 8 attendance records, 0 photo rows; 0 JavaScript runtime exceptions. No write requests sent to the canonical API.
- The previous task-owned API service on port 18766 was restarted with updated code; health/read-only count check passed. No duplicate listener. App URLs remain loopback-only at `127.0.0.1:5173` and `:18766`.
- Synthetic mobile evidence: `_project_delivery/audit/participants-qa-2026-11-09/mobile-390x844.png`. No Git repository, commit, publication, or deploy.

## Authentication — current verification (2026-11-09)
- API regression suite: 19 tests passed, including setup/login, session expiry/revocation, profile/password changes, CORS/origin checks, and unauthenticated-route rejection using isolated SQLite fixtures.
- Frontend production build passed with Vite 8.3.6 (2263 modules). Prior synthetic UI E2E covered setup, login, profile, password change, logout, and profile menu with a mock API; no real credentials were submitted.
- Live loopback status-only check: UI `/`, API `/api/health`, and `/api/auth/status` all returned HTTP 200. Current status: `setup_required=false`, `authenticated=false` for a request without a session cookie; one local auth profile exists. No credential, username, hash, cookie, or session token was inspected.
- Current SQLite integrity is `ok`; only aggregate counts were read: 24 participants, 8 attendance records, 1 photo. Auth tables are present. No canonical write was made.
- Pre-auth backup is 57,344 bytes; its SHA-256 matches `manifest.json`, SQLite integrity is `ok`, and recorded counts are 24/8/1. It remains only in the canonical project. The code-review copy contains no `.sqlite*` or `.xlsx` files.
- Current account status supersedes the earlier first-run smoke. No login attempt, credential recovery, deploy, or external publication was performed.

## Participant-name editor and sidebar hover — 2026-11-09
- The attendance-row participant name is now a keyboard-accessible trigger: double-click, Enter, or Space opens the existing participant edit dialog without switching away from the attendance view.
- The dialog is portaled above the app, marked as modal, and blocks background interaction. Existing profile fields and photo add/replace/remove controls are reused; no save was submitted in UI QA.
- The sidebar hover now uses dark ink text on a blush background; removed the legacy white-on-light override.
- Synthetic browser verification passed at desktop and mobile sizes. Only fixture GET requests were observed; no real API write or canonical database mutation. UI runtime errors: 0; mobile horizontal overflow: 0.
- Python suite: 19 passed. Production build: Vite 8.3.6, 2,263 modules. Evidence: `_project_delivery/audit/participant-ui-qa-2026-11-09-03/`. No Git, commit, publish, or deploy.

## Default meeting date — 2026-11-09
- The default is the latest Monday or Wednesday on/before local today; if today is a meeting day, select it. Month/year follow the selected date across month/year boundaries.
- Verified with six frozen-date browser cases: Monday Nov 9, 2026→Nov 9; Tuesday Nov 10→Nov 9; Wednesday Nov 11→Nov 11; Thursday Nov 12→Nov 11; Tuesday Dec 1→Nov 30 (month selector November); Friday Jan 1, 2027→Dec 30, 2026 (month/year December 2026).
- The test initially failed on the old first-of-month default, then passed after the change. All API calls were mocked GETs; zero runtime errors and no canonical writes. Evidence: `_project_delivery/audit/date-default-qa-2026-11-09/`.
- Full Python suite: 19 passed. Vite build: 8.3.6, 2,263 modules. No deploy or publication.

## Supabase preparation — 2026-11-10
- Public GitHub Pages preview was selected by Lucas; page is intended to be public. Source repository remains private by default; do not make it public unless Pages plan requires it and Lucas separately approves.
- Added a fresh-project migration for normalized `participants`/`meetings`/`attendance`, private admin roles, RLS, private photo storage, transactional attendance saving, and analytics star views. The 7 static schema contract tests pass. The migration is not applied and has not been validated against live Postgres.
- Added `supabase/README.md`. No local SQLite/XLSX/backup/photo data was copied or uploaded.
- Supabase adapter test suite: 8/8 Node tests pass; `node --check` passed for backend and adapter modules. Full Python suite: 26/26 passed. Vite build and JSX/browser QA remain unverified because `@supabase/supabase-js` is not installed.
- Restore-point request before SDK installation was rejected because Windows has a restore point within the last 1,440 minutes; a read-back confirmed the requested point was not created. No SDK installation, policy modification, or system change occurred.
- Supabase CLI profile file is present with public endpoint settings only. A separate PowerShell login window is open for the new profile; no PAT was entered, no Supabase account was authenticated, and no project was created.
- App test account remains blocked on the missing email; no default/weak password was created. No Git repository, push, Pages publication, Hostinger change, Supabase migration, or data import has occurred.
## 2026-11-11 — final release state

- Public GitHub source was explicitly authorized by Lucas after GitHub rejected Pages on the private repo tier. Repo visibility now public, Pages configured with Actions, branch `main` pushed (current deployed source SHA to verify via API).
- The first two Actions runs failed because validation followed the build and variables were absent. Workflow was corrected so validation runs before build; a new successful Actions build/deploy and HTTP check is still required.
- The CLI sees organization `Grupo Se Toque` and healthy project `Presença` (`rixniksfvpfequvmimbe`, `sa-east-1`). It has not been linked; no migration/data write performed. Confirm this is Sheila's intended account/project.
- No URL or publishable key configured as repository Actions Variables; workflow will fail-fast until Lucas supplies or authorizes setting them via CLI.
- Build and tests pass locally: Vite build, 8 JS adapter tests, 26 Python tests.
- Confirmed organization `Grupo Se Toque` and project `Presença`; linked ref `rixniksfvpfequvmimbe`. Dry-run showed only initial migration; applied and verified remote history plus clean subsequent dry-run. Remote lint reports no schema errors and operational tables have no records.
- GitHub source visibility was changed to public only after explicit user approval. Pages Actions enabled; latest successful run returned HTTP 200 at the public Pages URL. Local and remote `main` matched at release SHA `4f05c59e989fb8923e959b4e7105c7fb5f472258`.
- Actions Variables set to project URL and publishable key. No service-role key in repo/client. Build and adapter/Python tests all passed.
- Outstanding: secure admin invitation/first sign-in requires Lucas's target email; no weak/default credential. No data import or Hostinger domain setup.
- Post-audit documentation commit `03b324c3586a89b48f14f88eb603fe243831eae9` is now on remote `main`; its Pages workflow run `43027403131` completed build and deploy successfully. Public URL probe: HTTP 200; local and remote SHA match. Supabase migration list confirms initial migration; dry-run remains up-to-date.
