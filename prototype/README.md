# HazardWatch - Digital MVP Prototype

Task: **[DESIGN & BOOTSTRAP] Produce Digital MVP Prototype : 240**  
Delivered: **14 September 2026**  
Image, offline map and verification updated: **16 September 2026**

This is a responsive, interactive design prototype for bushfire situational awareness. It contains fictional demonstration data and no working backend.

## Why this prototype looks different from the earlier Figma designs

Task 1 was implemented with a new visual design instead of extending the existing Figma prototypes. I took this step because I took a more minimalist, clean looking design that is easier to follow.

The resulting differences include:

- **Colours:** the earlier designs use navy, white and orange accents, with blue primary actions in the login design. This prototype introduces a darker green surface and actions.
- **Typography and components:** text sizes, spacing, borders, corner shapes and button styling were changed and made more appealing.
- **Navigation and screen structure:** the dashboard layout and navigation were rearranged, and the natural-language interaction was moved from the dashboard query area into a separate assistant view. It looks more professinal this way. 

The correct approach was to preserve the existing visual language and screen structure while making the flows interactive. Using the Figma as a base and making changes was the correct approach through itteration this does reflect a technical limitation.

## Open the prototype

Open **index.html** in Chrome or Edge. No installation, account, API key or internet connection is required.

For a local browser preview, run this from the repository root:

~~~powershell
python -m http.server 4173 --bind 127.0.0.1 --directory prototype
~~~

