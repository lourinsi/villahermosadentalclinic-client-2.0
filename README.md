# Villahermosa Dental Clinic Frontend

The frontend is the staff-facing web application and public informational site for Villahermosa Dental Clinic. It is built with Next.js and deployed to Vercel. The active production workflow is an authenticated workspace for clinic administrators, doctors, and receptionists; the application communicates with the separate Render API for authentication and clinic data.

## Contents

- [Production status](#production-status)
- [Feature status](#feature-status)
- [Technology stack](#technology-stack)
- [Architecture](#architecture)
- [Authentication and protected routes](#authentication-and-protected-routes)
- [Roles and permissions](#roles-and-permissions)
- [API communication](#api-communication)
- [Environment variables](#environment-variables)
- [Local development](#local-development)
- [Package scripts](#package-scripts)
- [Build and deployment](#build-and-deployment)
- [Loading, errors, and backend readiness](#loading-errors-and-backend-readiness)
- [Coding and UI conventions](#coding-and-ui-conventions)
- [Security notes](#security-notes)
- [Troubleshooting](#troubleshooting)
- [Related documentation](#related-documentation)

## Production status

The production frontend is hosted on Vercel and uses the separately deployed Render backend. Staff enter through `/workspace-portal-auth`; the older `/login`, `/admin/login`, and `/receptionist/login` routes redirect to `/`.

The public landing page remains active for clinic information. Public Booking, Patient Portal, and Staff Payroll are **Disabled modules**. In this documentation, _disabled_ means intentionally blocked from active use while related code remains in the repository. It does not mean that the module is merely unfinished.

## Feature status

| Module | Status | Availability | Notes |
| --- | --- | --- | --- |
| Public informational site | Active | Public | Landing page, clinic services, contact details, and other informational content |
| Staff authentication and workspace | Active | Admin, doctor, receptionist | Custom backend JWT session; protected layouts enforce allowed roles |
| Dashboard and reports | Active | Authenticated staff | Role-aware management views and clinic summaries |
| Appointment requests and calendar | Active | Authenticated staff | Appointment review, scheduling, status changes, and history |
| Patient records and dental charts | Active | Authorized staff | Includes patient profiles, dependents, questionnaires, and treatment information |
| Payments and payment methods | Active | Authorized staff | Payment recording and history; subject to backend permission checks |
| Finance and expenses | Active | Authorized staff | Revenue, expense, inventory, and audit-history views; payroll is excluded |
| Inventory | Active | Authorized staff | Inventory records and related finance history |
| Staff directory | Active | Authorized staff | Staff management; compensation, attendance, and staff-financial UI paths are currently disabled |
| Notifications | Active | Authenticated staff | In-application notification list and status updates |
| Services and status configuration | Active | Authorized staff | Appointment types/services and status-driven UI configuration |
| Public Booking | **Disabled** | Not available | Code remains, but public booking routes and navigation are blocked or hidden |
| Patient Portal | **Disabled** | Not available | Code remains, but the patient layout redirects away and is not part of production |
| Staff Payroll | **Disabled** | Not available | Payroll UI and actions are explicitly gated off; related backend and model code remains |

For each Disabled module: **this module still exists in the codebase but is currently disabled and is not part of the active production workflow.** Do not expose its routes, add it to navigation, or re-enable it without reviewing authentication, permissions, database behavior, and current business requirements. Do not delete its existing code unless explicitly requested.

## Technology stack

- Next.js 16 App Router
- React 19
- TypeScript with strict checking
- Tailwind CSS 4
- Radix UI primitives and shared components under `components/ui`
- Lucide icons, Sonner notifications, and Recharts
- React Hook Form and Zod where form validation is required
- Zustand for selected client-side state

The project uses npm and includes `package-lock.json`. Node.js 20 is used by the frontend Dockerfile.

## Architecture

### Important folders and files

| Path | Responsibility |
| --- | --- |
| `app/` | Next.js routes, layouts, route redirects, and route-level pages |
| `app/admin/` | Main management workspace for admin, doctor, and receptionist roles |
| `app/receptionist/` | Receptionist-level workspace; doctors currently use this dashboard path as well |
| `app/patient/` | Disabled Patient Portal code; its layout redirects away from the portal |
| `components/` | Shared feature components, layouts, dialogs, loading states, histories, and forms |
| `components/ui/` | Reusable UI primitives |
| `hooks/useAuth.tsx` | Authentication context, local token restoration, login, verification, and logout |
| `components/ProtectedRoute.tsx` | Highest shared authenticated route boundary and backend-readiness state machine |
| `lib/api.ts` | Backend base-URL normalization and `apiUrl()` helper |
| `lib/auth-headers.ts` | Shared authorization-header construction |
| `lib/backend-readiness.ts` | Deduplicated health checks and startup polling support |
| `lib/auth-redirect.ts` | Login redirect and session-expired message handling |
| `lib/utils.ts` and feature utilities | Shared formatting and UI helpers |
| `public/` | Static images, icons, and other public assets |
| `scripts/run-dev-logger.js` | Development runner used by `npm run dev:log` |
| `Dockerfile` | Node 20 production container build |

`app/layout.tsx` installs the global authentication provider, shared modal providers, admin-view state, the user tour, and the toast container. The authenticated admin and receptionist layouts then wrap their content in `ProtectedRoute`. This is the shared boundary used to prevent feature pages from loading before readiness and authentication are resolved.

Most backend calls use `apiUrl()` plus native `fetch`. There is no universal request client that retries all operations. Preserve that safety property: write operations must not be retried automatically.

## Authentication and protected routes

Authentication is provided by the Render backend, not by an external identity provider.

1. Staff submit credentials at `/workspace-portal-auth`.
2. `POST /api/auth/login` returns a signed JWT and also sets the `authToken` HTTP-only cookie.
3. The frontend stores the returned token in local storage for restoration and sends it in the `Authorization: Bearer ...` header. Requests also use credentials so the cookie can be sent.
4. `useAuth` restores the local session and `ProtectedRoute` performs backend readiness and session validation.
5. `GET /api/auth/verify` validates the token and returns the current staff identity.
6. The authenticated role is mapped to the appropriate workspace.

There is currently **no refresh token and no refresh endpoint**. The JWT is the only token issued by the server. Consequently, the app can retry verification after a temporary backend problem, but it cannot silently renew an actually expired JWT. Definitive `401 Unauthorized` verification is treated as session expiration only after the backend is known to be healthy.

The backend sets the authentication cookie as HTTP-only. In production it uses `Secure` and `SameSite=None` for the cross-site Vercel-to-Render deployment. The local-storage copy is used by the existing frontend architecture; never log it, render it, place it in a URL, or commit it.

### Protected route boundaries

- `app/admin/layout.tsx` permits `admin`, `doctor`, and `receptionist`.
- `app/receptionist/layout.tsx` permits `doctor` and `receptionist`.
- `app/doctor/layout.tsx` redirects to `/receptionist/dashboard`.
- `app/patient/layout.tsx` redirects to `/admin/dashboard`; Patient Portal is disabled.

Public pages do not run the dashboard readiness flow unless they explicitly mount protected content.

## Roles and permissions

The shared role type includes `admin`, `doctor`, `receptionist`, and `patient`, but the active staff workspace is for the first three roles. A patient role and patient-auth code remain because the Patient Portal module still exists, but that portal is disabled.

- **Admin:** full management workspace and the ability to switch to the receptionist-style view.
- **Doctor:** uses the receptionist workspace path and participates in staff-authorized workflows.
- **Receptionist:** uses the receptionist workspace; selected admin navigation, such as the doctor-management view, is hidden in receptionist mode.
- **Patient:** no active portal route in the production frontend.

Frontend visibility is not a security boundary. Backend middleware remains authoritative. Permission enforcement is not identical on every legacy route, so changes must inspect both the frontend guard and the specific backend router before assuming a role can perform an action.

## API communication

Set `NEXT_PUBLIC_API_URL` to the backend origin, without a trailing `/api` segment. Calls use paths such as `apiUrl('/api/auth/verify')`; health checks use `apiUrl('/health')`.

The shared API utilities centralize URL construction and auth headers, while feature components currently perform their own native `fetch` calls. When adding API behavior:

- Reuse `apiUrl()` and the existing auth-header helper.
- Include credentials when the endpoint relies on the cookie.
- Keep request and response contracts synchronized with the backend controller and route.
- Translate expected failures into friendly UI states.
- Do not introduce broad retries. In particular, never automatically retry `POST`, `PUT`, `PATCH`, or `DELETE` requests because a timed-out write may already have succeeded.

## Environment variables

Create `.env.local` for local frontend configuration:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:3001
```

For production, set the same variable in Vercel to the HTTPS Render origin:

```dotenv
NEXT_PUBLIC_API_URL=https://your-render-service.onrender.com
```

`NEXT_PUBLIC_` variables are embedded in browser code. Never place secrets, database credentials, or JWT signing keys in them. Although `lib/api.ts` contains development and production fallbacks, each deployment should set the variable explicitly so preview and production builds target the intended backend.

## Local development

### Prerequisites

- Node.js 20 or a compatible current Node.js release
- npm
- A running backend configured as described in the [backend README](../villahermosadentalclinic-server/README.md)

### Setup

```bash
npm install
```

Create `.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:3001`, then start the development server:

```bash
npm run dev
```

Open `http://localhost:3000`. The staff login is at `http://localhost:3000/workspace-portal-auth`.

The repositories can also be started together with the root `docker-compose.yml`; see the root `LOCAL_HOSTING.md`. Docker Compose publishes the frontend on port 3000 and the API on port 3001.

## Package scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server |
| `npm run dev:log` | Start development through the repository's logging helper |
| `npm run dev:clean` | Remove `.next` and start a clean development server |
| `npm run build` | Create a production build with Turbopack |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |

There is no frontend test script and no named type-check script in `package.json`. Use `npx tsc --noEmit` when a standalone TypeScript check is needed.

## Build and deployment

### Production build

```bash
npm run build
npm run start
```

### Vercel

1. Create a Vercel project with `villahermosa-dental-clinic` as the project root.
2. Use the repository's normal Next.js build (`npm run build`). No custom `vercel.json` is currently required.
3. Set `NEXT_PUBLIC_API_URL` to the Render service's HTTPS origin for each relevant Vercel environment.
4. Add the final Vercel production and preview origins to the backend's `FRONTEND_URL` or `FRONTEND_URLS` CORS configuration.
5. Redeploy after changing `NEXT_PUBLIC_API_URL`, because it is compiled into the browser bundle.

The backend should be deployed and its `/health` endpoint should return `204 No Content` before validating the frontend deployment.

## Loading, errors, and backend readiness

`ProtectedRoute` owns the dashboard startup sequence. Its explicit states are:

```text
checking-session
  -> no local session -> login
  -> apparent session -> checking-backend
checking-backend
  -> healthy -> restoring-session
  -> unreachable -> starting-backend
starting-backend
  -> poll /health approximately every 4 seconds, for up to 90 seconds
  -> healthy -> restoring-session
  -> timeout -> unavailable
restoring-session
  -> verified -> ready
  -> definitive 401 -> session-expired -> login
  -> network or temporary server failure -> unavailable
ready
  -> render protected dashboard children
```

While Render is waking, the dashboard is not mounted and users see a full-page “Starting the clinic server…” screen. Health failures are silent during polling. Polling and in-flight checks are deduplicated, abortable, and cleaned up when the boundary unmounts, including under React Strict Mode.

When the backend becomes healthy, authentication resumes without a full page reload. Therefore, no reload guard is required and no refresh loop is introduced. A manual **Try again** action restarts the readiness flow after the 90-second timeout.

The application distinguishes availability from authentication as follows:

- Network errors, aborts, timeouts, and temporary `5xx` responses do not clear the session.
- A `403` is an authorization result, not automatic evidence that authentication expired.
- A `401` from verification is acted on only after `/health` has confirmed the backend is available.
- Because no refresh mechanism exists, a definitive healthy-backend `401` clears invalid local auth state and redirects to login with a friendly session-expired message.
- Unexpected authentication `5xx` responses show a temporary unavailable state instead of logging the user out.

Feature pages also contain local spinners, empty states, dialogs, and Sonner notifications. Avoid exposing raw fetch errors, status codes, stack traces, or tokens to users.

## Coding and UI conventions

- Use TypeScript and the `@/` import alias already configured by the project.
- Follow the App Router split: route files live under `app/`; reusable feature UI lives under `components/`.
- Add `"use client"` only where browser APIs, state, effects, or event handlers require it.
- Reuse `components/ui`, existing dialogs, tables, cards, loading indicators, and history components before creating alternatives.
- Use Lucide icons and Tailwind responsive breakpoints consistent with surrounding screens.
- Preserve role-based visibility in both desktop and mobile navigation.
- Reuse established date utilities such as `formatDateToYYYYMMDD`, `parseDisplayDate`, and `formatWordyDate` instead of parsing date-only values ad hoc.
- Reuse the peso/currency utilities and `CurrencyAmount` patterns. The application formats Philippine peso values for display.
- Null-value presentation is not globally uniform in existing code. Match the feature's nearby convention and show a readable fallback rather than `null`, `undefined`, or an opaque identifier.
- Prefer a readable patient, staff, service, or payment label when available instead of exposing raw database IDs.

## Security notes

- Do not place secrets in `NEXT_PUBLIC_*` variables.
- Do not log or display JWTs, cookie contents, credentials, or raw server responses containing sensitive data.
- Keep the backend's CORS allowlist aligned with actual Vercel and local origins; credentials require an explicit allowed origin.
- Treat UI role checks as presentation only and preserve backend authorization checks.
- Do not re-enable Disabled modules through a redirect removal or navigation change alone. Their complete authentication, authorization, API exposure, database behavior, privacy implications, and business requirements must be reviewed first.
- Patient and finance data are sensitive. Avoid caching them in new browser persistence unless the task explicitly requires and reviews that behavior.
- Do not automatically retry writes.

## Troubleshooting

### The dashboard says the clinic server is starting

The free Render service may be waking after inactivity. The frontend polls `/health` for up to about 90 seconds and continues automatically. If it reaches the unavailable screen, verify the Render service and database are running, then use **Try again**.

### The app reports a session expiration

The current system has no refresh token. A session-expired redirect means verification returned a definitive `401` after the backend was healthy. Sign in again. If this happens immediately after login, confirm that Vercel targets the correct backend and that `JWT_SECRET` is stable across Render restarts.

### Browser requests fail because of CORS or cookies

Confirm all of the following:

- `NEXT_PUBLIC_API_URL` is the exact Render HTTPS origin.
- The Vercel origin appears in backend `FRONTEND_URL` or `FRONTEND_URLS`.
- Requests that need the cookie use credentials.
- HTTPS is used in production so the secure cross-site cookie can be sent.

### The frontend calls the wrong backend

Update `NEXT_PUBLIC_API_URL` and rebuild/redeploy. Do not include `/api` at the end of the value.

### Build, lint, or types fail

Run the checks separately to identify the layer:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

There is no automated frontend test command in the current package scripts.

## Related documentation

- [Backend README](../villahermosadentalclinic-server/README.md)
- [Repository instructions for coding agents](../CLAUDE.md)
- [Local Docker hosting](../LOCAL_HOSTING.md)
- [Online hosting notes](../ONLINE_HOSTING.md)
