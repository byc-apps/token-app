# BYC ServeQ – API

Everything the backend does. Base path: `/api`. All data is JSON.

## 1. Basics

**Sign-in.** The browser signs in with Google (Firebase). Every request then sends the Firebase ID token:

```
Authorization: Bearer <id token>
```

Only `GET /api/health` and `/api/jobs/tick` work without it. The server checks the token every time: signature, expiry, revoked or not, Google sign-in, verified email, CHRIST domain. Then it loads the user from Firestore and checks the account is active. The role always comes from Firestore, never from the browser.

**Formats**

| Thing | Format |
|---|---|
| Date | `YYYY-MM-DD` (India date) |
| Slot / time | `HH:mm`, 24 hour, India time. A slot is 30 minutes, e.g. `10:00` means 10:00–10:30 |
| Times in responses | milliseconds since 1970 (`checkedInAt`, `serverTime`, `expectedAt`, …) |
| IDs | strings |

**Errors.** Every error looks like this:

```json
{ "error": { "code": "SLOT_FULL", "message": "This slot is full. Please choose another.",
             "requestId": "…", "details": [{ "path": "date", "message": "…" }] } }
```

`details` only appears for `VALIDATION_ERROR`. Show `message` to the user. Unknown fields in a request body are rejected.

| Code | Status | Meaning |
|---|---|---|
| UNAUTHENTICATED | 401 | No token sent |
| INVALID_TOKEN | 401 | Token wrong, expired or revoked. Sign in again |
| EMAIL_NOT_VERIFIED / DOMAIN_NOT_ALLOWED | 403 | Not a verified CHRIST email |
| NOT_REGISTERED | 403 | Call `POST /auth/login` first |
| ACCOUNT_DISABLED | 403 | An admin disabled the account |
| FORBIDDEN | 403 | Your role cannot do this |
| PROFILE_INCOMPLETE | 403 | Complete the profile before booking |
| BAD_REQUEST / VALIDATION_ERROR | 400 | Wrong input |
| NOT_FOUND | 404 | Does not exist (or is not yours) |
| CONFLICT | 409 | Not allowed in the current state |
| SLOT_FULL | 409 | Slot has no seats left |
| ALREADY_BOOKED | 409 | You already hold a token at that centre for that day |
| COUNTER_BUSY | 409 | That counter is serving a token |
| ID_ALREADY_LINKED | 409 | Register No. / Employee ID already belongs to another account |
| PAYLOAD_TOO_LARGE | 413 | Body over 64 KB |
| JOBS_DISABLED | 503 | `CRON_SECRET` not set |
| INTERNAL_ERROR | 500 | Server problem. Quote `requestId` |

**Roles**

| Role | Can do |
|---|---|
| `app_admin` | Everything. Only this role can grant, remove or disable App Admin |
| `campus_authority` | Same as App Admin except anything about the App Admin role |
| `centre_admin` | Own centres: setup, staff, tokens, reports |
| `centre_staff` | Own centres: check in, serve, walk-ins, notes |
| `student_faculty` | Book, view, cancel and rate own tokens |

**Confidential centres** (Health, Counselor, CAPS have `confidential: true`). App Admin and Campus Authority see only totals there: no names, no token lists, no comments, no per-service numbers. Only people assigned to that centre can see details. Emails for these centres never name the service.

A person has one role for all their centres.

---