Then open [the local prototype](http://127.0.0.1:4173/). The HTTP server only serves static files.

## Task 1 delivery

| Checklist item | Status | Delivered interaction |
| --- | --- | --- |
| Main dashboard designed | Verified | Four sample metrics, regional situation, linked priority queue and featured evidence |
| Hazard map view designed | Verified | Australia/New Zealand coverage, 39,576 searchable places, pan/zoom, named-area and coordinate selection, numbered demo reports, severity filters and empty states |
| Image-upload flow designed | Verified | Choose or drop an image, add location, source, capture time and notes, review, confirm a local report |
| Hazard and severity views designed | Verified | Evidence, sample classification, confidence, estimated area, rationale, uncertainty and reversible review mark |
| Natural-language interaction flow designed | Verified | Suggested and typed questions, prewritten explanations, source links, severity-filter results and unsupported-query guidance |
| Main user journey demonstrated | Verified | Five-step guided walkthrough plus the walkthrough below |
| Prototype contains no working backend functionality | Verified | Static HTML, CSS and JavaScript, all interactions are in memory |
| Update Master Document | Deferred by user | Deliberately left to the user, as requested. No Master Document was created or modified. |

The seven active prototype criteria are demonstrated in the interactions and real page captures below. The Master Document item remains with the user. The earlier Figma appearance is still a separate documented limitation.

Task 2 acceptance criteria and QA planning are outside this delivery.

## Demonstrate the main user journey

Choose **Walk through the journey** in the desktop sidebar, or **Tour** in the top bar on tablet and mobile.

1. **Overview:** scan the five sample locations and two High-severity locations.
2. **Hazard map:** start with both countries. Use **Find an area** to search Sydney, Wellington or a region, then select a result. Drag, zoom, click a named place or click any point to select coordinates. Choose **Blue Mountains** to see all five demo reports, choose High and select Katoomba ridge to read its priority explanation. **Both countries** restores the wider map. The separate report filter searches the demo records.
3. **Inspect evidence:** open Katoomba's assessment. Review the image, severity, supporting reports and uncertainty. Choose **Mark as reviewed**, the dashboard count and map review mark update.
4. **Ask HazardWatch:** ask **Why is Katoomba ranked first?** Follow the source link to its assessment. Try **Compare Katoomba and Wentworth Falls**, or **Show high-severity locations** and open the filtered map.
5. **Image reports:** choose **Submit an image**, then **Use example image**. Enter **Katoomba lookout, NSW**, retain the sample capture time, and optionally add field notes. Review and choose **Add demo report**. Open the report register to see **DEMO-001**, marked **Unassessed**.

The sample assessment button after submission opens the existing Katoomba example. It does not imply that the submitted image has been analysed. New submissions do not create hazard-map markers because the prototype does not geocode or classify images.

Use **Reset demo** to restore the original scenario. Refreshing also clears reports, review marks and conversation.

## Screenshots

All 15 PNGs below were retaken directly from the running local webpages with Chromium’s page screenshot API on 16 September 2026. They capture the actual rendered webpages. The [capture manifest](screenshots/capture-manifest.json) records each page URL, viewport, capture time and file hash.

| View | Capture |
| --- | --- |
| Dashboard - desktop | [Overview](screenshots/hazardwatch-desktop.png) |
| Hazard map | [Map and linked priority queue](screenshots/hazardwatch-map.png) |
| New Zealand coverage | [Country view](screenshots/hazardwatch-map-new-zealand.png) |
| Area selection | [Wellington search and selection](screenshots/hazardwatch-map-area-selection.png) |
| Hazard assessment | [Evidence, severity and uncertainty](screenshots/hazardwatch-assessment.png) |
| Image reports | [Report register](screenshots/hazardwatch-reports.png) |
| Upload - choose image | [Step 1](screenshots/hazardwatch-upload-choose.png) |
| Upload - add context | [Step 2](screenshots/hazardwatch-upload-context.png) |
| Upload - review | [Step 3](screenshots/hazardwatch-upload.png) |
| Upload - confirmation | [Confirmation](screenshots/hazardwatch-upload-success.png) |
| Natural-language interaction | [Explanation and source link](screenshots/hazardwatch-assistant.png) |
| Dashboard - tablet | [834-pixel layout](screenshots/hazardwatch-tablet.png) |
| Dashboard - mobile | [390-pixel layout](screenshots/hazardwatch-mobile.png) |
| Mobile image submission | [Context form](screenshots/hazardwatch-mobile-upload.png) |
| Mobile confirmation | [Successful demo submission](screenshots/hazardwatch-mobile-success.png) |

## Prototype boundaries

- The Blue Mountains snapshot is fictional and fixed at **14 September 2026**. The map covers Australia and New Zealand. the five fictional hazard reports remain in the Blue Mountains. Exploring another area does not invent hazard reports.
- Severity, confidence, affected-area estimates and ranking are prewritten demonstration values. They are not measured results or an approved operational rubric.
- The map is entirely local. Bundled country outlines and a place catalogue support panning, zooming and selection. There are no online tiles, geocoding calls, street-address lookup, live hazards, routing or device geolocation.
- The reference photograph is cropped from the user-supplied Label Studio webpage screenshot. Its actual location, capture time and incident extent are unverified. Katoomba and all assessment values remain fictional demo context. Other locations intentionally show an explicit missing-image state.
- JPG, PNG and WebP files up to 10 MB can be previewed locally. Unsupported formats, empty or oversized files, corrupt images, missing locations and future capture times have recovery states.
- The natural-language flow uses a small deterministic keyword matcher, not an LLM. It supports sample priority explanations, the Katoomba/Wentworth comparison, High/Moderate/Low severity results, smoke reports and snapshot recency.
- No authentication, Firebase, database, external API, actual upload, image analysis, persistent storage, live monitoring, notifications or dispatch functions are connected.
- Existing frontend and backend application files were not changed.

## Verification

Run the dependency-free prototype check from the repository root:

~~~powershell
node prototype/check.cjs
~~~

Verified in Chromium, with the offline map, image flow and responsive layouts rechecked on 16 September 2026:

- Australian and New Zealand place searches, coordinate validation, country presets, mouse pan/zoom, point selection, report-marker selection, empty search and filter recovery.
- Evidence links, review marks, associated dashboard counts and reset/cancel behavior.
- Scripted query sources, severity-filter handoff, unsupported-query guidance and escaped user text.
- Supplied-image submission and actual local image preview, corrupt-file recovery, required fields and future-date validation.
- Mobile submission through confirmation and the report register.
- Five-step guided journey, mobile tour entry, keyboard navigation, native modal isolation, Escape and reduced-motion support.
- All five views at 320, 390 and 834 pixels without page-level horizontal overflow. The report table scrolls within its labelled region.
- Desktop visual review at 1440 pixels and direct file opening without a server.
- No JavaScript exceptions or external network requests observed during the final desktop flow.

These are prototype implementation checks, not the Task 2 functional-MVP QA plan.

## How the code works

| File | Responsibility |
| --- | --- |
| [index.html](index.html) | Creates the page shell, navigation, main content area and native upload/reset dialogs. Loads the local styles and scripts. |
| [style.css](style.css) | Controls colours, typography, spacing, map layout, responsive navigation and modal layouts. Evidence previews retain the complete supplied crop. |
| [map.js](map.js) | Draws the offline Leaflet map, searches the bundled place catalogue, handles pan/zoom and selection, and keeps the visible report queue in sync with the viewport. |
| [assets/geography.js](assets/geography.js) | Packages real country geometry and 39,576 place records as local JavaScript data. No data is fetched at runtime. |
| [model.js](model.js) | Holds the five fictional incidents, filters them by severity/search, validates image type and size, escapes text, and returns scripted answers with source IDs. |
| [app.js](app.js) | Renders the five views and handles selection, filters, review marks, image submission, conversation and the guided tour in browser memory. |
| [check.cjs](check.cjs) | Runs assertions for filtering, scripted answers, text escaping, image validation, source/crop integrity and removal of the replaced image asset. |

**Navigation and the dashboard.** Changing the URL fragment selects Overview, Hazard map, Hazard assessment, Image reports or Ask HazardWatch. The render function draws that view from the current in-memory state. Dashboard counts are calculated from the incident and report arrays. Selecting a map marker selects the matching incident, marking it reviewed changes that incident and the review count. The local Leaflet library draws bundled geographic outlines and place labels. Country presets change the viewport, selecting a search result centres and zooms the map. Reports outside the viewport are omitted from the visible review queue.

**Image submission.** The choose-file handler checks the format and 10 MB limit, then asks the browser to decode the image. A temporary object URL displays a local preview. Alternatively, “Use example image” selects the packaged image with the same User upload source and review presentation as a chosen local file. Native form validation checks the location and demo capture time. Confirmation appends a session report such as DEMO-001, explicitly marked Unassessed. Nothing is transmitted, classified or placed on the map. Reset clears the report array and releases temporary image URLs.

**Natural-language interaction.** Typed questions go to the keyword matcher in model.js. Recognised questions receive prewritten explanations and incident references, those references open the relevant assessment or filtered map. Unsupported questions receive guidance. This demonstrates the interaction flow without calling an LLM or implying real image analysis.

**The guided journey.** A five-entry list in app.js controls the tour’s order, instructions and next/back buttons. It takes the reviewer through the dashboard, map, assessment, question flow and report submission. Refresh or Reset demo restores the original scenario, there is no persistent storage or backend connection.

The existing HazardWatch UX material and [user research/journey](../docs/ux-ui/user-research-and-journey.md) informed the bushfire scope and coordinator journey. The HazardWatch name and orange target motif were retained, but the earlier Figma visual system was not preserved. The differences and their cause are documented above.

### Offline map data and behaviour

The map and place search work from local files without any backend connection or API key. Leaflet is bundled under assets/leaflet with its licence. Map data is bundled in assets/geography.js, no online tiles or geocoder are connected. A local HTTP preview only serves these static files. Opening index.html directly also works.

The catalogue contains 34,023 Australian and 5,553 New Zealand names: settlements, administrative areas, parks and selected landforms. Search matches names and regions, including diacritic-normalised text, and presents up to eight results with country labels. Exact latitude, longitude input also works inside the supported geographic extent. Clicking or zooming to an area changes selection and the visible report queue, without creating or analysing reports. The catalogue is a snapshot rather than a complete street-address service.

Sources and licences:

- [GeoNames Australian and New Zealand extracts](https://download.geonames.org/export/dump/) - CC BY 4.0; records filtered to the supported place categories.
- [Natural Earth 1:10m country geometry](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_10m_admin_0_countries.geojson) - public-domain country outlines, filtered to Australia and New Zealand.
- [Leaflet 1.9.4](https://leafletjs.com/) - bundled browser map library; licence included at assets/leaflet/LICENSE.txt.

All network checks during the browser walkthrough showed only local static files. No external host, upload endpoint, Firebase service, geocoding endpoint or model endpoint was contacted.
