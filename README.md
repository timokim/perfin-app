# Outlay

Personal spending tracker: import bank/credit-card CSVs, normalize them into a common schema, assign categories you define, and see where money went.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Firebase Auth (email/password + Google)
- Cloud Firestore
- Deploy target: Vercel

## Quick start

### 1. Create a Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com/) and create a project.
2. **Authentication** → Sign-in method → enable **Email/Password** and **Google**.
3. **Firestore Database** → Create database (start in production mode is fine; we ship rules).
4. Project settings → Your apps → Add a **Web** app → copy the config values.

### 2. Deploy security rules

In the Firebase Console → Firestore → Rules, paste the contents of [`firestore.rules`](./firestore.rules) and publish.

Or with the Firebase CLI:

```bash
firebase deploy --only firestore:rules
```

### 3. Configure the app

```bash
cp .env.example .env.local
```

These values come from the Firebase web app config you created in step 1:

1. Open [Firebase Console](https://console.firebase.google.com/) → select your project.
2. Click the gear icon next to **Project overview** → **Settings**.
3. In the General tab, scroll down to **Your apps**. If you do not have a web app yet, click **Add app** → **Web** (`</>`), register it (nickname is enough; hosting is optional).
4. Under that app, open the **SDK setup and configuration** panel and choose **Config** (not npm). You will see an object like:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "...",
  appId: "1:...:web:...",
};
```

Map those fields into `.env.local`:

| `.env.local` variable | Firebase config field |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `apiKey` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `projectId` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `appId` |

Example:

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
```

These are client-side Firebase web config values (safe to expose in the browser). Access control still comes from Auth + Firestore security rules.
### 4. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Deploy to Vercel

1. Push this repo to GitHub.
2. Import the project in Vercel.
3. Add the same `NEXT_PUBLIC_FIREBASE_*` env vars.
4. Deploy.

Authorized domains: in Firebase Auth → Settings → Authorized domains, add your Vercel domain (and `localhost` for local).

## How to use

1. **Sign up / sign in**
2. **Settings** — create accounts (Amex, TD Chequing, …) and categories (Food, Home, …). Defaults for categories are seeded on first login.
3. **Import** — drop a CSV. Outlay infers date / description / amount columns; confirm the mapping and pick the account.
4. **Transactions** — assign categories inline or multi-select for bulk assign. Filter to uncategorized to clear the backlog.
5. **Dashboard** — monthly income, expenses, and spend-by-category.

## Data model

Per-user Firestore paths:

```
users/{uid}/accounts/{id}
users/{uid}/categories/{id}
users/{uid}/imports/{id}
users/{uid}/transactions/{id}
```

Normalized transaction fields: `date`, `description`, `income`, `expense`, `accountId`, `categoryId`, `importId`, `fingerprint`.

Duplicates across re-imports are skipped via fingerprint (`date|netAmount|description|accountId`).

## CSV column inference

Headers and sample values are scored to detect:

- Date (`date`, `transaction date`, `posted`, …)
- Description (`description`, `memo`, `payee`, …)
- Amount as signed single column, expense-only (typical credit cards), debit/credit pair, or income/expense pair

You always confirm the mapping before import.

## Scripts

| Command        | Description              |
|----------------|--------------------------|
| `npm run dev`  | Local development server |
| `npm run build`| Production build         |
| `npm run start`| Serve production build   |
| `npm run lint` | ESLint                   |
