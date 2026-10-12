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
STAFF_GPS_MAX_ACCURACY_METERS=250
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

For Expo Go development, the app can discover the backend on the same Wi-Fi
network as the Expo development server. For a shared installable build, the
backend must be deployed at a public HTTPS address. Set
`EXPO_PUBLIC_API_URL` to that address in the mobile EAS build environment.
A private laptop address only works for phones on that same network.

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

All uploaded images (complaint photos, validation photos, and resolution proof)
are limited to 20 KB. Oversized images are rejected by the backend; this limit
is fixed and does not need an environment variable.

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

Deploy in this order so the web admin and APK can be configured with the live API URL.

### 1. Publish the repository

Push the project to a Git provider account connected to Render, Vercel, and Expo EAS.

### 2. Create MongoDB Atlas

1. Create an Atlas project and cluster, then create a database user with access to this app's database.
2. Add the Render service's outbound IP ranges from its Render **Connect → Outbound** panel to the Atlas project IP access list. Do not allow all internet addresses.
3. Copy the Atlas `mongodb+srv://` connection string; it will be used as `MONGODB_URI`.

### 3. Deploy the backend to Render

1. Create a Render Web Service connected to this repository. Set **Root Directory** to `backend`, **Build Command** to `npm install`, and **Start Command** to `npm start`.
2. Set **Health Check Path** to `/health`.
3. Add environment variables from `backend/.env.example`. Set `NODE_ENV=production`, `MONGODB_URI` to the Atlas URI, and `JWT_SECRET` to a newly generated random secret of at least 32 characters. Keep `AI_ENABLED=false` and `AI_PROVIDER=mock` unless a production image-validation provider is configured.
4. Complaint and resolution images are stored on disk. Attach a persistent disk mounted at `/opt/render/project/src/uploads` for the current local upload storage. Render free services have ephemeral filesystems, so uploaded photos would be lost on restart or redeploy without persistent/object storage.
5. Deploy and confirm `https://<your-service>.onrender.com/health` returns `{"status":"ok"...}`. Save the service's HTTPS origin for the next steps.

### 4. Initialize production data

Run `node src/utils/seed.js` once from the `backend` directory with the production `MONGODB_URI` to create the categories and priority rules. The current seed script also creates demo accounts with published default passwords (`admin123`, `student123`, and `staff123`); remove or replace those accounts/passwords before opening the production service to users. Keep the database URI and JWT secret private and never commit `.env` files.

### 5. Deploy the admin web app

1. Create a Vercel project connected to this repository and set its **Root Directory** to `campus-sustainability-admin`.
2. Set `VITE_API_URL=https://<your-service>.onrender.com/api` in the Vercel production environment, then deploy. Vercel detects the Vite build (`npm run build`, output `dist`).
3. Copy the deployed admin site's origin (for example, `https://campus-admin.example.com`) into Render's `FRONTEND_URL` environment variable. Use the origin only, with no `/api` path, then redeploy the backend.

### 6. Build and distribute the Android APK

1. In the Expo EAS project, add `EXPO_PUBLIC_API_URL=https://<your-service>.onrender.com` to the `production` environment.
2. From the `mobile` directory, run:

   ```bash
   npx eas-cli login
   npx eas-cli build --platform android --profile apk --environment production
   ```

3. Download the completed APK from the EAS build page and share it with Android users. It targets Android 6.0 (API 23) and newer. iPhones require a separate iOS build; an APK cannot be installed on iOS.

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
