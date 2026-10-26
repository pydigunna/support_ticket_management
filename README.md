# Support Ticket Management & Analytics System

A full-stack ticket management application built with React, Vite, Node.js, Express, MongoDB, Mongoose, and Recharts. The additional challenge implemented is the **activity timeline**, which records every status change with the previous status, new status, timestamp, and the person who changed it.

## Links

| Item | URL |
|---|---|
| GitHub repository | https://github.com/pydigunna/support_ticket_management.git |
| Project explanation video (Google Drive) | https://drive.google.com/file/d/1ovAe9A5WE-PkFMY3Mp2bgjpxckRoU2CN/view?usp=sharing |

### Demo credentials

| Role | Email | Password |
|---|---|---|
| Admin | admin@gmail.com | Admin@123 |
| Agent | ramesh@gmail.com | ramesh@123 |
| User | mabbu@gmail.com | mabbu@123 |


## Features

- Register and log in as a standard user; agents are created by admins; admins use a pre-created admin account.
- Role-based permissions enforced by the backend (the UI only hides buttons for convenience).
- Create, view, edit, assign, update status, and delete tickets according to role permissions.
- Ticket fields: title, description, priority, status, category, creator, assignee, creation/update timestamps, and status history.
- Server-side search, combined filters (status, priority, category, assignee, creator), sorting, and pagination.
- Backend-calculated dashboard metrics (total, open, resolved, critical) and status/priority charts, filterable by date range.
- Activity timeline of status changes for every ticket.
- Responsive layout with loading, empty, success, and error states.
- Centralized API error handling, input validation, and automated backend integration tests.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, React Router, Recharts, Oxlint |
| Backend | Node.js, Express 5, Mongoose, JSON Web Tokens, bcryptjs, CORS, dotenv |
| Database | MongoDB |
| Tests | Node's built-in test runner (`node:test`) with Supertest |

## Project structure

```text
support_ticket_system/
├── backend/
│   ├── src/
│   │   ├── server.js            # connects to MongoDB, then starts Express
│   │   ├── app.js               # middleware, routes, 404 and central error handler
│   │   ├── createAdmin.js       # one-time script to create the first admin
│   │   ├── config/db.js         # MongoDB connection
│   │   ├── models/              # User.js, Ticket.js (statusHistory embedded)
│   │   ├── middleware/          # authMiddleware.js (protect, authorize)
│   │   ├── routes/              # auth, tickets, users, analytics
│   │   └── controllers/         # auth, ticket, user, analytics logic
│   └── tests/ticket.test.js     # 21 integration tests
└── frontend/
    └── src/
        ├── main.jsx, App.jsx    # router, auth state, route guards, 404 page
        ├── services/api.js      # single request wrapper for all API calls
        ├── pages/               # Dashboard, Tickets, Login, Admin
        └── components/          # Navbar, TicketTable, TicketForm
```

## Roles and permissions

- **User (`employee` role):** Register, log in, view tickets and history, create tickets, edit and delete only tickets they created.
- **Agent:** Log in with credentials created by an admin; view tickets and history; edit details and change status only on tickets assigned to their account. Agents cannot delete tickets or reassign them.
- **Admin:** Create/deactivate agents, edit any ticket, assign/reassign tickets, update any ticket's status, and delete any ticket.
- Ticket lists, ticket details/history, dashboard analytics, and the safe active-agent-name list are readable without logging in. Creating or changing tickets requires authentication.
- Public registration always creates a standard user. It cannot create an agent or admin.
- A ticket stores `createdByUserId` and `assigneeUserId` references to user records. The display names are also stored for convenient display and filtering. Legacy tickets without owner references can only be deleted by an admin.
- Deactivated agents are rejected immediately, even if their token has not expired, because the authentication middleware checks the user record on every request.

## Requirements

- Node.js 20.19+ (use a current LTS release)
- npm
- MongoDB Community Server running locally, or a MongoDB connection string (for example MongoDB Atlas)

## 1. Configure the backend

Open a terminal in the `backend` folder:

```powershell
npm install
Copy-Item .env.example .env
```

Edit `backend/.env`:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/support_ticket_db
JWT_SECRET="pydigunnaseera"
```

| Variable | Purpose |
|---|---|
| `PORT` | Port the API listens on (default `5000`) |
| `MONGO_URI` | MongoDB connection string. The database is created automatically on first write |
| `JWT_SECRET` | Secret used to sign login tokens. Use a long random value |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Only for the one-time admin creation script below |

Keep `.env` private. It is excluded by `.gitignore` and must never be committed.

### Create the initial admin account (fresh database only)

If your database already has an admin account, keep using it. Otherwise, temporarily add these variables to `backend/.env`:

```env
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=use-a-strong-password-at-least-8-characters
```

Run this once from the `backend` folder:

```powershell
node src/createAdmin.js
```

Remove `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env` after the account is created. The script refuses to run if an admin already exists.

Start the backend:

```powershell
npm run dev
```

The server should report that MongoDB connected and that it is listening on port `5000`. Opening `http://localhost:5000/` returns a JSON health message.

