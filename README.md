# PSG Campus Grievance & Sustainability — New Project

A complete Campus Grievance and Sustainability Reporting system for PSG College of Technology.

**This is an entirely new, independent project. It has no connection to any previous application.**

---

## Architecture

```
STUDENT MOBILE APP (React Native + Expo)
         │
         │ HTTPS REST API (JWT)
         ▼
NEW BACKEND (Node.js + Express)  ←── ADMIN WEB UI (React + Vite)
         │                       ←── STAFF WEB UI (same Admin UI, staff role)
         ▼
NEW MONGODB (Atlas — campus_grievance_new)
```

---

## Project Structure

```
campus-grievance-new/
├── backend/          Node.js + Express API
├── mobile/           React Native + Expo student app
└── README.md

campus-sustainability-admin/   Admin & Staff Web UI (teammate's project)
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- MongoDB Atlas account (new cluster)
- Expo CLI: `npm install -g expo-cli`

---

## 1. Backend Setup

```bash
cd campus-grievance-new/backend
npm install
```

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```
PORT=5001
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/campus_grievance_new
JWT_SECRET=<generate a strong 32+ char random string>
JWT_EXPIRES_IN=7d
CAMPUS_LATITUDE=11.0238
CAMPUS_LONGITUDE=77.0066
CAMPUS_RADIUS_METERS=800
LOCATION_MODE=radius
IMAGE_MAX_SIZE_MB=5
ALLOWED_IMAGE_TYPES=image/jpeg,image/png,image/jpg
UPLOAD_STORAGE=local
AI_ENABLED=false
AI_PROVIDER=mock
AI_API_KEY=
FRONTEND_URL=http://localhost:3000,http://localhost:5173
```

Seed the database (run once):

```bash
node src/utils/seed.js
```

This creates:
| Role    | Identifier         | Password   |
|---------|--------------------|------------|
| Student | Roll: `21CS001`    | `student123` |
| Admin   | `admin@psgtech.ac.in` | `admin123` |
| Staff   | `EMP001`–`EMP005` or email | `staff123` |

Start the backend:

```bash
npm run dev      # development (nodemon)
npm start        # production
```

Backend runs on: `http://localhost:5001`

Health check: `GET http://localhost:5001/health`

---

## 2. Mobile App Setup

```bash
cd campus-grievance-new/mobile
npm install
```

Edit `src/constants/config.js` — set `API_BASE_URL` to your backend:

```js
// For physical device testing, use your machine's local IP
export const API_BASE_URL = 'http://192.168.x.x:5001'

// For emulator
export const API_BASE_URL = 'http://10.0.2.2:5001'   // Android emulator
export const API_BASE_URL = 'http://localhost:5001'   // iOS simulator
```

Start the app:

```bash
npx expo start
```

Scan the QR code with Expo Go (Android/iOS) or press `a` for Android emulator / `i` for iOS simulator.

---

## 3. Admin UI Setup

```bash
cd campus-sustainability-admin/campus-sustainability-admin
npm install
```

Copy env file:

```bash
cp .env.example .env
```

Edit `.env`:

```
VITE_API_URL=http://localhost:5001/api
```

Start the admin UI:

```bash
npm run dev
```

Admin UI runs on: `http://localhost:5173`

Login with: `admin@psgtech.ac.in` / `admin123`

Staff login with: `EMP001` or `murugan@psgtech.ac.in` / `staff123`

---

## API Summary

| Category     | Endpoint                                  | Role    |
|--------------|-------------------------------------------|---------|
| Auth         | `POST /api/auth/login`                    | All     |
| Auth         | `GET /api/auth/me`                        | All     |
| Auth         | `POST /api/auth/logout`                   | All     |
| Dashboard    | `GET /api/students/dashboard`             | Student |
| Complaints   | `POST /api/complaints`                    | Student |
| Complaints   | `GET /api/complaints`                     | Student |
| Complaints   | `GET /api/complaints/:id`                 | Student |
| Complaints   | `GET /api/complaints/:id/timeline`        | Student |
| Location     | `POST /api/location/verify`               | Student |
| Image AI     | `POST /api/uploads/validate-image`        | Student |
| Notifications| `GET /api/notifications`                  | All     |
| Notifications| `PATCH /api/notifications/:id/read`       | All     |
| Notifications| `PATCH /api/notifications/read-all`       | All     |
| Events       | `GET /api/events`                         | All     |
| Events       | `GET /api/events/:id`                     | All     |
| Leaderboard  | `GET /api/leaderboard`                    | All     |
| Categories   | `GET /api/categories`                     | All     |
| Admin        | `GET /api/admin/complaints`               | Admin   |
| Admin        | `GET /api/admin/complaints/:id`           | Admin   |
| Admin        | `PATCH /api/admin/complaints/:id/verify`  | Admin   |
| Admin        | `PATCH /api/admin/complaints/:id/reject`  | Admin   |
| Admin        | `PATCH /api/admin/complaints/:id/assign`  | Admin   |
| Admin        | `PATCH /api/admin/complaints/:id/deadline`| Admin   |
| Admin        | `GET /api/admin/staff`                    | Admin   |
| Admin        | `GET /api/admin/analytics`               | Admin   |
| Admin        | `POST /api/admin/events`                  | Admin   |
| Admin        | `PATCH /api/admin/events/:id`             | Admin   |
| Staff        | `GET /api/staff/tasks`                    | Staff   |
| Staff        | `PATCH /api/staff/tasks/:id/status`       | Staff   |
| Staff        | `POST /api/staff/tasks/:id/resolution-proof` | Staff |
| Staff        | `PATCH /api/staff/tasks/:id/unable-to-resolve` | Staff |

