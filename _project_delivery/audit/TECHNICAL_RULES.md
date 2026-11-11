# Technical Rules — Sistema de Presença

## Local authentication boundary
- Keep the API bound to `127.0.0.1`; do not expose it to LAN or public hosting without a separate security review, TLS, and an authorization design.
- Use one local administrator profile. Do not ship a default username/password or accept credentials through chat. On first launch, the user chooses the profile name, username, and passphrase in the app.
- Store only a PBKDF2-HMAC-SHA256 password hash with a unique random salt; compare hashes in constant time. Enforce a 15-character minimum and allow passphrases.
- Generate session tokens with Python `secrets`; persist only SHA-256 token digests. Use a 12-hour server-side expiry and a `__Host-` cookie with `Secure; HttpOnly; SameSite=Strict; Path=/`, no `Domain`; revoke on logout and rotate after password change.
- Allow credentialed CORS only from `http://127.0.0.1:5173`. Verify that exact `Origin` on state-changing requests. Never use wildcard CORS with credentials.
- Require a valid session for every participant, attendance, summary, and participant-photo route, including reads. Keep `/api/health` and `/api/auth/status` limited to non-sensitive status.
- Return `Cache-Control: no-store` for API/auth responses and photos. Never log or expose passwords, raw session tokens, or password hashes in UI, tests, errors, or audit files.
- Test auth and data mutations only with temporary SQLite databases and synthetic fixtures. Back up the canonical SQLite database inside the canonical project before activating a schema change; never copy the participant database or spreadsheet into review/preview folders.
- The login is a local interface/API access gate, not encryption at rest. The SQLite file remains accessible to a person with access to the same Windows account and filesystem.

## Preservation
- Keep the canonical database and spreadsheet exclusively under `C:\Users\Lucas\Desktop\Sistema de Presença`.
- Preserve all existing participant, attendance, and photo records during authentication changes; verify aggregate counts before/after without printing personal fields.
- Do not publish, deploy, or change hosting as part of local feature work without separate approval.