## 2. Health

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/health` | anyone | `{ "status": "ok" }` |

## 3. Sign-in, profile, settings

| Method | Path | Who | Body / result |
|---|---|---|---|
| POST | `/auth/login` | signed in | No body. Creates the user on first sign-in. → `{ user, created }` |
| GET | `/me` | active user | → `{ user }` |
| PUT | `/me/profile` | active user | `{ userType: "student"\|"faculty", id, departmentId, mobile }` → `{ user }` |
| PATCH | `/me/mobile` | active user | `{ mobile }` → `{ user }` |
| PATCH | `/me/email-prefs` | active user | `{ reminders?, feedbackRequests? }` → `{ user }` |
| GET | `/settings` | active user | → `{ idFormats, booking }` |
| PATCH | `/settings` | admins | `{ idFormats?: { student?, faculty? }, booking?: { windowDays?, cancelBeforeMinutes?, noShowGraceMinutes? } }` → settings |

**user** (own): `uid, email, name, role, userType, regNo, empId, departmentId, mobile, centreIds[], primaryCentreId, status, profileComplete, emailPrefs { reminders, feedbackRequests }`

- `faculty` means faculty or staff (uses an Employee ID).
- New users start unverified and as `student_faculty`. Emails in `BOOTSTRAP_ADMIN_EMAILS` become App Admin on their first sign-in. Admin-added people (see §6) get their prepared role.
- **Locked after the first save:** type, ID, department. Only an admin can change them. Mobile stays editable.
- One ID belongs to one account (`ID_ALREADY_LINKED`).

**idFormats** `{ student: Fmt, faculty: Fmt }`, `Fmt = { charset: "digits"|"alphanumeric", minLength, maxLength }`. Defaults: Register No. = 7 digits; Employee ID = 3–6 letters or digits. IDs are saved in capitals.

**booking** defaults: `windowDays: 7`, `cancelBeforeMinutes: 60`, `noShowGraceMinutes: 15`. Changing a rule does not change tokens that already exist.

## 4. Centres and departments

A department desk is a centre with `kind: "department"`, id `dep-<code>` and token prefix `DEP-<CODE>`. Normal centres have id = lower-case code and prefix = code.

| Method | Path | Who | Body / result |
|---|---|---|---|
| GET | `/centres` | active user | → `{ centres }`. Admins get full centres (incl. inactive); everyone else gets the public view |
| GET | `/centres/:id` | active user | → `{ centre }` |
| POST | `/centres` | admins | `{ code (2–5 capitals), name, confidential?, location? }` → `{ centre }` (201) |
| PATCH | `/centres/:id` | admins | `{ name?, confidential?, location?, active? }` |
| GET | `/departments` | active user | → `{ departments: [{ id, name, code, tokenPrefix, active? }] }` |
| POST | `/departments` | admins | `{ code (2–8 capitals/digits), name, secretaryEmail? }` → `{ department, secretary }` (201). The secretary becomes Centre Admin of the desk |
| PATCH | `/departments/:id` | admins | `{ name?, active? }` |

The code can never be changed (it is the token prefix and the id). Centres are switched off, never deleted.

**Public centre:** `id, name, code, kind, tokenPrefix, location, confidential, allowOther, services[{ id, name }]` (active services only).
**Full centre (admins):** the above plus `active`, `config`, `services[{ id, name, active }]`, `counters[{ id, name, active }]`.

## 5. Centre setup (Centre Admin for own centres, admins for all)

| Method | Path | Body / result |
|---|---|---|
| GET | `/centres/:id/config` | → `{ config, services, counters }` |
| PATCH | `/centres/:id/config` | any of the fields below → `{ config }` |
| POST | `/centres/:id/services` | `{ name }` → `{ item }` (201) |
| PATCH | `/centres/:id/services/:itemId` | `{ name?, active? }` → `{ item }` |
| POST | `/centres/:id/counters` | `{ name }` → `{ item }` (201) |
| PATCH | `/centres/:id/counters/:itemId` | `{ name?, active? }` → `{ item }`. A counter that is serving cannot be switched off |
| GET | `/centres/:id/slots?date=YYYY-MM-DD` | Any signed-in user. → slots (below) |
| PUT | `/centres/:id/slot-days/:date` | `{ closed?, blocked?: ["10:00"], note? }` → slots. Holiday or "no service" slots for one date |

**config**

| Field | Default | Meaning |
|---|---|---|
| `slotCapacity` | 6 | Tokens per slot |
| `autoConfirm` | true | false = bookings wait for approval (`REQUESTED`) |
| `maxActivePerDay` | 1 | Active tokens one person may hold at this centre per day |
| `allowOther` | true | "Other" with free text |
| `minutesPerToken` | 5 | Used for expected times |
| `adaptiveEstimate` | false | After 10 finished tokens today, use today's real average |
| `upcomingCount` | 5 | "Upcoming" tokens on the display |
| `showExpectedTimes` | true | Show expected times on the display |
| `announcement` | "" | Text on the display (max 300) |
| `chime` | true | Chime when a token is called |
| `displayMode` | `tokens` | `neutral` hides token numbers (used for Counselor and CAPS) |
| `hours` | see below | Opening hours per weekday |

**hours**: `{ mon, tue, wed, thu, fri, sat, sun }`, each `null` (closed) or `{ open, close, lunchStart, lunchEnd, blocked: ["12:00"] }`. `open`/`close` on `:00` or `:30`. `blocked` = slots that are never bookable on that weekday. Default: Mon–Fri 08:30–16:30 with lunch 13:30–14:30 (14 slots), Saturday 08:30–13:00 (9 slots), Sunday closed. A change to hours does not touch existing tokens.

**Slots response**

```json
{ "centreId": "its", "date": "2026-11-16", "capacity": 6, "closed": false, "note": null,
  "slots": [ { "start": "08:30", "end": "09:00", "booked": 2, "remaining": 4, "state": "available" } ] }
