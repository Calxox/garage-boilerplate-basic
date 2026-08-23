# User Groups, Needs and Main Journey

## 1. Primary and secondary user groups identified

### Primary user group 

**Emergency coordinators and State Emergency Service decision-makers** are the primary users. During a bushfire, they need to interpret visual and geographic information, identify locations requiring attention, understand priority rankings, and support response coordination.

### Secondary user groups 

| User group | Relationship to the interface |
| --- | --- |
| Firefighters and response teams | Use current location, severity, priority, and supporting context communicated |
| Residents and farmers in rural Australia and New Zealand | Submit relevant imagery and view or query available bushfire information for their area |


## 2. User goals and pain points 

| User group | Goals | Pain points |
| --- | --- | --- |
| Emergency coordinators | Understand the current situation, identify severe locations, compare priorities find information without excessive navigation | High volumes of imagery, information spread across locations, difficulty prioritising which location to go to, slow or stale updates, unclear results, complex map navigation |
| Firefighters and response teams | Receive concise and current location, severity, priority, and evidence. Understand what action is being supported | Incomplete location data, outdated conditions and too much raw evidence, unclear severityand unavailable route information |
| Residents and farmers | Submit an images and videos successfully, understand required information, view local incident, ask simple location-based questions | Missing image metadata, unclear uploads, too much technical language |


## 3. Information needs identified

| User task | Information the interface must provide |
| --- | --- |
| Submit imagery | Accepted input type, required location data, upload progress, success confirmation, a clear failure message |
| Review of output | Map location, bushfire classification, severity, latest update time, clusters or heat-map context, and available filters |
| Compare priorities | Ranked locations, contributing factors, severity, supporting evidence, an explanation of why one location ranks above another |
| Ask questions to AI | Supported-query guidance, interpreted location or filters, the resulting visual insight, clarification when a question cannot be understood |
| Support an input | Concise location, priority, cause, time, optional route information when available |

UX presentation rules:

- Display the last-updated time so users can judge recency.
- Show uncertainty and missing information explicitly eg, no time given, unknown spread etc.
- Use labels or icons as well as colour for severity of bushfire.
- Keep priority explanations beside the relevant location or result.
- Provide plain-language empty, error, loading, and unsupported-query states.


## 4. Main user journey

**Primary persona:** Emergency coordinator  
**Scenario:** A bushfire event is generating large volumes of imagery. The coordinator must understand the situation and identify the location requiring attention first.

| Stage | User action | Interface response | UX success measure |
| --- | --- | --- | --- |
| 1. Open the operational view | Opens the bushfire map | Shows current fires, severity, priority and time of upload | The user can confirm that the information is current |
| 2. Scan the situation | Reviews map markers, clusters, heat-map areas and ranked locations | Highlights locations where more assistance is needed without hiding lower-priority areas | The user identifies areas requiring investigation quickly |
| 3. Filter selection | Asks a supported question | Updates the map or to match the selected location, severity, or based on a query | The user gets the relevant information without excessive navigation |
| 4. Inspect a location | Selects an incident | Shows imagery, location, timestamp, severity and other supporting context | The user understands the evidence behind the result |
| 5. Compare priorities | Reviews ranked locations and their explanations | Presents reasons for ranking and constraints | The user can justify or question the ranking |
| 6. Support coordination | Uses the summary to inform a response decision | Presents a concise location, severity, priority, reason, and optional route context | The interface supports a faster decision without automating emergency control |
| 7. Continue monitoring | Returns to the map as conditions change | Preserves the users decision while showing new or updated incidents | The user stays oriented as the situation develops |


## 5. Journey reflects the agreed project scope

### In scope for the UX designer

- Responsive map and visualisation layouts.
- Severity markers, heat maps, clusters, graphs, and filters.
- Incident details, priority rankings, and explanations.
- Query input, visual results, clarification and error states.
- Imagery-upload guidance and visual feedback.
- A concise summary and optional route presentation if confirmed.
- Clear hierarchy, accessible contrast and usable mobile controls.

### Outside the UX designer's task

- Building or training the AI model.
- Implementing ingestion, scalability, load testing, storage, or cloud deployment.
- Changing backend services, authentication logic, or session behaviour.
- Automatically controlling emergency equipment or dispatching teams.
- Replacing emergency responders or government agencies.
- Defining regulatory certification or production deployment requirements.
