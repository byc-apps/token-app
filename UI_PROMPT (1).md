# UI prompt for Antigravity — BYC ServeQ

Paste everything below the line into a NEW conversation, in Planning mode.

---

You are building the whole frontend for BYC ServeQ, a service token system for CHRIST (Deemed to be University), Yeshwanthpur Campus. The backend is finished. Build the UI on top of it.

The design is **plain and minimal: white page, black text, black buttons, thin grey lines, a little colour only for status.** It must look like a simple, well-made internal tool. It must NOT look like it was made by an AI.

Work in stages. **Stop after each stage** and wait for my approval.

---

## 0. Read first

1. `AGENTS.md`, `CLAUDE.md` (follow them; this Next.js version is new, check its bundled docs before using a Next API you are unsure about).
2. **`API.md` in the repo root.** It is the only truth about the backend: every endpoint, body, response, error and rule. Do not invent endpoints or fields.
3. `api/shared/*` (roles, schemas, ids, queue, slots, tokens, time). Pure TypeScript you can import through the alias `@shared/*` (add `"@shared/*": ["./api/shared/*"]` to `tsconfig.json`).
4. Existing frontend: `src/lib/api-client.ts` (`apiFetch`), `src/context/auth-context.tsx`, `src/lib/firebase/*`, `src/components/ui/*`, `package.json`, `eslint.config.mjs`.
5. **Ignore `DESIGN_SYSTEM.md`.** It is for a different look (navy and gold). The design rules in this prompt replace it. Replace the existing `src/components/ui/*` styling to match these rules.

## 1. Hard rules

- **Frontend only.** Work in `src/`, `public/`, `tsconfig.json`, `eslint.config.mjs`, `package.json`. Never edit `api/`, `firestore.rules`, `firestore.indexes.json`, `vercel.json`, `.env*`.
- **The browser never touches Firestore.** The Firebase client is for Google sign-in only. All data comes from `/api/*` through `apiFetch`.
- **The server decides.** Roles and permissions come from `GET /api/me`. UI checks only hide things; the API enforces. Never guess a role from an email address.
- **Imports from the backend folder:** only `@shared/*`. Never import `api/lib`, `api/services`, `api/middleware`, `api/routes`, `api/app` or `firebase-admin`. Add an ESLint `no-restricted-imports` rule for this.
- Use the shared Zod schemas and helpers (`@shared/schemas`, `@shared/ids`, `@shared/slots`, `@shared/queue`, `@shared/time`, `@shared/roles`) for forms and calculations so the UI and API cannot disagree.
- **No mock data**, except on `/styleguide`.
- **If the API cannot do something the UI needs, STOP and tell me.** Do not work around it.
- Allowed new packages: `@tanstack/react-query`, and Radix primitives for accessibility (`@radix-ui/react-dialog`, `-tabs`, `-select`, `-switch`, `-checkbox`, `-radio-group`, `-dropdown-menu`, `-toast` or `sonner`). Ask before adding anything else.
- Do not touch `src/lib/validations/token.ts` or `tests/auth-and-zod.test.ts` (old code).
- At the end of every stage: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all pass. No `any`, no unused code, no console errors. Commit and tag `ui-stage-N`.

## 2. Look and feel (follow exactly)

**Colours** (define once as CSS variables in `globals.css`; no other colours anywhere)

| Use | Value |
|---|---|
| Page | `#ffffff` |
| Text | `#0a0a0a` |
| Muted text | `#525252` |
| Border | `#e5e5e5` |
| Light fill (hover, table header) | `#fafafa` |
| Primary button | black background, white text |
| Green (confirmed, success) | `#15803d` |
| Amber (waiting, warning) | `#b45309` |
| Red (cancelled, no-show, errors, delete) | `#b91c1c` |

Status colour is used **only** on a small badge: a 6px dot plus the text label in the same colour, no background fill. The label always says the status in words, so the page still reads in black and white. Completed, checked-in and other neutral states use grey.