```

`state` is `available`, `few` (2 or fewer left), `full`, `blocked` or `past`. Students can ask for today up to `windowDays` ahead. You cannot block a slot or close a day that already has bookings (cancel or move them first).

## 6. Users (App Admin, Campus Authority)

| Method | Path | Body / result |
|---|---|---|
| GET | `/users` | `?q=<email start>` or `?role=&status=&verified=true\|false`, plus `limit` (1–100) and `cursor`. Search cannot be combined with filters. → `{ users, nextCursor }` |
| GET | `/users/preregistered` | → `{ preregistered }` (people added but not signed in yet) |
| POST | `/users/preregister` | `{ email, name?, role?, userType?, regNo?, empId?, departmentId?, mobile?, centreIds?, primaryCentreId? }` (201) |
| GET | `/users/:uid` | → `{ user }` |
| PATCH | `/users/:uid` | any of `name, role, status, verified, userType, regNo, empId, departmentId, mobile, centreIds, primaryCentreId` → `{ user }` |

**admin user:** `uid, email, name, role, status, verified, userType, centreIds, primaryCentreId, regNo, empId, departmentId, mobile`.

Rules: nobody changes their own role or disables themselves; only App Admin touches the App Admin role; the last active App Admin cannot be demoted or disabled; Centre Admin and Centre Staff need at least one centre, everyone else none (leaving a centre role clears the centres); disabling a user signs them out immediately.

## 7. Centre staff (Centre Admin for own centres, admins for all)

| Method | Path | Body / result |
|---|---|---|
| GET | `/centres/:id/staff` | → `{ staff: [{ uid, email, name, role, status, isPrimary }], pending: [{ email, role }] }` |
| POST | `/centres/:id/staff` | `{ email, role?: "centre_staff"\|"centre_admin" }` → `{ added }` (201). A Centre Admin can only add `centre_staff` |
| DELETE | `/centres/:id/staff/:uid` | Remove a person from the centre |
| DELETE | `/centres/:id/pending/:email` | Remove someone who has not signed in yet (URL-encode the email) |

## 8. Booking (students and faculty)

| Method | Path | Body / result |
|---|---|---|
| POST | `/tokens` | `{ centreId, serviceId \| otherText, date, slot }` → `{ token }` (201) |
| GET | `/me/tokens` | `?limit&cursor` newest first → `{ tokens, nextCursor }` |
| GET | `/me/tokens/:id` | → `{ token, queue, serverTime }` |
| POST | `/me/tokens/:id/cancel` | → `{ cancelled: true }` |
| POST | `/me/tokens/:id/check-in` | → `{ token }` |
| POST | `/me/tokens/:id/feedback` | `{ rating: 1–5, comment? }` → `{ saved: true }` (201) |

Booking rules (the server checks all of them in one transaction, so 20 people can click at once and exactly the free seats are given out):

- Profile must be complete.
- Date: today up to `windowDays` (7) ahead. The slot must not have started, must exist for that day, must not be blocked or closed, and must have a free seat.
- One active token per person per centre per day (`maxActivePerDay`).
- Status starts as `CONFIRMED` (or `REQUESTED` when the centre needs approval).
- Token number: prefix + per-day counter, e.g. `ITS-014`.
- **Cancel:** up to 60 minutes before the slot. **No rescheduling** by students.
- **Check in yourself:** from 15 minutes before the slot until the grace time (15 min) after it starts. Otherwise the centre staff check you in.
- **No-show:** a confirmed token not checked in 15 minutes after the slot starts counts as `NO_SHOW` (shown immediately, recorded by the job).
- **Feedback:** once, after `COMPLETED`. Stored with no name and no token id.

**student token view:** `id, number, centreId, centreName, serviceName, otherText, date, slot, slotEnd, status, createdAt, checkedInAt, calledAt, completedAt, counterName, cancelReason, canCancel, canCheckIn, canGiveFeedback`

`queue` (only when you are checked in today): `{ position, expectedAt, inMinutes, nowServing: ["ITS-012"] }`, else `null`.

**Status:** `REQUESTED → CONFIRMED → CHECKED_IN → IN_SERVICE → COMPLETED`. Other endings: `CANCELLED`, `NO_SHOW`, `REJECTED`.

## 9. Token management (Centre Admin, admins)

| Method | Path | Who | Body / result |
|---|---|---|---|
| GET | `/centres/:id/tokens` | staff | `?date=YYYY-MM-DD&status=` → `{ tokens }` (staff view) |
| POST | `/tokens/:id/approve` | `tokens:manage` | Only `REQUESTED` |
| POST | `/tokens/:id/reject` | `tokens:manage` | `{ reason }` |
| POST | `/tokens/:id/cancel` | `tokens:manage` | `{ reason? }`. Works until the token is being served |
| PATCH | `/tokens/:id` | `tokens:manage` | `{ date?, slot?, serviceId \| otherText }` → `{ token }`. New slot must be free and in the future |

The person gets an email for each of these.

**staff token view:** `id, number, kind ("booked"|"walkin"), centreId, person { name, type, id, mobile, email, category }, serviceId, serviceName, otherText, date, slot, status, storedStatus, createdAt, checkedInAt, calledAt, completedAt, counterId, counterName, servedBy, notes [{ at, by, text }], cancelledBy, cancelReason`

## 10. Queue, serving, walk-ins, display (staff of the centre; admins for non-confidential centres)

| Method | Path | Body / result |
|---|---|---|
| POST | `/tokens/:id/check-in` | Marks the person as arrived. Today's tokens only |
| GET | `/centres/:id/queue` | Live queue (below). Supports `If-None-Match` → `304` when nothing changed |
| POST | `/centres/:id/queue/call-next` | `{ counterId }` → `{ token, message }`. `token` is `null` when nobody is waiting |
| POST | `/tokens/:id/close` | Finish the token being served |
| POST | `/tokens/:id/transfer` | `{ counterId }` Move the token being served to another free counter |
| POST | `/tokens/:id/notes` | `{ text }` Note about what was done (max 50 notes) |
| POST | `/centres/:id/walkins` | See below (201) |
| GET | `/centres/:id/display` | Data for the display screen |

**Walk-in body**

```json
{ "kind": "christ", "id": "2543101", "serviceId": "…" }
{ "kind": "visitor", "name": "…", "mobile": "…", "category": "parent|guest|alumni|vendor|other",
  "email": "…", "otherText": "…" }
