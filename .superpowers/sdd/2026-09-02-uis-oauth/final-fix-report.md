# UIS OAuth final fix report

Base revision: `92589d0eae2aa530bb93c918c06ee03ec2c598c9` on `dev`.

## Changes

- Added an outer ASGI response-header wrapper. Every `/api/auth/*` response
  now sends `Cache-Control: no-store`; canonical and trailing-slash callback
  responses also send `Referrer-Policy: no-referrer`. The wrapper encloses the
  FastAPI stack so normal responses, redirects, validation errors, and HTTP
  error responses are covered centrally.
- Active `POST /api/auth/logout` now requires a valid local session and a
  same-origin browser source. It accepts `Origin`, falling back to `Referer`
  only when `Origin` is absent, and compares normalized scheme/host/effective
  port against `AUTH_FRONTEND_URL`. Missing, malformed, and cross-origin
  sources return 403 without clearing the session or redirecting; anonymous
  same-origin requests return 401.
- Clarified that no-token front-end passive logout should have no query while
  retaining explicit defense-in-depth redaction tests for unexpected sensitive
  query values.
- Added a callback-to-real-XLSX-export integration test without overriding
  `require_current_user`.
- Updated the OAuth design and README with the response-header and active
  logout source requirements.

## TDD evidence

- RED against `92589d0`: `backend/.venv/Scripts/python.exe -m pytest
  tests/test_auth.py` produced 8 expected failures: absent auth cache/referrer
  headers and unrestricted active logout.
- GREEN after the minimal implementation: the same focused command passed
  `30 passed` (one existing TestClient deprecation warning).

## Verification

- Backend full suite: `63 passed` (one existing TestClient deprecation warning).
- `python -m compileall app`: completed successfully.
- Frontend: `19 passed`; `npm run type-check` and `npm run build` completed
  successfully.
- `git diff --check` completed without whitespace errors.
- Branch stayed `dev`; `backend/.env` is not tracked and was neither read nor
  staged.

## Residual release gates

- The upstream proxy/CDN/WAF must still redact OAuth callback query strings
  before they reach FastAPI; in-application middleware cannot protect those
  upstream logs.
- A real UIS login, token exchange, user-info retrieval, and global logout
  require the production UIS credentials and platform configuration. They were
  not attempted here.