---

## Complaint Lifecycle

```
Reported → Verified → Assigned → In Progress → Resolved → Closed
               ↓                      ↓
           Rejected               Overdue → Resolved (late)
                                       ↓
                               Unable to Resolve → Reassigned
```

---

## Campus Location Verification

PSG College of Technology center coordinates:
- Latitude: `11.0238`
- Longitude: `77.0066`
- Radius: `800m` (configurable via `CAMPUS_RADIUS_METERS`)

Change `LOCATION_MODE=polygon` and set `CAMPUS_POLYGON_JSON` for polygon-based geofencing.

---

## Image AI Validation

Currently runs in **mock mode** (`AI_ENABLED=false`).

To enable real AI validation:
1. Set `AI_ENABLED=true`
2. Set `AI_PROVIDER=openai_vision` (or implement another provider)
3. Set `AI_API_KEY=your_key`

The service is pluggable — add new providers in `backend/src/services/imageValidationService.js` without changing any other code.

Confidence levels:
- `HIGH` (≥ 0.70) — proceed normally
- `MEDIUM` (0.40–0.69) — flag for admin review, allow submission
- `LOW` (< 0.40) — warn student, require confirmation

---

## Overdue Handling

A cron job runs every hour and automatically marks complaints as `Overdue` when their assignment deadline passes. Staff can still resolve overdue complaints. Staff must explicitly mark `Unable to Resolve` with a mandatory reason.

---

## Deployment

### Backend — Render

1. Push `campus-grievance-new/backend` to a new GitHub repository
2. Create a new Web Service on [render.com](https://render.com)
3. Set build command: `npm install`
4. Set start command: `node server.js`
5. Add all environment variables from `.env.example`
6. Set `NODE_ENV=production`

### Database — MongoDB Atlas

1. Create a new Atlas cluster (free tier M0)
2. Create a new database user
3. Whitelist `0.0.0.0/0` for Render (or use Render's static IP)
4. Copy the connection string to `MONGODB_URI`
5. Run seed: `node src/utils/seed.js` (once, with production URI)

### Mobile — Expo EAS Build

```bash
npm install -g eas-cli
eas login
eas build --platform android
```

Update `API_BASE_URL` in `src/constants/config.js` to your Render backend URL before building.

### Admin UI — Vercel / Netlify

1. Push `campus-sustainability-admin` to GitHub
2. Deploy on Vercel or Netlify
3. Set environment variable: `VITE_API_URL=https://your-backend.render.com`

---

## Security Notes

- Passwords hashed with bcrypt (12 rounds)
- JWT tokens expire in 7 days (configurable)
- Role-based access control on all protected routes
- Students cannot access `/api/admin/*` or `/api/staff/*`
- Students can only read their own complaints and notifications
- File uploads validated for MIME type, size, and integrity (sharp)
- Filenames replaced with UUIDs — no original filenames exposed
- `helmet()` sets secure HTTP headers
- Rate limiting on auth endpoints (20 req / 15 min)
- CORS restricted to configured origins
- No credentials or secrets in source code

---

## Test Credentials (after seed)

| Role    | Login identifier          | Password   |
|---------|---------------------------|------------|
| Student | Roll Number: `21CS001`    | `student123` |
| Admin   | Email: `admin@psgtech.ac.in` | `admin123` |
| Staff 1 | Code: `EMP001` or `murugan@psgtech.ac.in` | `staff123` |
| Staff 2 | Code: `EMP002` or `latha@psgtech.ac.in`   | `staff123` |
| Staff 3 | Code: `EMP003` or `suresh@psgtech.ac.in`  | `staff123` |
| Staff 4 | Code: `EMP004` or `priya@psgtech.ac.in`   | `staff123` |
| Staff 5 | Code: `EMP005` or `arun@psgtech.ac.in`    | `staff123` |