```

A `christ` walk-in is found by Register No. / Employee ID (the person must have signed up; otherwise use `visitor`). Walk-ins are for today and join the queue straight away.

**Queue order.** Booked people whose slot has started go first (earliest slot, then earliest arrival). Everyone else (walk-ins, early arrivals) follows in arrival order. Only checked-in people are in the queue. Each call-next is one transaction, so two counters never take the same token.

**Queue response**

```json
{ "serverTime": 0, "date": "2026-11-16", "version": 42,
  "centre": { "id": "its", "name": "IT Services", "confidential": false },
  "counters": [{ "id": "c1", "name": "Counter 1", "active": true }],
  "serving": [{ "tokenId": "…", "tokenNumber": "ITS-012", "counterId": "c1", "counterName": "Counter 1", "calledAt": 0 }],
  "waiting": [{ "tokenId": "…", "tokenNumber": "ITS-013", "checkedInAt": 0, "slotStart": 0, "walkIn": false }],
  "completedToday": 7, "minutesPerToken": 5,
  "estimates": [{ "tokenId": "…", "tokenNumber": "ITS-013", "expectedAt": 0, "inMinutes": 2 }],
  "settings": { "minutesPerToken": 5, "adaptiveEstimate": false, "upcomingCount": 5,
                "showExpectedTimes": true, "announcement": "", "chime": true, "displayMode": "tokens" } }
