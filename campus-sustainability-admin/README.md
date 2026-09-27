# Campus Grievance Admin and Staff Portal

This shared React/Vite portal serves the administrator and maintenance-staff roles. It uses the NEW backend at `http://localhost:5001/api`.

## Run locally

```bash
npm install
npm run dev
```

Vite serves the portal on `http://localhost:5173`. The backend must be started first from `../backend` with `npm run dev`.

## Supported functions

- Admin: complaint verification, rejection, skill- and availability-matched assignment, deadline extension, complaint history, resolution proof viewing, notifications, and awareness-event publishing/cancellation.
- Staff: profile name/phone/skills/availability, task progress, multipart resolution-proof upload, unable-to-resolve reporting, and notifications.

Accounts are provisioned by the seed script or an administrator; public registration is intentionally unavailable.
