> **8 October 2026 update:** Full street-address lookup now supplements the offline place catalogue in the map and upload location input. Numbered addresses require a matching house number/street and explicit selection. Blue Mountains is no longer a map preset. See [current behavior and checks](street-address-search.md); older investigation notes below describe the earlier offline-only state.

# Map Compatibility and Image/Video Location-Metadata Extraction

Role: UX — Shah Fahad Ali

Date: 7 October 2026

Branch: `feat/hazardwatch-prototype`

Current website update: preloaded incidents, example imagery and tour/reset controls have since been removed. The website starts empty. See [demo-removal notes and current commit steps](remove-demo-content.md) and [the frontend README](../../frontend/README.md); the findings below record the earlier integration checks.

## Local integration

Merged `origin/development_with_chatbot_implemented` (`cd6318a`) into the feature branch with `git merge --no-commit --no-ff`. The merge was conflict-free. The feature branch HEAD remains `a4275ef`; the merge and implementation are awaiting the user's review and commit. Nothing was committed or pushed, and no contributor attribution was added.

The incoming branch supplies image/video assessment endpoints and the chatbot service. The existing Next.js components, Leaflet map, local place catalogue, Zod validation and native browser geolocation were reused. Metadata extraction uses the existing Pillow dependency and Python's standard library; no frontend dependency was added.

## Findings and implementation

### Map compatibility

The existing map accepts decimal-degree `[latitude, longitude]` points. It renders local Australia/New Zealand geography and named places. The incoming upload path used one hardcoded point and automatically added assessed reports. Low-zoom clustering also placed unrelated reports together near the Blue Mountains. These paths now use each report's confirmed coordinates, retain separate markers, and require explicit approval.