```

No names or services in the queue, only token numbers. Poll about every 20 seconds with `If-None-Match`. The browser can recompute `estimates` every second from `serving[].calledAt` using `estimateTimes()` in `api/shared/queue.ts`.

**Expected times.** Time left for a token being served = minutes per token minus minutes already spent (never below 1). Each waiting token goes to the counter that frees up first, and that counter is busy for one more `minutesPerToken`. With `adaptiveEstimate` on, after 10 finished tokens today the real average replaces `minutesPerToken`.

**Display response** (`mode: "tokens"`)

```json
{ "mode": "tokens", "serverTime": 0, "version": 42, "centre": { "name": "…", "location": null },
  "serving": [{ "tokenNumber": "ITS-012", "counterName": "Counter 1", "calledAt": 0 }],
  "upcoming": [{ "tokenNumber": "ITS-013", "expectedAt": 0 }],
  "slots": { "closed": false, "items": [{ "start": "08:30", "state": "past", "label": "08:30-09:00" }] },
  "announcement": "", "chime": true, "minutesPerToken": 5, "showExpectedTimes": true, "message": null }
```

With `displayMode: "neutral"` the response has `mode: "neutral"`, `message: "Please be seated. You will be called."`, and empty `serving` and `upcoming`.

## 11. Feedback, reports, audit, email

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/centres/:id/feedback` | `reports:centre` | `?limit&cursor` → `{ feedback: [{ date, rating, comment }], nextCursor }`. Confidential: only that centre's staff |
| GET | `/reports/summary` | admins; Centre Admin (own centres) | `?from=&to=&centreId=` (max 62 days) |
| GET | `/me/activity` | staff | `?from=&to=` tokens I served |
| GET | `/audit-logs` | admins | One filter: `centreId`, `actorUid` or `action`; `limit`, `cursor`. Newest first |
| GET | `/email-log` | admins | `?status=queued\|sending\|sent\|failed&limit&cursor` |
| POST | `/email-log/:id/resend` | admins | Queue it again |

**Report summary**

```json
{ "from": "…", "to": "…", "truncated": false,
  "centres": [ { "centreId": "its", "name": "…", "confidential": false, "kind": "centre",
      "total": 0, "booked": 0, "walkIns": 0, "completed": 0, "noShow": 0, "cancelled": 0,
      "noShowRate": 0, "avgWaitMinutes": 0, "avgServiceMinutes": 0, "byStatus": {},
      "byService": [{ "name": "…", "count": 0 }], "byDay": [{ "date": "…", "total": 0, "completed": 0 }],
      "rating": { "average": 4.5, "count": 12 } } ],
  "totals": { "…": "same numbers, all centres together" } }
```

`byService` and `byDay` are left out for confidential centres unless you work there. Wait time = check-in to call; service time = call to close.

