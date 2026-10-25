# Test Report

All results below come from commands actually run in the development session on 2026-10-25 (Windows 11, Python 3.10.0, Node 24.17.0, PostgreSQL 16.2 via `backend/scripts/local_postgres.py`). No coverage tool was run, so no coverage percentage is reported.

## Final results

| Suite | Command | Result |
|---|---|---|
| Backend (Pytest + HTTPX `TestClient`, real PostgreSQL) | `cd backend && python -m pytest` | **90 passed**, 0 failed (34.07 s), 1 warning |
| Frontend (Vitest + React Testing Library) | `cd frontend && npx vitest run` | **50 passed** in 8 files, 0 failed |
| Frontend type check | `npx tsc -b` | No errors |
| Frontend production build | `npx vite build` | Built successfully |

The one backend warning is a `DeprecationWarning` from Starlette's test client about an anyio alias, which comes from library code rather than this project.

### Backend tests by file

| File | Tests | Covers |
|---|---|---|
| `tests/test_auth.py` | 18 | Registration (normalised email, hashed password, duplicate email 409, cannot self-assign admin, invalid input 422, 72-byte bcrypt limit); login (success, case-insensitive email, wrong password and unknown email return the same 401, malformed body); token verification (missing, garbage, expired, wrong key, `alg=none`, deleted user) |
| `tests/test_vehicles.py` | 49 | Auth required for listing; customers get 403 and anonymous users 401 on every admin endpoint; create/update/delete including invalid prices and quantities; search by make, model, category, price range and combined filters; literal `%`/`_`; invalid range 422; out-of-range IDs and offsets return 422 |
| `tests/test_inventory.py` | 20 | Purchase success and audit record; multi-unit purchase; zero stock and over-quantity return 409 with stock unchanged; invalid quantities 422; 404; unauthenticated 401; restock (success, validation, max stock 409, 404); **concurrency**: 20 parallel buyers for 5 units, and mixed-size concurrent orders |
| `tests/test_config.py` | 3 | Placeholder or short `SECRET_KEY` rejected, non-PostgreSQL URL rejected, CORS parsing |

### Frontend tests by file

| File | Tests | Covers |
|---|---|---|
| `src/api/client.test.ts` | 7 | Error message parsing (string and validation arrays), bearer header, ApiError, 401 handler, network failure |
| `src/components/VehicleCard.test.tsx` | 4 | Details and price, purchase callback, **disabled when stock is 0**, low-stock badge |
| `src/components/VehicleForm.test.tsx` | 11 | Validation rules (price ≤ 0, decimals, negative and fractional quantity, required fields); submits trimmed numeric data; edit pre-fill |
| `src/components/VehicleFilters.test.tsx` | 4 | Field changes, reset, disabled reset, inverted price range |
| `src/components/PurchaseDialog.test.tsx` | 4 | Quantity and total, cannot exceed stock, invalid typed quantity, Escape closes |
| `src/pages/LoginPage.test.tsx` | 6 | Login success (token stored, redirect), invalid credentials, client-side password rules, register then auto-login, duplicate email |
| `src/pages/InventoryPage.test.tsx` | 10 | Anonymous redirect, list with disabled sold-out button, empty state, error and retry, search uses the API, purchase updates stock with a toast, 409 shows the error and reloads, customers redirected from `/admin`, admin access, expired token signs out |
| `src/pages/AdminPage.test.tsx` | 4 | Add vehicle (request body checked), API validation error keeps the form open, restock, delete after confirmation |

Frontend tests stub `fetch` at the network boundary, so the real API client, contexts, router and components all run. Real backend integration was verified separately in the browser (see below).

## TDD evidence (backend)

1. Models, schemas, migrations and **all backend tests** were written first, with an app that had no routes. First run: **66 failed, 7 errors, 3 passed**. The 3 passes were 404 tests that pass trivially when no routes exist. The 7 errors were search tests whose fixture needs `POST /api/vehicles`.
2. Implemented `deps.py`, `routers/auth.py`, `routers/vehicles.py` and `main.py`. Rerun: **76 passed**.
3. Code review found new cases. Regression tests were added first: **7 failed, 80 passed** (out-of-range IDs and offsets returned 500). After the fix: **87 passed**. Config tests then brought the total to **90 passed**.

## Mutation checks (do the tests catch real bugs?)

- **Concurrency.** `purchase_vehicle` was temporarily replaced with a naive read, sleep 50 ms, write. Both concurrency tests **failed**: `assert 20 == 5` (20 buyers "succeeded" for 5 cars) and `assert 18 <= 10`. After restoring the atomic `UPDATE … WHERE quantity >= :n`: 2 passed.
- **Sold-out button.** The `disabled` prop was removed from `VehicleCard`. **3 frontend tests failed** (VehicleCard, and two InventoryPage tests). After restoring it: 50 passed.

## Manual end-to-end verification

Performed in the built-in browser against the live stack (uvicorn on :8000, Vite on :5173, PostgreSQL with seed data):

| Scenario | Result |
|---|---|
| Register a new customer through the UI | Account created and auto-signed in |
| Inventory loads 16 seeded vehicles from the database | Pass. Sold-out cards show a disabled "Out of stock" button. |
| Filter make=`toy` with max price 30000 | One debounced request `GET /api/vehicles/search?make=toy&max_price=30000` returned Toyota Camry only |
| Purchase the last BMW M4 | Toast "Purchased 1 × BMW M4.", card switched to Out of stock, row found in `purchases` (qty 1, $79,100) |
| Customer opens `/admin` | Redirected to `/`. Direct `POST /api/vehicles/1/restock` with the customer token returned **403**. |
| Login with a wrong password | "Incorrect email or password" shown |
| Admin login, then reload | Session restored and dashboard stats loaded |
| Admin add vehicle with empty fields or price -5 | Inline validation errors, no request sent |
| Admin add, edit price, restock +5, delete | Each confirmed by toast and table update |
| 375 px viewport, inventory and admin | No horizontal page overflow (`scrollWidth` 375) |
| API probes with curl (`NaN`/`Infinity` prices) | 422 |

## Pending / not performed

- No coverage measurement.
- No load or performance testing beyond the concurrency tests.
- No cross-browser testing (only the Chromium-based built-in browser).
- Deployment is not tested.