**Type and space**
- Font: Inter (via `next/font`). Token numbers and IDs: system monospace with tabular numbers.
- Sizes: body 14px on admin pages and 16px on student pages and all inputs (stops phone zoom). Page title 24px semibold. Section title 16px semibold. Nothing larger except the token number on the token page and the display screen.
- Spacing: multiples of 4px. Content width 720px on student pages, 1100px on admin pages. Plenty of white space.
- Corners: 6px on buttons, inputs, boxes. Nothing rounder. No pill buttons.
- Borders: 1px solid `#e5e5e5`. **No shadows anywhere.** Dialogs are a bordered white box over a 40% black backdrop.
- Buttons: primary (black), secondary (white, grey border), ghost (text only), danger (white, red border and text). Height 36px on admin pages, 44px on student pages. Focus: 2px black outline, 2px offset.
- Tables: header row on `#fafafa`, 1px row lines, no zebra stripes, no cards-in-cards.
- Icons: only small functional ones from lucide (16px, thin): chevron, close, check, search, menu, sign-out. **No icon next to headings, no icons in coloured circles.**
- Motion: none, except a 150ms fade for dialogs and toasts.
- Dark mode: not now.

**It must NOT look AI-made. Banned:**
gradients, glass or blur effects, shadows, big rounded corners, pill shapes, emoji, illustrations, hero banners, decorative icons, stat cards with big icons, colourful dashboards, purple/indigo/blue-violet colours, centred marketing layouts, animated skeleton shimmer (use plain light-grey blocks), greetings like "Welcome back!", exclamation marks, "Oops", "Let's get started", placeholder lorem text.

**Copy:** short, plain, sentence case. Say what happened: "Token cancelled." Show API error `message` exactly as sent. Show `requestId` in small grey text on 500 errors. Empty state: one line and the next action. Buttons say what they do: "Book token", "Call next", "Save".

**Formats:** dates `16 Nov 2026`; times 12-hour `10:30 am`; always India time; token numbers monospace (`ITS-014`). Put the formatting helpers in one file (`src/lib/format.ts`) and unit-test them.

## 3. Structure (so it can grow without a rewrite)

```
src/
  app/                    routes only. Each page file is a thin wrapper (under ~60 lines)
    (public)/login/
    (app)/                shared layout: top bar, auth guard, role guard
      page.tsx, book/, tokens/[id]/, profile/, complete-profile/
      console/[centreId]/ (page, display/)
      centres/[centreId]/ (setup/, staff/, reports/)
      admin/ (users/, centres/, settings/, reports/, logs/)
  features/<name>/        auth, tokens, booking, queue, centres, setup, staff, users, settings, reports, logs
    api.ts                one typed function per endpoint, uses apiFetch. The ONLY place that calls the API
    keys.ts + hooks.ts    react-query keys and hooks
    types.ts              response types written from API.md
    components/           UI for this feature
    index.ts              what other code may import
  components/ui/          base pieces (see list below)
  components/layout/      top bar, page header, tab bar, centre switcher
  config/nav.ts           ONE list: label, path, who can see it. Adding a page = a route + one line here
  config/routes.ts        typed path builders (routes.token(id), routes.console(centreId) …)
  lib/                    api-client, format, can() (wraps @shared/roles), cn, labels (status and role names)
```

Rules: no `fetch` outside `features/*/api.ts`. Features do not import each other's inner files, only `index.ts`. Query keys come from `keys.ts`; mutations invalidate by key. Server data lives in react-query, not in `useState`. Forms use the `@shared` schemas. Every list has loading, empty and error states from the shared components.

**Base components** (`components/ui`): Button, Input, Textarea, Select, Checkbox, Switch, RadioGroup, FormField (label, hint, error), Badge, StatusBadge, RoleBadge, Table, Tabs, Dialog, ConfirmDialog, SidePanel, Toast, Skeleton, EmptyState, ErrorState (message, retry, requestId), LoadMore, PageHeader, Box (plain bordered container), TokenNumber, DateStrip, SlotGrid, Stars, CentrePicker. Show each one, in each state, at 390px and 1280px, on `/styleguide`.