**Emails (12):** welcome, booking confirmed, booking received (needs approval), approved, rejected, cancelled (by you, by the centre, or not approved in time), changed by the centre, reminder (60 minutes before), no-show, walk-in recorded, feedback request, daily summary for Centre Admins (after 17:00). Confirmations and cancellations are always sent; reminders and feedback requests can be switched off with `PATCH /me/email-prefs`. An email problem never blocks a booking. Failed emails retry after 5 min, 15 min, 1 h, 6 h, 24 h, then show as `failed` in the log.

## 12. Jobs

| Method | Path | Who |
|---|---|---|
| GET or POST | `/jobs/tick` | Secret: header `x-cron-secret: <CRON_SECRET>` or `Authorization: Bearer <CRON_SECRET>` |

One call does everything and is safe to repeat: records no-shows (and cancels unapproved requests), queues 60-minute reminders, queues the daily summary after 17:00, and sends queued emails. Call it **every 5 minutes**.

---

## 13. Setup

**Install**

```
npm i nodemailer
npm i -D @types/nodemailer
```

Add to `package.json` scripts:

```
"test:emulator": "tsx --test tests-emulator/*.test.ts"
```

**Environment variables** (server only; never `NEXT_PUBLIC_`)

| Name | Needed | Notes |
|---|---|---|
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | yes | Service account |
| `ALLOWED_EMAIL_DOMAIN` | no | Default `christuniversity.in` |
| `BOOTSTRAP_ADMIN_EMAILS` | first run | Comma list; become App Admin on first sign-in |
| `CRON_SECRET` | yes for jobs | At least 16 characters |
| `APP_URL` | yes | Your live address, used in emails |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` (`true`/`false`), `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | for email | Without `SMTP_HOST` and `MAIL_FROM` emails stay queued |

**Firestore.** `firebase.json` must point to the indexes file:

```json
"firestore": { "rules": "firestore.rules", "indexes": "firestore.indexes.json" }
```

Deploy rules and indexes: `firebase deploy --only firestore:rules,firestore:indexes`. Indexes take a few minutes to build; list queries fail until they are ready. The rules deny everything: the browser never touches Firestore.

**Jobs every 5 minutes.** Either:
- Google Cloud Scheduler: HTTP job, `POST https://<your-domain>/api/jobs/tick`, header `x-cron-secret`, schedule `*/5 * * * *`; or
- Vercel Cron (needs a plan that allows 5-minute jobs): add to `vercel.json` `"crons": [{ "path": "/api/jobs/tick", "schedule": "*/5 * * * *" }]`. Vercel sends `Authorization: Bearer <CRON_SECRET>` by itself.

**Rate limits.** Add a Vercel Firewall rate-limit rule for `POST /api/tokens`, `POST /api/auth/login` and `/api/centres/*/walkins`. Serverless instances do not share memory, so limits inside the code would not work.

**First run**

1. `npx tsx scripts/seed-centres.ts` (creates the centres, one counter each; Counselor and CAPS use the neutral display).
2. Sign in with a `BOOTSTRAP_ADMIN_EMAILS` address.
3. Add departments (`POST /departments`), then services for each centre (`POST /centres/:id/services`), and check opening hours (`GET /centres/:id/config`).
4. Add Centre Admins (`POST /centres/:id/staff` with `role: "centre_admin"`).

**Tests.** `npm test` needs no database. The emulator test (20 people booking one slot, same-person double booking, parallel walk-ins, two counters calling at once) runs with:

```
firebase emulators:exec --only firestore --project demo-token "npm run test:emulator"
```

**Old code to remove.** The first version let the browser write to Firestore. The new API replaces it. When nothing imports them any more (check with `grep -r "validations/token" src`), delete `src/lib/validations/token.ts` and `tests/auth-and-zod.test.ts`.

## 14. Not built

- Pausing booking after repeated no-shows (decision still open).
- Different minutes per service (one `minutesPerToken` per centre).
- Per-centre roles ("admin here, staff there"): a role applies to all of a person's centres.
- Push updates: screens poll; there is no live socket.
- Rescheduling by students (not allowed by design).
