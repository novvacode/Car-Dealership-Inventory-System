# Code Review

A self-review carried out by the AI assistant (Claude Code) after the first implementation pass. It covered authentication, authorization, input validation, race conditions, database errors, unhandled exceptions, frontend/backend integration and test gaps. Each suspected issue was checked empirically (curl probes against the running API, or a failing test) before being treated as real.

**Status:** AI self-review complete. **An independent human review is pending.**

## Findings fixed

| # | Severity | Finding | How verified | Fix | Commit |
|---|---|---|---|---|---|
| 1 | Medium | `POST /api/vehicles/99999999999/purchase` (and PUT, DELETE, restock) returned **500**: the unbounded `int` path parameter overflowed PostgreSQL `INTEGER` and raised `DataError`. | curl returned 500. A new parametrized test failed (5 cases). | `VehicleId = Path(ge=1, le=2**31-1)` → 422 | `51b891a` |
| 2 | Medium | `?offset=10**20` on list and search returned **500** (bigint overflow). | curl returned 500. A new test failed (2 cases). | `Offset = Query(ge=0, le=2**31-1)` | `51b891a` |
| 3 | Medium | The `.env.example` placeholder `SECRET_KEY` was 33 characters, so it **passed** the 32-character minimum. An unedited copy would have run with a publicly known JWT signing key, letting anyone forge admin tokens. | Inspection, then a `test_config.py` test | Placeholder changed to `CHANGE_ME`, which fails validation, so the app refuses to start | `51b891a` |
| 4 | Low | `local_postgres.py` interpolated database names from `.env` into SQL and CLI arguments. The input is developer-controlled, but unvalidated. | Inspection | Names restricted to `[A-Za-z0-9_]+` | `51b891a` |
| 5 | Low (UI) | Stock badges wrapped onto two lines in the admin table at tablet width. | Screenshot of the running app | `whitespace-nowrap` | `7f7d25e` |
| 6 | Low (UI) | Grammar ("1 vehicle match") and the greeting "Welcome back" shown to brand-new users. | Browser check | Copy fixed | `fe59ff7` |

Issues found and fixed during development, before the review pass:

- `local_postgres.py start` hung forever on Windows, because the postmaster inherits `pg_ctl`'s stdout pipe. Output is now sent to `DEVNULL` and the log file.
- The initial Alembic `downgrade()` did not drop the `user_role` enum, so downgrade then upgrade failed. Fixed, and verified by a downgrade/upgrade round trip.

## Checked and found sound

- **Overselling**: the purchase is one conditional `UPDATE … WHERE quantity >= :n RETURNING`, plus a `CHECK (quantity >= 0)` constraint. The concurrency tests pass, and they **fail** against a naive implementation (mutation check in TEST_REPORT.md).
- **Admin edit vs. purchase race**: `PUT` locks the row with `SELECT … FOR UPDATE` before applying changes.
- **Privilege escalation**: `/register` ignores a `role` field (tested). Admins can only be created via `scripts/create_admin.py`.
- **Authorization source of truth**: the token carries only `sub` and `exp`. The user and role are loaded from the database on every request, so deleted users get 401 (tested).
- **JWT verification**: the algorithm is pinned to HS256 and `exp` and `sub` are required. Tests confirm that `alg=none`, a wrong key, expired tokens and garbage tokens are rejected.
- **User enumeration**: unknown email and wrong password give an identical 401. A dummy bcrypt check equalises timing.
- **bcrypt 72-byte truncation**: registration rejects passwords over 72 bytes, including multibyte ones under 72 characters (tested). Login with such a password returns 401, not 500 (tested).
- **SQL injection and LIKE wildcards**: all queries use bound parameters, and `%`, `_` and `\` are escaped in search (tested).
- **Non-finite prices**: `NaN` and `Infinity` in search return 422 (curl and test).
- **Duplicate-registration race**: handled by the unique index plus `IntegrityError` → 409. A global `IntegrityError` → 409 handler and a generic 500 handler prevent stack traces from leaking.
- **Frontend**: role checks in the UI are for navigation only. The API was confirmed to return 403 to a customer token in the browser. Stale search responses are discarded, and a 401 on any authenticated call signs the user out.

## Not fixed (accepted limitations, documented in README)

| Finding | Reason / recommendation |
|---|---|
| No rate limiting or lockout on `/api/auth/login` | Out of scope for this assessment. Add at the proxy or with middleware before production. |
| Stateless JWT: no server-side revocation on logout | Acceptable with a 60-minute expiry. Use refresh tokens and a denylist if needed. |
| Token stored in `localStorage` (XSS-readable) | Simplicity trade-off. Consider httpOnly cookies with CSRF protection. |
| No security headers (CSP, HSTS) set by the app | Expected to be set by the reverse proxy in deployment |
| UI loads at most 500 vehicles with no pagination UI | API supports `limit`/`offset`; UI pagination is a follow-up. |
| Modal does not fully trap Tab focus | Accessibility follow-up |

## Human review

_Pending: to be completed by the developer, with any additional findings and the fixes made._
