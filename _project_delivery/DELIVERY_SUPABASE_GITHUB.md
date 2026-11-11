# Sistema de Presença — delivery notes

## Current stage

Local frontend and Supabase adapter/migration are prepared. Supabase CLI authentication, remote project creation/migration, GitHub repository creation and Pages deployment remain blocked or unverified. No participant records, workbook or photos have been uploaded.

## Verified update — 2026-11-11

- A private GitHub repo exists: `Lucasvdlk10/presenca-setoque`.
- Source worktree initialized on `main`; a scoped 28-file app set is staged for initial commit. No commit or push yet.
- Installed Supabase SDK; `npm run build` passed, Supabase adapter tests 8/8 passed, Python suite 26/26 passed.
- CLI listed Supabase project `Presença`, ref `rixniksfvpfequvmimbe`, region `sa-east-1`, `ACTIVE_HEALTHY`; organization only identified by opaque slug `dbayvytkbqrwvkpihplg`. Confirm that this is Sheila's org and that this is the intended project before altering it.
- Project is not linked (`Cannot find project ref`); migration not applied. Login name `presenca-setoque` has not been independently verified as completed; an interactive Windows Terminal tab is open. Complete `supabase login --name presenca-setoque` in that tab, then verify project/org listing.
- Pages not enabled or deployed. Configure the two public frontend variables and validate the workflow before pushing. Never include participant records or privileged Supabase key in the static site.

## Remote rollout and publication — verified 2026-11-11

- Project owner authorized: CLI organization is `Grupo Se Toque`; target `Presença`, ref `rixniksfvpfequvmimbe`, region `sa-east-1`, healthy.
- Linked the local Supabase project, dry-run showed only the intended initial migration, applied it, confirmed migration `20261110000100` in remote history and a subsequent dry-run returned up-to-date.
- Remote SQL lint: no schema errors. Table stats show 0 estimated records for participants, meetings, attendance, private admin roles and profiles. No participant data imported.
- User explicitly authorized public source to permit Pages under current plan. Repo made public, Pages enabled with Actions. Initial failed workflow due unset variables; configured public URL/publishable key; fixed validation ordering and reran workflow successfully.
- Public Pages URL returned HTTP 200. GitHub main SHA matched local HEAD `4f05c59e989fb8923e959b4e7105c7fb5f472258` at verification.
- Tests/build before release: Vite build passed, adapter tests 8/8, Python suite 26/26.
- Remaining: invite/bootstrap a real admin (needs Lucas's chosen email); exercise public site's auth/data flows. No test user/weak password, Hostinger custom domain or local data migration performed.

## Local source prep

- Canonical root: `C:\Users\Lucas\Desktop\Sistema de Presença`.
- Added `.gitignore` exclusions for operational SQLite/JSON/workbook data, dependencies, build, environment files, and Supabase local state. Before staging, inspect `git status --short --untracked-files=all` and verify the database/workbook are ignored.
- Added `.github/workflows/pages.yml`: locked npm install, Supabase adapter tests, Vite build at repository Pages base path and publish only `dist/`.
- Source repository should be private unless Lucas separately approves public source. GitHub Pages serves the built site publicly.
- Repository initialized locally; no commit/push has been made.

## Backend safeguards

- Intended Supabase project name `sistema-presenca-setoque`, region `sa-east-1`; confirm the actual org and project ref before creation.
- Apply the reviewed fresh-project migration only after confirming a new empty project and `db push --dry-run`.
- Migration uses normalized transactional tables with private admin role/RLS, a private participant-photo bucket, atomic attendance RPC, and read-only analytics star-schema views.
- Never place service-role keys, PATs, DB passwords, or participant data in GitHub Pages frontend. No weak test login. Admin access must follow the documented invite/bootstrap flow with secure credentials.

## Verification still required

- Authentication via official Supabase CLI and read-back of accessible org/projects.
- Confirm Windows System Restore prerequisite before any new software installation; do not bypass it.
- Install only required frontend SDK after restore point succeeds; run adapter tests and full build.
- Create verified Supabase project, dry-run then apply migration, read back RLS/functions/bucket/views.
- Create private GitHub repository, inspect staged file allowlist and secret scan, commit/push; configure Pages and public runtime variables; verify remote main SHA and live site/backend health.
- Obtain the Lucas test account email before invitation; do not create predictable password.
