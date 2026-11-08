# PantryIQ

PantryIQ is a responsive recipe-box and kitchen dashboard built with Next.js, TypeScript, and Tailwind CSS. Its local preview includes recipe search and dietary filters, a pantry list, pantry-aware grocery additions, aisle grouping, a dinner idea rotator, light/dark mode, a cooking-mode walkthrough with device speech, and preview flows for recipe import, receipt scanning, and companion pairing.

External recipe parsing, Gemini extraction, receipt OCR, barcode lookup, live household sync, voice-trigger listening, and wake lock are not connected in this starter. The preview labels these flows honestly; connect secure services before using them with real accounts or inventory.

## Local development

For a framework-free browser preview, open `pantryiq.html` directly. Its interactions run locally; remote fonts and recipe photography require an internet connection.

```bash
npm install
npm run dev
```

Open the local URL printed by Next.js. Use `npm run lint` and `npm run build` for checks.

## Cloudflare

The project includes OpenNext Cloudflare and Wrangler configuration. After authenticating Wrangler and reviewing the deployment settings, use:

```bash
npm run cf:preview
npm run cf:deploy
```

Cloudflare deployment behavior should be verified against the account's bindings and the current OpenNext adapter requirements before production use.