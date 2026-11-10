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