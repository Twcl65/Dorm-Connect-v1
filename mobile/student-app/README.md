# DormConnect Mobile (Expo)

Unified React Native app for **Student** and **Landlord** accounts. Uses the same Next.js API as the web app with **Bearer token** authentication.

After sign-in, the app opens the UI for your role:

| Role | Tabs |
|------|------|
| Student / Tenant | Home, Browse, Reservations, Payments, Incidents, More |
| Landlord | Home, Reservations, Payments, Incidents, Announcements, More |
| OSA Staff | Dashboard, Inspections, Accreditation, Tenants |

## Prerequisites

- Node.js 18+
- [Expo Go](https://expo.dev/go) on your phone (**SDK 54** — matches this project), or Android/iOS simulator
- Dorm Connect web server running (`npm run dev` in repo root)

## Setup

```bash
cd mobile/student-app
cp .env.example .env
npm install
```

Edit `.env`:

```env
# Local dev — physical device: use your PC's LAN IP, e.g. http://192.168.1.10:3000
EXPO_PUBLIC_API_URL=http://localhost:3000
```

| Environment | API URL |
|-------------|---------|
| iOS Simulator | `http://localhost:3000` |
| Android Emulator | `http://10.0.2.2:3000` |
| Physical device | `http://YOUR_PC_LAN_IP:3000` |

Ensure `AUTH_SECRET` is set in the **root** `.env` (same as web).

## Run

```bash
npm start
```

Press `a` (Android) or `i` (iOS), or scan the QR code with Expo Go.

Browse uses **Leaflet + OpenStreetMap** (same as the website). No Google Maps API key is required.

## Features

- Sign in as a Student / Tenant, Landlord, or OSA Staff user
- Register as a student or submit a landlord account for ICT approval
- Student dashboard, accredited listing browse, reservations, payments,
  incident reports, announcements, reviews, top-reviewed and nearest-to-USTP
  discovery, and account settings
- Landlord dashboard, reservations, payments, incidents, announcements,
  properties, rooms, tenants, student reviews, reports, accreditation documents,
  accreditation renewals and document resubmission, property terms, financial
  reports, activity logs, and account settings
- OSA Staff inspection dashboard, accreditation monitoring, and tenant monitoring

## API endpoints used

- `POST /api/auth/mobile/login`
- `GET /api/auth/me`
- `GET /api/student/overview`
- `GET /api/student/listings`
- `POST /api/student/reservations`
- `GET /api/student/reservations`
- `GET /api/student/payments`
- `GET /api/student/announcements`
- `GET /api/landlord/reviews`
- Landlord screens use the corresponding `/api/landlord/*` endpoints.