## 4. Who sees what

| Role | Top bar menu |
|---|---|
| `student_faculty` | Home, Book, Profile |
| `centre_staff` | Console, Profile |
| `centre_admin` | Console, Setup, Staff, Reports, Profile (plus a centre switcher if they have more than one centre; start on `primaryCentreId`) |
| `campus_authority`, `app_admin` | Users, Centres, Settings, Reports, Logs, Profile |

Admins open a centre's Console, Setup and Staff from the Centres page. Confidential centres show a small "Confidential" tag. If the API answers `FORBIDDEN` for a confidential centre's details, show: "Only staff of this centre can see this."

**Sign-in flow:** Google sign-in, then `POST /auth/login`, then `GET /me`. Not signed in goes to `/login`. A student or faculty member with `profileComplete: false` goes to `/complete-profile`. After sign-in: student to Home, staff and Centre Admin to their console, admins to Users.
**Error codes:** `INVALID_TOKEN`/`UNAUTHENTICATED` sign out and go to login; `NOT_REGISTERED` call `/auth/login` once and retry; `ACCOUNT_DISABLED` sign out and show the message on the login page; `PROFILE_INCOMPLETE` go to the profile page; `VALIDATION_ERROR` show errors on the fields (`details[].path`); everything else show the message.

## 5. Pages and behaviour

**Login.** Name, one line, one "Sign in with Google" button, a note "Use your CHRIST University email."

**Complete profile.** Account type (Student, Faculty or staff), then Register No. or Employee ID (label and format hint follow the type, live check with `checkId` and `GET /settings`), department (from `GET /departments`; empty list: "No departments yet. Ask the App Admin."), mobile. Show `ID_ALREADY_LINKED` clearly. Banner (not forced) for other roles.

**Profile.** Locked fields read-only with "Contact the App Admin to change"; mobile editable; two switches for reminder and feedback emails.

**Home (student).** If profile incomplete, a banner. Upcoming token (if any) with number, centre, date, slot, status, link to detail. "Book token" button. Past tokens list with "Load more".

**Book.** One page, four steps shown in a simple list:
1. Centre: list with search. Department desks are grouped under "Department"; the user's own department is first.
2. Service: radio list; "Other" with a text box only if `allowOther`.
3. Date and slot: `DateStrip` from today to `booking.windowDays` ahead (`GET /settings`); closed days greyed. `SlotGrid` from `GET /centres/:id/slots`: available, "2 left", full, blocked and past are shown and the last three are disabled.
4. Confirm: summary and a "Confirm booking" button.
On `SLOT_FULL` refresh the slots and say so; on `ALREADY_BOOKED` show the message with a link to the existing token.

**Token detail.** Token number large and monospace, status badge, centre, service, date and slot. A plain list of times (booked, checked in, called, completed). When checked in: "Place in line 3, expected about 11:12 am" and "Now serving ITS-012" (poll every 20 s, pause when the tab is hidden). Buttons shown only when allowed by the API flags: "Check in", "Cancel token" (with confirm and the cancel rule in words), "Rate this visit" (1 to 5 buttons and an optional comment).