## 2. Configure and start the frontend

Open a second terminal in the `frontend` folder:

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | API base URL, including `/api`. Default: `http://localhost:5000/api` |

Open the local URL printed by Vite, usually `http://localhost:5173`. Users only open the frontend URL. The frontend calls the backend in the background.


### Frontend routes

| Path | Page |
|---|---|
| `/` | Dashboard (analytics and charts) |
| `/tickets` | Ticket list, filters, create and edit |
| `/login` | Login and registration |
| `/admin` | Admin panel (admins only; others are redirected to login) |
| anything else | 404 page |

## 3. Create and test the roles

1. Open **User / Agent / Admin Login**.
2. Choose **Register** to create a standard user account.
3. Sign in with your admin account.
4. Open **Admin Panel** and create an agent with a name, email, and password of at least 8 characters.
5. Sign out and log in using the agent credentials.
6. As admin, assign a ticket to the agent. The agent can then update that ticket's status, subject to the allowed transitions.

## API reference

All API responses are JSON. Authenticated requests use `Authorization: Bearer <token>`. Tokens expire after one hour.

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register a standard user |
| `POST` | `/api/auth/login` | Public | Log in as user, agent, or admin |
| `GET` | `/api/tickets` | Public | Search, filter, sort, and paginate tickets |
| `GET` | `/api/tickets/:id` | Public | Read a ticket and its status history |
| `POST` | `/api/tickets` | User, agent, admin | Create a ticket owned by the signed-in account |
| `PATCH` | `/api/tickets/:id` | Owner user, assigned agent, admin | Edit title, description, priority, and category. Only an admin may also set `assigneeUserId` to assign or reassign |
| `PATCH` | `/api/tickets/:id/status` | Agent, admin | Change status; agents must be assigned to the ticket |
| `DELETE` | `/api/tickets/:id` | Owner user, admin | Delete own ticket, or any ticket as admin |
| `GET` | `/api/analytics?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` | Public | Backend-calculated dashboard metrics and chart data |
| `GET` | `/api/users/agents/list` | Public | Safe list of active agent IDs and names for filters |
| `GET` | `/api/users?role=agent` | Admin | List active agents including email for management |
| `POST` | `/api/users/agents` | Admin | Create an agent account |
| `PATCH` | `/api/users/agents/:id/deactivate` | Admin | Deactivate an agent account |

### Ticket fields

| Field | Rules |
|---|---|
| `title` | Required, up to 150 characters |
| `description` | Required, up to 5000 characters |
| `priority` | `Low`, `Medium` (default), `High`, `Critical` |
| `status` | `Open` (default), `In Progress`, `Resolved`, `Closed` |
| `category` | Required, up to 100 characters. The UI offers: Technical, Account, Billing, Payment, Profile, Hardware, Software, Network, Other |

### Ticket-list query parameters

- `page` (positive integer), `limit` (1–100)
- `sortBy`: `createdAt`, `updatedAt`, `title`, `priority`, or `status`
- `order`: `asc` or `desc`
- `search`: matches title and description (case-insensitive, special characters are escaped)
- `status`, `priority`, `category`, `assignee`, and `createdBy`

Filters can be combined and work together with pagination: changing any filter returns to page 1, and the total page count is computed from the filtered result. Invalid status/priority filters and invalid pagination or sorting parameters return `400 Bad Request`.

### Status transitions

- `Open` → `In Progress` or `Closed`
- `In Progress` → `Open`, `Resolved`, or `Closed`
- `Resolved` → `In Progress` or `Closed`
- `Closed` is terminal

The backend validates transitions and records each accepted change in `statusHistory`. The UI shows only the valid next statuses.

### HTTP status codes

| Code | Used for |
|---|---|
| `200` / `201` | Success / resource created |
| `400` | Validation failure, invalid filter, invalid status transition, malformed JSON, invalid ID format |
| `401` | Missing, invalid, or expired token; inactive user; wrong login |
| `403` | Authenticated but not allowed (wrong role, or not the owner/assigned agent) |
| `404` | Ticket not found, or unknown route |
| `500` | Unexpected server error (details are logged on the server only) |

## 4. Automated backend tests

