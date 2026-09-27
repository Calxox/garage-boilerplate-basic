# [RAW MVP] Refine prototype and build frontend scaffold/components

Role: UX — Shah Fahad Ali

Implementation date: 26 September 2026

Scope: frontend demo in `frontend/`.

## Usability feedback and priorities

User feedback: make the interface sleeker and more readable, remove clutter, and replace the old generic logo with the supplied HazardWatch logo.

1. Keep a clear page title, primary action and readable content hierarchy. Remove repeated introductory panels and keep the detailed map on its own screen.
2. Use consistent spacing, compact severity badges and one review queue shared between overview and map. Keep uncertainty alongside assessment results.
3. Carry the supplied flame/HW logo into the actual Next.js frontend and preserve the requested 15% enlargement.
4. Keep navigation and forms usable on mobile, tablet and desktop. Preserve the working offline map, filters and demonstration journey.

The implemented interface is the finalized design for this scaffold iteration. No claim of formal stakeholder sign-off or new usability research is made.

## Task checklist

| Item | Status | Evidence |
| --- | --- | --- |
| Review usability feedback | Complete | Direct user feedback recorded above. |
| Prioritise agreed prototype changes | Complete | Readability, reduced repetition and supplied logo prioritized above. |
| Apply required prototype improvements | Complete | Refined React frontend, scoped typography/spacing and consistent screen hierarchy. |
| Finalise MVP interface design | Complete for this iteration | Responsive implementation of the coordinator journey; ready for stakeholder review. |
| Set up frontend project structure | Complete | `src/features/hazardwatch/` and thin App Router entry point. |
| Configure frontend dependencies | Complete | Existing locked Next.js/React/Zod/Lucide/Sonner/Vitest stack installed and reused; no new packages. |
| Create application navigation structure | Complete | Five hash views with accessible navigation, browser history and session state. |
| Develop reusable UI components | Complete | Shared headings, dialog, badges, queue, filters and report preview; reuse existing error/empty states. |
| Develop primary MVP screens | Complete | Overview, hazard map, assessment, reports and assistant. |
| Build input/upload component | Complete | Image validation/decoding, preview, required context, review step and local unassessed submission. |
| Build classification result component | Complete | Sample severity/confidence, source context, uncertainty and reversible review mark. |
| Check basic responsiveness | Complete | Desktop, tablet and mobile browser checks; report table scrolls within its own container. |
| Update master document | Pending document location | Copy-ready entry below; actual master document has not been supplied or modified. |

## Validation

- TypeScript check passed.
- Frontend tests passed: 7 tests across 2 files. The new regression check covers missing-image/blank-location validation, preserved edits, single submission, unassessed output and invalid/future dates.
- Production build passed. The existing static-prototype regression check also passed.
- ESLint: no errors; five native image tags and the static Leaflet stylesheet retain six advisory Next.js warnings. Native images support local blob previews without a server image pipeline.
- Browser checks: navigation, map load/filter/empty state, Wellington place search, classification review, scripted and unsupported questions, sample upload, session report display, reset of review/report/map state and responsive layouts.

## Master-document completion entry

**Done:** Refined the HazardWatch prototype using the agreed feedback by simplifying the interface, improving readability and spacing, and applying the new logo. Built the React frontend structure, navigation, reusable components and primary MVP screens, including image submission and sample classification results. Checked the frontend build, upload flow and basic responsiveness.

**Deliverable:** Working Next.js frontend in `frontend/`, reusable components in `frontend/src/features/hazardwatch/`, upload regression check, and updated frontend run/handoff documentation.

**Note for next role:** Validate the refined interface with stakeholders and connect the scaffold to the agreed upload, classification and assistant services. Current reports and review marks are session-only; classifications and answers are prewritten demo data. Obtain the master-document location and insert this entry before marking that checklist item complete.
