# NaijaShelf

A mobile-first discovery and digital storefront beta for Nigerian small businesses.

## Product direction
Help local businesses become easier to discover and give customers a simple route to contact sellers directly. The beta uses manual merchant onboarding and WhatsApp handoff; it does not yet collect online payments or provide a live merchant database.

## Stack
- React 19 + Vite
- Responsive custom CSS
- Lucide icons
- Vercel deployment
- SEO metadata, Open Graph, JSON-LD, robots.txt and sitemap.xml

## Run locally
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

## Beta limitations before public merchant launch
- Demo directory cards are illustrative, not verified businesses.
- Listing form hands off to WhatsApp; it does not save submissions to a database.
- Pricing is proposed founding-member pricing; payment collection is not enabled.
- Replace demo listing data and update sitemap URLs if the domain changes.
- Add a database, merchant authentication, moderation, real storefront routes and a payment provider before scaling the SaaS.

## Revenue model
Free discovery listing, paid enhanced storefront plans and sponsored placements. Validate willingness to pay with founding sellers before investing in payment automation.

## Firebase backend (initial release)

The web app now saves seller listing requests to the `sellerSubmissions` Firestore collection before opening the WhatsApp follow-up. The Firebase project is **NaijaShelf** (`naijaself`).

### Firebase setup
1. In Firebase Console, open project `naijaself` and create a Cloud Firestore database.
2. Publish the rules in `firestore.rules` (Firebase Console → Firestore Database → Rules).
3. The Firebase web app configuration is initialized in `src/firebase.js`. Browser Firebase config is public; database access is controlled by the Firestore rules.
4. Install dependencies with `npm install`, then run `npm run dev`.

### Collections
- `sellerSubmissions`: public create-only listing requests, default status `pending`; only authenticated users with the Firebase custom claim `admin: true` can read or manage them.
- `businesses`: only approved listings are publicly readable; only admins can create, update or delete listings.

### Admin access
Admin access is intentionally not exposed through a client-side password or public form. Set the Firebase Authentication custom claim `admin: true` for trusted administrator accounts from a secure Admin SDK environment before building the admin dashboard. Never place a service-account private key in this repository or browser app.

### Current scope
This is the first database integration: seller submissions are stored in Firestore. The public directory still contains clearly labelled illustrative examples until real businesses are reviewed and published. Merchant accounts, admin dashboard, image uploads, and subscription payments are separate next milestones.