Make sure MongoDB is running, then run from `backend`:

```powershell
npm test
```

There are **21 integration tests** (all passing at submission time). They use a separate database named `support_ticket_test_db`, clear their collections between tests, and drop that test database when they finish. **Never point the test URI at a production database.**

The suite covers required-field validation, invalid IDs, invalid status transitions and filters, pagination, combined filtering, search, status history recording, analytics and date filtering, login and registration, ownership-based deletion, agent permissions, assignment to active agents, and the active-agent list.

## 5. Additional challenge: activity timeline

**What it does:** every accepted status change is stored on the ticket with the previous status, new status, timestamp, and the changer's name. The **View History** action in the ticket table shows these records newest-first, together with the current status.

**Implementation decisions:**

- `statusHistory` is an **embedded array** in each ticket document, not a separate collection. A ticket and its history are read in one query, and history can never exist without its ticket.
- The history entry is pushed in the same `save()` as the status change, so a status can never change without being recorded.
- The transition rules live on the server. The UI mirrors them only to offer valid options.
- The changer's name is stored with each entry, so history stays readable even if the user is later deactivated.

## 6. Frontend state management

State is kept local to each page, with no global store. This keeps the app simple, and each screen owns its own data and loading behavior.

- **`useReducer`** is used where one event changes several related values at once, so those updates happen in one step:
  - `Tickets.jsx` has four reducers: filters (search, filters, sort, page), the ticket list (data, loading, load error), UI state (create form, edit modal, messages), and agents.
  - `Admin.jsx`, `Login.jsx`, and `Dashboard.jsx` each use one reducer for their loading, error, and data state.
- **`useState` with one object** is used for plain forms (`TicketForm`, the add-agent form, the dashboard date range), with a single `handleChange` that reads the input's `name`.
- **Avoiding unnecessary API calls:** search is debounced by 300 ms; the agent list is loaded once; every filter change resets to page 1 so the list is requested only once for each change.
- **Updates without a reload:** after create, edit, assign, status change, or delete, the ticket list is re-fetched and the UI updates in place.
- **Failures:** every request is wrapped in `try/catch` and shows the server's message, with a Retry button for list failures.
- **Authentication state** lives in `App.jsx`, initialized lazily from `sessionStorage`, and is passed to pages as props. Route guards redirect non-admins away from `/admin`.

## AI-assisted development disclosure

**Tools used:** ChatGPT and Claude (Anthropic).

**What was delegated:**

- Reviewing the assignment requirements against the code and finding gaps.
- Drafting and troubleshooting backend validation, role-based permissions, the status-transition rules, and the activity timeline.
- Drafting the integration tests and this documentation.
- Refactoring frontend state management to `useReducer` and object-based `useState`.
- Writing the stylesheet polish (layout, status badges, timeline styling).
- Explaining the code file by file to prepare the project walkthrough.

**How the output was validated:**

- Ran the 21 backend integration tests against a local MongoDB; all pass.
- Manually exercised the API error cases (unknown route, malformed JSON, invalid ID, missing token) and checked the responses and status codes.
- Manually tested the UI after the state refactor and the styling changes.
- Read through the permission checks, status-transition logic, and data model so I can explain and modify them.

Generated code was treated as a draft: it was run, tested, and reviewed before being kept.

## Known limitations and trade-offs

- The activity timeline records **status changes only**. Edits to ticket details and assignment changes are not logged.
- The app stores JWTs in `sessionStorage`. For production, consider HttpOnly cookies, CSRF protection where relevant, rate limiting, and a token refresh/revocation strategy.
- Ticket lists, ticket history, dashboard analytics, and the active agent names endpoint are public in this demo. Restrict them if the deployment requires private ticket data.
- CORS is open to all origins (`cors()` with defaults). Restrict it to the frontend URL in production.
- Input validation is hand-written in the controllers and Mongoose schemas, rather than using a validation library.
- The ticket retains the assignee's display name as well as the agent reference so older records and simple text filters remain readable. Legacy records without `assigneeUserId` use a display-name fallback for agent status checks. The assignee filter matches by name.
- Sorting by `priority` or `status` is alphabetical (the values are stored as text), not by severity or workflow order.
- Category is free text on the backend (up to 100 characters); the allowed list is enforced only by the UI form.
- The dashboard end date is extended to the end of that day in UTC, which can differ slightly from the local day.
- The production bundle is about 670 kB because of Recharts; route-level code splitting was not added.
- The free-tier backend host may have a slow first request after being idle.
- Backend integration tests require a running MongoDB instance. Frontend automated tests are not included; the frontend was verified with linting, a production build, and manual testing.