Store WGS84 coordinates as finite numbers: latitude `-90..90`, longitude `-180..180`. For example, Sydney is approximately `[-33.87, 151.21]`. Leaflet uses latitude first; GeoJSON coordinate arrays use longitude first. See the [Leaflet coordinate reference](https://leafletjs.com/reference.html#latlng).

The map's current coverage gate is an approximate rectangle: latitude `-50..-8`, displayed longitude `110..190`. It is not a national boundary check. NZ points across the antimeridian retain their canonical negative longitude in reports and use `longitude + 360` for display when longitude is at or below `-170`. A Chatham point stored at `-176.5` displays at `183.5`. Valid coordinates outside this region remain eligible for assessment but cannot be approved for this map.

### Image and video metadata

`POST /v1/media/location` accepts multipart field `file` and returns `status`, `latitude`, `longitude`, `source` and `detail`. Status is `found`, `missing`, `unsupported` or `invalid`. It is independent of model loading and bounds input to 25 MB.

| Media | Implemented extraction | Limits |
| --- | --- | --- |
| JPEG, PNG, WebP | EXIF GPS latitude/longitude, hemisphere references and rational degrees/minutes/seconds converted to signed decimal degrees | Missing/incomplete tags, invalid values or a non-WGS84 datum require fallback. PNG eXIf is read even after image-data chunks. |
| MP4, MOV | Static ISO 6709 GPS in QuickTime `©xyz`/`@xyz` user data and `com.apple.quicktime.location.ISO6709` keys/ilst metadata | Static decimal-degree locations only; altitude is not used. |
| WebM and unsupported camera metadata | Explicit fallback result | No XMP-only GPS, HEIC/AVIF, 3GPP `loci`, timed GPS tracks or proprietary telemetry extraction. |

GPS metadata is optional and can be stripped or incorrect. The UI offers extracted coordinates for explicit confirmation; it does not silently approve them. No location is guessed from pixels, filenames or arbitrary video text. Video metadata extraction does not depend on browser playback, whose codec support can vary.

Format references: [PNG eXIf](https://www.w3.org/TR/png-3/#eXIf), [WebP metadata](https://developers.google.com/speed/webp/docs/riff_container#metadata), [QuickTime location metadata](https://developer.apple.com/documentation/quicktime-file-format/location_metadata), and [QuickTime metadata atoms](https://developer.apple.com/documentation/quicktime-file-format/metadata_atoms_and_types).

### Fallback and approval flow

1. Choose an image or video. The local API checks its location metadata.
2. Confirm the extracted coordinates, select a suggested place, apply entered decimal coordinates, or request current device location.
3. Review capture time, location and source, then run severity assessment. The assessed report stays **Pending map approval**.
4. Open the report and select **Approve and add to map**. Eligible coordinates add one marker at the confirmed point and focus the map once. Removing approval removes the marker while retaining the report.

Place suggestions reuse the offline catalogue. They cover towns, regions and named places, not street addresses, and represent approximate centres. Street-address autocomplete needs a separately selected geocoder; it has not been presented as implemented.

Device location uses `getCurrentPosition` only after the user's click, with a 10-second timeout, fresh-position request and recorded accuracy. Permission denial, timeout, unavailable API, missing metadata and service failure leave manual coordinates/place selection available. The device position is the user's position now and may differ from the capture location. Browser deployment requires a secure context and permission; see [MDN geolocation](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition).

Editing a location invalidates its previous confirmation. Blank, malformed, nonfinite and out-of-range coordinates cannot be applied. Capture dates use current Sydney time with AEST/AEDT rather than the old fixed demo date. Closing/resetting discards late upload or chatbot results. Reports, approvals, media previews and conversations are session-only; reload or Reset demo clears them.

## Validation

- Frontend: 19 tests across four files passed; TypeScript and production build passed. ESLint has zero errors and six existing native-image/static-stylesheet advisories.
- Backend: seven stdlib unittest checks passed. Synthetic JPEG/PNG/WebP and MP4/MOV fixtures verify GPS/no-GPS, invalid tags, canonical longitude, late PNG eXIf, bounded parsing/upload, multipart requests, CORS and missing-model errors. The four GPS video fixtures contain actual three-frame clips, verified with OpenCV. They contain no personal camera media.
- Map regression: Sydney, Wellington and Chatham remain at their own points at low zoom, with valid ranks and antimeridian display. Pending, missing-coordinate and outside-region reports cannot add markers; approval/removal and late chatbot cancellation are covered.
- Browser: real local API GPS extraction from `gps.jpg`, explicit confirmation, preview coordinates/source, preserved context on Back, Wellington suggestions and mobile/tablet forms checked. The map loaded, Wellington search reached its coordinates, and the camera/selection survived severity filtering and navigation away/back. Missing model weights produced the expected error. Full live inference followed by browser approval could not be exercised without those weights; the approval flow is covered by mocked-assessment regression tests.

Run commands and the model setup are in [the frontend README](../../frontend/README.md). Sample formats, generation commands and limits are in [the fixture README](../../vision-service/tests/fixtures/README.md).

## Task checklist

| Item | Status | Evidence |
| --- | --- | --- |
| Review current map functionality | Complete | Existing Leaflet flow audited; marker, filter and camera paths reviewed. |
| Identify current location-data limitations | Complete | Hardcoded incoming upload location, misplaced cluster, regional coverage and missing persistence documented. |
| Investigate image EXIF metadata | Complete | JPEG/PNG/WebP GPS extraction implemented and checked. |
| Investigate GPS metadata extraction | Complete | DMS/hemisphere conversion, WGS84 and range validation checked. |
| Investigate video location metadata where available | Complete for supported static tags | MP4/MOV QuickTime paths and unsupported formats recorded. |
| Test location extraction using sample images | Complete | Synthetic GPS/no-GPS image fixtures and malformed cases. |
| Test location extraction using sample videos | Complete | Decodable MP4/MOV static-GPS fixtures and missing/malformed cases. |
| Determine coordinate format required by the map | Complete | Canonical WGS84 decimal coordinates and display-only NZ wrap. |
| Identify handling for missing metadata | Complete | Explicit fallback statuses and UI messages. |
| Define location fallback behaviour | Complete | Coordinates, permission-based device location and offline named-place suggestions. |
| Document findings and recommended approach | Complete | This report, fixture notes and updated run documentation. |
| Update master document | User-managed, pending | User will insert the completion entry later. |

## Remaining blockers and next work

- `best_bushfire_multitask.pt` is absent. Real classification requires the trained weights and the vision dependencies in `vision-service/requirements.txt`; no weights or model results were invented. Metadata remains usable without them. Missing weights return HTTP 503.
- Street-address autocomplete requires a geocoder decision and integration. Existing named-place suggestions provide an immediate offline fallback.
- Real-device GPS and camera-format interoperability need device samples beyond the synthetic supported-format fixtures. Unsupported metadata already has a working manual fallback.
- Persistence, authenticated multi-user approval and global map expansion require separate implementation; this remains a local session prototype.

## Copy-ready master-document entry

**Done:** Merged the chatbot development branch locally into the HazardWatch prototype without committing or pushing. Investigated map compatibility and image/video GPS metadata; implemented supported extraction, confirmed coordinates, current-location and named-place fallbacks, and explicit approval before new assessed reports appear at their actual map locations. Validated samples, frontend checks and responsive location forms.

**Deliverable:** Updated frontend and vision service, metadata fixtures/regression checks, and this map/location investigation report.

**Note for next role:** Supply the trained vision weights and test real assessment-to-approval with device media. Choose a geocoder if full street-address suggestions are needed. Reports and approval remain session-only. Insert this entry in the master document before marking that item complete.

## User-run commit steps

Review the pending merge and implementation files before staging. [The current user-run commit steps](remove-demo-content.md#user-run-commit-steps) include this integration and the subsequent public demo removal. No commit or push has been executed.

The incoming chatbot merge files are already staged by Git. The ignored `.tools/` runtime, Python caches and model weights are not deliverables to stage.
