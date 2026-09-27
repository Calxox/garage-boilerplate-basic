# HazardWatch frontend

Run from the repository root:

```powershell
pnpm install --frozen-lockfile
pnpm --filter frontend dev --port 3001 --hostname 127.0.0.1
```

Open http://127.0.0.1:3001. This starts the Next.js frontend in `frontend/`. The older standalone `prototype/` served on port 4173 is a separate baseline and does not show these React refinements.

The root HazardWatch demo works without Firebase credentials. The boilerplate's protected routes still require their original backend and environment configuration; use the filtered frontend command above for this demo instead of the repository's environment-syncing `pnpm dev` command.

## Screens and components

`src/app/page.tsx` renders the client workspace in `src/features/hazardwatch/`. Hash navigation preserves session state between Overview, Hazard map, Hazard assessment, Image reports and Ask HazardWatch.

- `components/HazardWorkspace.tsx`: navigation, session state, guided journey and reset.
- `components/Screens.tsx`: overview, reusable review queue and filters, report register and assistant.
- `components/HazardMap.tsx`: React lifecycle around the existing local Leaflet map.
- `components/ImageUpload.tsx`: validated image/context/review flow and session report preview.
- `components/ClassificationResult.tsx`: sample classification, evidence, uncertainty and review mark.
- `components/ui.tsx`: screen heading, severity badge and native accessible dialog.
- `model.ts`: types and context validation, reusing the existing sample data/query rules.
- `hazardwatch.css`: scoped responsive styles. The supplied logo remains 15% larger than its initial replacement size.

Existing shared error and empty-state components, dependencies and local map assets are reused. No new packages are required.

## Demo limits

The five incidents and classifications are fictional, prewritten examples. The reference photograph's actual location and capture time are unverified. Assistant replies use scripted rules, not an AI service. New images stay in browser memory and remain **Unassessed**: there is no remote upload, classification, geocoding of submissions or persistence.

Navigating between screens keeps the current session. Finishing the guided tour only closes the tour. Refreshing the page or confirming **Reset demo** clears reports, review marks and conversation. Reset also restores map/filter state. Stopping the server does not clear an already-open page until it reloads.

## Checks

```powershell
pnpm --filter frontend typecheck
pnpm --filter frontend lint
pnpm --filter frontend test
pnpm --filter frontend build
node prototype/check.cjs
```

The upload regression check is `tests/unit/hazardwatch.test.tsx`. Task checklist, feedback decisions and a master-document entry are in `../docs/ux-ui/raw-mvp-frontend.md`.
