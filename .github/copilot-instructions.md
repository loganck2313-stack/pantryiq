# PantryIQ Workspace

## Project
- Next.js App Router with TypeScript, React, Tailwind CSS, and OpenNext for Cloudflare Workers.
- Keep the warm editorial kitchen visual system: parchment, charcoal, sage, terracotta, ochre, Playfair Display headings, and Inter UI text.
- Keep browser-only previews clearly distinguished from real integrations. Recipe scraping, Gemini, OCR, UPC lookup, household sync, voice-trigger listening, and wake lock are not configured.

## Commands
- `npm run dev` starts local development.
- `npm run lint` runs ESLint.
- `npm run build` creates the Next.js production build.
- `npm run cf:preview` builds and starts the Wrangler preview.
- `npm run cf:deploy` builds and deploys through OpenNext; verify account bindings before production use.

## Setup Status
- [x] Requirements clarified: Next.js, TypeScript, Tailwind, and Cloudflare Pages compatibility.
- [x] Project initialized in the workspace root with package name `pantryiq`.
- [x] PantryIQ dashboard and responsive local interactions implemented.
- [x] `npm run lint`, `npm run build`, and `npx opennextjs-cloudflare build` pass.
- [x] README includes local development and Cloudflare workflows; no extension recommendations are required.
- [x] No separate VS Code task is needed; scripts are available in `package.json`.
- [x] Dev server started after user confirmation at `http://localhost:3000`.