**Console** (`/console/[centreId]`), two tabs:
- *Queue.* Counter picker (remember the last one in localStorage). One big "Call next" button. For each serving token: number, person name and service (joined from today's token list), buttons Close, Move to counter, Add note. Waiting list: number, minutes waiting, "walk-in" tag, expected time. "Add walk-in" dialog with two tabs: CHRIST user (Register No. or Employee ID + service) and Visitor (name, mobile, category, optional email, service). "Open display" button opens the display page in a new window. Poll the queue every 20 s with `If-None-Match`; on 304 do nothing; update expected times every second in the browser with `estimateTimes`. Send each queue update to the display window with `BroadcastChannel`.
- *Today's tokens.* Table with filter by status and a date picker. Row actions by status: Check in (confirmed); Approve and Reject (requested; only if the user can manage tokens); Change slot or service and Cancel (only if the user can manage tokens). Staff without that permission see only Check in and Add note.

**Display** (`/console/[centreId]/display`). Full screen, white, very large black type. Left: "Now serving" token numbers with counter names. Right: "Upcoming" token numbers with expected times if `showExpectedTimes`. Bottom: today's slot strip and the announcement. Gets its data from the console through `BroadcastChannel`; if nothing arrives for 30 s it polls `GET /centres/:id/display` every 20 s. A small "Enable sound" button (browsers need a click) and a chime when a new token is called if `chime` is on. `mode: "neutral"` shows only the message and no numbers. No login chrome, no menu.

**Setup** (`/centres/[centreId]/setup`), tabs: Services and Counters (list, add, rename, switch on/off); Hours (one row per weekday: closed toggle, open, close, lunch start and end, blocked slots; validate with the schema); Holidays and slots (pick a date, see its slots, close the day, block or unblock slots, add a note; show the API's conflict message when bookings exist); Queue and display (all `config` fields, labelled in plain words, with the default shown as a hint).

**Staff** (`/centres/[centreId]/staff`). Staff table, add by email with a role picker (Centre Admin option only for admins), remove with confirm, and "Waiting for first sign-in" list.

**Reports** (`/centres/[centreId]/reports` and `/admin/reports`). Date range (default last 7 days), centre picker for admins. A table per centre and totals; per service and per day tables when present; ratings. "Download CSV" for the table shown (plain client-side, no library). Second tab for Feedback comments with "Load more". No charts.

**Users** (`/admin/users`). Tabs: All, Unverified, Disabled, Waiting for first sign-in. Email search (disables the filters), role and status filters, "Load more". Edit in a side panel with only the fields the API accepts; send only changed fields. Disable and enable with confirm ("signs the person out now"). "Add person" dialog (pre-register). Hide or disable impossible actions (own row, App Admin role for non-App-Admins, per API.md).

**Centres** (`/admin/centres`). Tabs Centres and Departments. Table, add dialog, edit, switch on/off, "Confidential" tag, code is shown but not editable after creation. Department add dialog has the optional secretary email and shows what happened ("Secretary added" or "Saved. They get access on first sign-in"). Row links: Console, Setup, Staff.

**Settings** (`/admin/settings`). ID formats for Register No. and Employee ID (with a live example) and booking rules (days ahead, cancel minutes, no-show minutes), saved with `PATCH /settings`.

**Logs** (`/admin/logs`). Tabs Audit (one filter at a time: centre, person or action; "Load more") and Emails (status filter, "Resend" on a row).

## 6. Stages. Stop after each one.

1. **Foundation.** Packages, tokens in `globals.css`, base components and `/styleguide`, folder structure, `nav.ts`, `routes.ts`, `lib/*`, API layer skeleton, auth context rebuilt (Google sign-in, `/auth/login`, `/me`), route and role guards, top bar, Login, Complete profile, Profile.
2. **Student.** Home, Book, Token detail.
3. **Admin.** Users, Centres and Departments, Settings, Logs.
4. **Centre.** Console (Queue and Today's tokens), Display, Setup, Staff, Reports and Feedback, admin Reports.
5. **Polish.** Loading, empty and error state check on every page; keyboard walk-through; 390px, 768px and 1280px pass; remove unused code; write `src/README.md` (structure and how to add a page in 3 steps).

**At each stop, give me:** screenshots at 390px and 1280px of every new page (including one empty and one error state), the list of new files, and the four commands passing. If you had to deviate from this prompt, say where and why.

If anything here conflicts with `API.md` or `AGENTS.md`, stop and ask. Do not guess.
