'use strict';
const { incidents: seed, escape: esc, filterIncidents, validateImage, answerQuestion } = HazardDemo;
let incidents = structuredClone(seed);
let selectedId = incidents[0].id;
let severity = 'All';
let search = '';
let view = 'overview';
let mapVisibleIds = null;
let messages = [];
let reports = [];
let tourStep = -1;
let upload = {};
let toastTimer;
let imageSelection = 0;
const objectUrls = new Set();
const main = document.querySelector('#main');
const uploadDialog = document.querySelector('#upload-dialog');
const resetDialog = document.querySelector('#reset-dialog');
const iconPaths = {
  overview: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z M9 3v15 M15 6v15"/>',
  reports: '<path d="M14 3H5v18h14V8Z M14 3v5h5 M8 12h8 M8 16h5"/>',
  assistant: '<path d="M4 4h16v13H9l-5 4Z M8 9h8 M8 13h5"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5 M4 16v5h16v-5"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',
  fire: '<path d="M13 3c1 6 6 7 6 12a7 7 0 0 1-14 0c0-3 2-5 4-7 0 3 2 4 2 4 2-3 2-6 2-9Z"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.overview}</svg>`;
const badge = value => `<span class="severity severity-${value.toLowerCase()}"><span></span>${esc(value)}</span>`;
const selected = () => incidents.find(item => item.id === selectedId) || incidents[0];
const visibleIncidents = () => filterIncidents(incidents, severity, search).filter(item => !mapVisibleIds || mapVisibleIds.includes(item.id));
const labels = { overview: 'Overview', map: 'Hazard map', reports: 'Image reports', assistant: 'Ask HazardWatch', hazard: 'Hazard assessment' };

function notify(message) {
  clearTimeout(toastTimer);
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 4200);
}
function go(next, focus = true) {
  if (location.hash !== `#${next}`) location.hash = next;
  else render();
  if (focus) requestAnimationFrame(() => main.focus({ preventScroll: true }));
}
function heading(title, description, action = true, eyebrow = 'AUSTRALIA & NEW ZEALAND') {
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${description}</p></div>${action ? `<button class="button primary" data-action="upload">${icon('upload')} Submit an image</button>` : ''}</div>`;
}
function metrics() {
  const stats = [
    ['Locations to monitor', incidents.length.toString().padStart(2, '0'), 'Across Australia & New Zealand', 'map'],
    ['High-severity locations', incidents.filter(i => i.severity === 'High').length.toString().padStart(2, '0'), 'Prioritised for human review', 'fire'],
    ['Supporting images', (incidents.reduce((s, i) => s + i.images, 0) + reports.length).toString().padStart(2, '0'), reports.length ? `${reports.length} added in this session` : 'Across the demo source types', 'image'],
    ['Awaiting review', (incidents.filter(i => !i.reviewed).length + reports.length).toString().padStart(2, '0'), 'Your review marks stay in this session', 'clock'],
  ];
  return `<section class="metrics" aria-label="Sample incident summary">${stats.map(([label, value, note, glyph], n) => `<div class="metric ${n === 1 ? 'metric-alert' : ''}"><div class="metric-label">${label}${icon(glyph)}</div><div class="metric-value">${value}<span>${n === 1 ? badge('High') : ''}</span></div><p>${note}</p></div>`).join('')}</section>`;
}
function filterBar() {
  return `<div class="filter-bar"><div class="filter-tabs" role="group" aria-label="Filter hazards by severity">${['All', 'High', 'Moderate', 'Low'].map(s => `<button data-action="filter" data-value="${s}" aria-pressed="${severity === s}">${s === 'All' ? 'All severities' : s}</button>`).join('')}</div><span class="result-count" role="status">${visibleIncidents().length} locations</span></div>`;
}
function mapGraphic() { return HazardMap.html(); }
function priorityList() {
  const items = visibleIncidents();
  const chosen = items.find(item => item.id === selectedId) || items[0];
  return `<aside class="priority-panel"><div class="panel-heading"><div><span class="eyebrow">HUMAN REVIEW QUEUE</span><h2>Where to look first</h2></div><span class="count-tag">${items.length}</span></div><p class="panel-subtitle">An illustrative order, with the evidence behind it.</p><div class="priority-list">${items.map(i => `<button class="priority-row ${selectedId === i.id ? 'active' : ''}" data-action="select" data-id="${i.id}" aria-pressed="${selectedId === i.id}"><span class="rank">${String(incidents.indexOf(i)+1).padStart(2, '0')}</span><span class="priority-info"><strong>${esc(i.name)}</strong><span>${i.images} images <b>·</b> ${i.time} AEST ${i.reviewed ? '<b>·</b> Reviewed' : ''}</span></span>${badge(i.severity)}</button>`).join('') || '<p class="empty-inline">No demo reports in this map view.</p>'}</div>${items.length ? `<div class="selection-card"><div class="selection-top">${icon('pin')}<strong>${esc(chosen.name)}</strong></div><p>${esc(chosen.reason)}</p><button class="text-button" data-action="detail" data-id="${chosen.id}">Inspect evidence ${icon('arrow')}</button></div>` : ''}<div class="review-note">${icon('check')} A coordinator makes the final decision.</div></aside>`;
}
function recentEvidence() {
  return `<section class="evidence-strip"><img src="assets/bushfire-screenshot.png" alt="Bushfire flames among trees"><div class="evidence-strip-copy"><span class="eyebrow">UPLOADED IMAGE · HW-0241</span><h2>Katoomba ridge · Image report</h2><p>Review the image, the sample assessment, and what remains uncertain.</p><span class="asset-label">Uploaded image · 14 Sep 2026, 14:24 AEST</span></div><button class="button secondary" data-action="detail" data-id="HW-0241">Review evidence ${icon('arrow')}</button></section>`;
}
function overviewPage() {
  return `${heading('Bushfire operations', 'The regional picture, with evidence behind every priority.')}${metrics()}<section class="map-section"><div class="section-title"><h2>Australia & New Zealand coverage</h2><a href="#map" class="text-button">Explore full map ${icon('arrow')}</a></div>${filterBar()}<div class="map-and-list">${mapGraphic()}${priorityList()}</div></section>${recentEvidence()}`;
}
function mapPage() {
  return `${heading('Hazard map', 'Select a numbered location to inspect its evidence and sample severity.')}<form class="search-form" id="map-search"><label for="location-search" class="sr-only">Filter demo reports</label>${icon('search')}<input id="location-search" name="query" maxlength="100" placeholder="Filter reports by location or ID…" value="${esc(search)}"><button class="button secondary" type="submit">Search</button>${search ? '<button class="quiet-button" type="button" data-action="clear-filter">Clear</button>' : ''}</form>${filterBar()}<section class="map-and-list full-map">${mapGraphic()}${priorityList()}</section><p class="below-map-note">Drag or zoom to explore. Search an area to move the map, or click anywhere to select coordinates. The five demo reports are in the Blue Mountains; other areas remain available to explore.</p>`;
}
function evidencePhoto(item) {
  return item.photo ? `<figure class="evidence-photo"><img src="${item.photo}" alt="Bushfire flames among trees"><figcaption>Uploaded image · ${esc(item.id)}</figcaption></figure>` : `<div class="missing-evidence">${icon('image')}<strong>Image not included in this demo</strong><p>The assessment below is prewritten sample content. Open Katoomba ridge to explore the image assessment.</p><button class="text-button" data-action="detail" data-id="HW-0241">Open image report ${icon('arrow')}</button></div>`;
}
function hazardPage() {
  const item = selected();
  return `<a href="#map" class="back-link">← Back to hazard map</a>${heading(esc(item.name), `${esc(item.area)} · ${item.id} · Captured: 14 Sep 2026 at ${item.time} AEST`, false, 'EVIDENCE / HAZARD ASSESSMENT')}<div class="assessment-grid"><section class="assessment-evidence">${evidencePhoto(item)}<div class="evidence-metadata"><div><small>Image source</small><strong>${esc(item.source)}</strong></div><div><small>Image quality</small><strong>${esc(item.quality)}</strong></div><div><small>Supporting reports</small><strong>${item.images} images</strong></div></div><div class="content-panel"><span class="eyebrow">OBSERVATION</span><h2>What the sample describes</h2><p>${esc(item.context)}</p></div><div class="uncertainty"><strong>What we don’t know</strong><p>${esc(item.uncertainty)}</p></div></section><aside class="assessment-summary"><div class="content-panel"><div class="assessment-title"><h2>Sample assessment</h2>${badge(item.severity)}</div><span class="eyebrow">DETECTED HAZARD</span><h3>${esc(item.hazard)}</h3><div class="assessment-stats"><div><strong>${item.confidence}<span>%</span></strong><small>Sample confidence</small></div><div><strong>${item.hectares}<span> ha</span></strong><small>Illustrative area</small></div></div><p class="fine-print">Prewritten demonstration values. No model has analysed this image.</p><hr><span class="eyebrow">REVIEW PRIORITY ${String(incidents.indexOf(item)+1).padStart(2, '0')}</span><h3>Why this location?</h3><p>${esc(item.reason)}</p><button class="text-button" data-action="ask-why" data-id="${item.id}">Ask about this assessment ${icon('arrow')}</button></div><div class="review-panel"><div class="review-status">${icon(item.reviewed ? 'check' : 'clock')}<strong>${item.reviewed ? 'Reviewed in this session' : 'Awaiting human review'}</strong></div><p>${item.reviewed ? 'Your review mark is visible on the dashboard and map.' : 'Inspect the evidence and uncertainty before marking your review complete.'}</p><button class="button ${item.reviewed ? 'secondary' : 'primary'}" data-action="review" data-id="${item.id}">${icon('check')}${item.reviewed ? 'Undo review mark' : 'Mark as reviewed'}</button><small>A review mark does not approve a dispatch.</small></div><details class="severity-guide"><summary>How to read sample severity</summary><p><strong>High:</strong> visible flames in the sample.</p><p><strong>Moderate:</strong> smoke observations needing confirmation.</p><p><strong>Low:</strong> ambiguous evidence needing verification.</p><p>Illustrative categories only. The operational rubric remains to be agreed. Low does not mean safe.</p></details></aside></div>`;
}
function reportsPage() {
  return `${heading('Image reports', 'Follow the path from an image submission to a reviewable report.')}<div class="report-intro"><div>${icon('upload')}<h2>Local evidence. Shared context.</h2><p>Choose an image, add its location and capture time, then review the submission. In this prototype, the image stays in this browser session.</p></div><button class="button primary" data-action="upload">Try the image submission flow ${icon('arrow')}</button></div><div class="section-title"><h2>Report register</h2><span class="muted">${reports.length + incidents.length} sample records</span></div><div class="report-table-wrap" role="region" aria-label="Scrollable report register" tabindex="0"><table class="report-table"><thead><tr><th scope="col">Report / location</th><th scope="col">Source</th><th scope="col">Capture time</th><th scope="col">Assessment</th><th scope="col">Review status</th><th scope="col"><span class="sr-only">Action</span></th></tr></thead><tbody>${reports.map(r => `<tr><td><strong>${esc(r.location)}</strong><small>${r.id} · Added in this session</small></td><td>${esc(r.source)}</td><td>${esc(r.date.replace('T', ' '))}<small>AEST (UTC+10)</small></td><td><span class="neutral-tag">Unassessed</span></td><td>Awaiting assessment</td><td><button class="text-button" data-action="report-preview" data-id="${r.id}">View report →</button></td></tr>`).join('')}${incidents.map(i => `<tr><td><strong>${esc(i.name)}</strong><small>${i.id} · ${i.images} supporting images</small></td><td>${esc(i.source)}</td><td>14 Sep · ${i.time}<small>AEST (UTC+10)</small></td><td>${badge(i.severity)}</td><td>${i.reviewed ? '<span class="reviewed-label">Reviewed</span>' : 'Awaiting review'}</td><td><button class="text-button" data-action="detail" data-id="${i.id}">Inspect →</button></td></tr>`).join('')}</tbody></table></div><div class="inline-info">${icon('image')} Added images are left unassessed. Use the prewritten Katoomba example to explore what a future assessment might look like.</div>`;
}
const prompts = ['Why is Katoomba ranked first?', 'Show high-severity locations', 'Compare Katoomba and Wentworth Falls'];
function assistantPage() {
  return `${heading('Ask HazardWatch', 'Explore the evidence using plain language.', false, 'NATURAL-LANGUAGE INTERACTION')}<div class="assistant-layout"><section class="chat-panel"><div class="chat-header"><span class="assistant-mark">${icon('assistant')}</span><div><strong>Evidence assistant</strong><small>Scripted prototype · ${incidents.length} sample locations</small></div><button class="quiet-button" data-action="clear-chat" ${messages.length ? '' : 'disabled'}>Clear chat</button></div><div class="chat-messages" role="log" aria-label="Conversation" aria-live="polite">${messages.length ? messages.map(m => `<article class="message ${m.role}"><span class="message-author">${m.role === 'user' ? 'You' : 'HazardWatch · Demo response'}</span><p>${esc(m.text)}</p>${m.refs?.length ? `<div class="source-links">${m.refs.map(id => { const i = incidents.find(x => x.id === id); return i ? `<button class="source-link" data-action="detail" data-id="${id}">${icon('reports')}${esc(i.name)} <span>↗</span></button>` : ''; }).join('')}</div>` : ''}${m.filter ? `<button class="text-button" data-action="show-filtered" data-value="${m.filter}">Open filtered hazard map ${icon('arrow')}</button>` : ''}</article>`).join('') : `<div class="chat-welcome"><span class="large-assistant-icon">${icon('assistant')}</span><h2>Start with a question.</h2><p>Understand a priority, compare two locations,<br>or find the high-severity reports.</p></div>`}</div><div class="chat-composer"><div class="prompt-list">${prompts.map(p => `<button class="prompt" data-action="prompt" data-value="${p}">${p} <span>↗</span></button>`).join('')}</div><form id="chat-form"><label for="question" class="sr-only">Ask about the sample bushfire evidence</label><input id="question" name="question" autocomplete="off" maxlength="500" required placeholder="Ask about a location or its priority…"><button class="button primary" type="submit" aria-label="Send question">${icon('arrow')}</button></form><p>Responses use prewritten sample data. This is not a connected AI service.</p></div></section><aside class="assistant-context"><span class="eyebrow">IN CONTEXT</span><h2>Your regional picture</h2><p>Every explanation links back to the sample locations used to create it.</p>${incidents.slice(0,3).map(i => `<button class="context-location" data-action="detail" data-id="${i.id}"><span>${icon('pin')}<strong>${esc(i.name)}</strong></span>${badge(i.severity)}</button>`).join('')}<div class="context-note"><strong>Evidence supports a decision.</strong><p>The coordinator reviews uncertainty and decides what happens next. This prototype does not issue warnings or dispatch resources.</p></div></aside></div>`;
}
function render() {
  HazardMap.destroy();
  view = location.hash.slice(1) || 'overview';
  if (!labels[view]) view = 'overview';
  const visible = visibleIncidents();
  if (['map', 'overview'].includes(view) && visible.length && !visible.some(i => i.id === selectedId)) selectedId = visible[0].id;
  document.querySelector('#navigation').innerHTML = ['overview', 'map', 'reports', 'assistant'].map(key => `<a href="#${key}" aria-label="${labels[key]}" ${view === key || (key === 'map' && view === 'hazard') ? 'aria-current="page"' : ''}>${icon(key)}<span>${labels[key]}</span>${key === 'reports' && reports.length ? `<b class="nav-count">${reports.length}</b>` : ''}</a>`).join('');
  document.querySelector('#breadcrumb').textContent = labels[view];
  document.title = `${labels[view]} · HazardWatch prototype`;
  main.innerHTML = ({ overview: overviewPage, map: mapPage, hazard: hazardPage, reports: reportsPage, assistant: assistantPage })[view]();
  if (view === 'assistant') {
    const log = document.querySelector('.chat-messages');
    log.scrollTop = log.scrollHeight;
  }
  HazardMap.mount({items: filterIncidents(incidents, severity, search), order: incidents.map(i => i.id), onSelect: id => { selectedId = id; render(); }, onViewChange: ids => { mapVisibleIds = ids; const panel = document.querySelector(".priority-panel"); if (panel) panel.outerHTML = priorityList(); const count = document.querySelector(".result-count"); if (count) count.textContent = ids.length + " locations in view"; }});
  renderTour();
}
function ask(question) {
  const text = question.trim();
  if (!text) return;
  messages.push({ role: 'user', text: text.slice(0,500) }, { role: 'assistant', ...answerQuestion(text, incidents, selectedId) });
  go('assistant');
}
function openUpload() {
  imageSelection++;
  upload = { step: 1, preview: '', file: null, location: '', source: 'User upload', date: '2026-09-14T14:28', notes: '', error: '' };
  renderUpload();
  uploadDialog.showModal();
}
function releaseUpload() {
  if (upload.preview?.startsWith('blob:') && !reports.some(r => r.preview === upload.preview)) {
    URL.revokeObjectURL(upload.preview);
    objectUrls.delete(upload.preview);
  }
}
function renderUpload() {
  const step = upload.step;
  const header = `<div class="dialog-head"><div><span class="eyebrow">IMAGE SUBMISSION</span><h2 id="upload-title">${step === 4 ? 'Report added to this demo' : step === 5 ? 'Session report' : 'Add evidence to the picture'}</h2></div><button class="icon-button" data-action="close-upload" aria-label="Close image submission">×</button></div>`;
  const stepper = step < 4 ? `<ol class="upload-steps">${['Choose image','Add context','Review'].map((label, i) => `<li class="${step === i+1 ? 'current' : step > i+1 ? 'complete' : ''}" ${step === i+1 ? 'aria-current="step"' : ''}><span>${step > i+1 ? '✓' : i+1}</span>${label}</li>`).join('')}</ol>` : '';
  let body = '';
  if (step === 1) body = `<form id="upload-image-form"><div class="upload-drop ${upload.preview ? 'has-image' : ''}" id="upload-drop">${upload.preview ? `<img src="${upload.preview}" alt="Selected image preview">` : `<span class="upload-icon">${icon('upload')}</span><h3>Drop a field image here</h3><p>JPG, PNG or WebP · Up to 10 MB</p>`}<label class="button ${upload.preview ? 'secondary' : 'primary'}" for="image-file">${upload.preview ? 'Choose a different image' : 'Choose an image'}</label><input id="image-file" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="image-error" class="file-input"></div>${upload.preview ? `<p class="selected-file">${icon('image')} ${esc(upload.file?.name || 'bushfire.png')}</p>` : ''}${upload.reading ? '<p class="read-status" role="status">Reading image…</p>' : ''}<p id="image-error" class="field-error" role="alert">${esc(upload.error)}</p><div class="sample-choice"><span>No image to hand?</span><button class="text-button" type="button" data-action="sample-image">Use example image →</button></div><p class="privacy-note">Your image stays in this browser session. Nothing is uploaded or analysed.</p><div class="dialog-actions"><button class="button secondary" type="button" data-action="close-upload">Cancel</button><button class="button primary" type="submit" ${upload.reading ? 'disabled' : ''}>Add context ${icon('arrow')}</button></div></form>`;
  if (step === 2) body = `<form id="upload-context-form"><div class="form-field"><label for="report-location">Location <span>Required</span></label><input id="report-location" name="location" required maxlength="120" placeholder="e.g. Katoomba lookout, NSW" value="${esc(upload.location)}"><small>Add a place name and state or region in Australia or New Zealand.</small></div><div class="form-two"><div class="form-field"><label for="capture-time">Captured at · AEST</label><input id="capture-time" name="date" type="datetime-local" required max="2026-09-14T14:32" value="${esc(upload.date)}"><small>Demo clock: 14 Sep 2026, 14:32 AEST (UTC+10).</small></div><div class="form-field"><label for="image-source">Image source</label><select id="image-source" name="source">${['User upload','Field image','Citizen image','Drone image','CCTV image','Satellite image'].map(s => `<option ${s === upload.source ? 'selected' : ''}>${s}</option>`).join('')}</select></div></div><div class="form-field"><label for="field-notes">Field notes <span>Optional</span></label><textarea id="field-notes" name="notes" maxlength="600" rows="3" placeholder="Describe what is visible, including any uncertainty.">${esc(upload.notes)}</textarea></div><p class="field-error" role="alert">${esc(upload.error)}</p><div class="dialog-actions"><button class="button secondary" type="button" data-action="upload-back">Back</button><button class="button primary" type="submit">Review report ${icon('arrow')}</button></div></form>`;
  if (step === 3) body = `<div class="submission-preview"><img src="${upload.preview}" alt="Image selected for this demonstration report"><div><span class="neutral-tag">Uploaded image</span><h3>${esc(upload.location)}</h3><p>${esc(upload.source)}<br>${esc(upload.date.replace('T',' · '))} AEST</p></div></div>${upload.notes ? `<div class="submission-notes"><strong>Field notes</strong><p>${esc(upload.notes)}</p></div>` : ''}<div class="inline-info">This creates a local demo record marked “Unassessed”. No image analysis, server upload or map geocoding takes place.</div><div class="dialog-actions"><button class="button secondary" data-action="upload-back">Back</button><button class="button primary" data-action="submit-report">Add demo report ${icon('check')}</button></div>`;
  if (step === 4) body = `<div class="upload-success"><span>${icon('check')}</span><h3>${upload.id}</h3><p>Your image and context are available in the report register for this browser session.</p><span class="neutral-tag">Unassessed · Awaiting assessment</span></div><p class="privacy-note">The image has not been analysed. Refreshing or resetting the demo clears this report.</p><div class="dialog-actions"><button class="button secondary" data-action="open-sample-result">Explore a sample assessment</button><button class="button primary" data-action="view-reports">View my report ${icon('arrow')}</button></div>`;
  if (step === 5) body = `<div class="submission-preview"><img src="${upload.preview}" alt="Image attached to this local demonstration report"><div><span class="neutral-tag">Unassessed</span><h3>${esc(upload.location)}</h3><p>${upload.id}<br>${esc(upload.source)}<br>${esc(upload.date.replace('T',' · '))} AEST</p></div></div>${upload.notes ? `<div class="submission-notes"><strong>Field notes</strong><p>${esc(upload.notes)}</p></div>` : ''}<p class="privacy-note">Local browser-session record. This image has not been uploaded, analysed or added to the hazard map.</p><div class="dialog-actions"><button class="button primary" data-action="close-upload">Done</button></div>`;
  uploadDialog.innerHTML = header + stepper + `<div class="upload-body">${body}</div>`;
}
async function chooseFile(file) {
  const selection = ++imageSelection;
  upload.reading = false;
  const error = validateImage(file);
  if (error) { upload.error = error; renderUpload(); return; }
  upload.reading = true; upload.error = ''; renderUpload();
  const thisUpload = upload;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
    if (selection !== imageSelection || thisUpload !== upload || !uploadDialog.open || upload.step !== 1) { URL.revokeObjectURL(url); return; }
    releaseUpload();
    objectUrls.add(url);
    Object.assign(upload, { file, preview: url, error: '', reading: false });
  } catch {
    URL.revokeObjectURL(url);
    if (selection !== imageSelection || thisUpload !== upload || !uploadDialog.open || upload.step !== 1) return;
    upload.reading = false;
    upload.error = 'This image could not be opened. Choose a valid JPG, PNG or WebP.';
  }
  renderUpload();
}
const tourSteps = [
  ['Start with the regional picture', 'Compare the summary counts and the review queue, then continue to the map.', 'overview'],
  ['Locate the highest priority', 'Explore both countries, then open the Blue Mountains cluster and select a report marker.', 'map'],
  ['Inspect evidence and uncertainty', 'Read the sample assessment for Katoomba. Mark it reviewed when you have inspected the evidence.', 'hazard'],
  ['Ask why it was prioritised', 'Try “Why is Katoomba ranked first?” and follow the source link in the response.', 'assistant'],
  ['Add a field image', 'Choose “Submit an image”, use the example image, add context and finish the three-step flow.', 'reports'],
];
function renderTour() {
  const el = document.querySelector('#tour');
  if (tourStep < 0) { el.innerHTML = ''; document.body.classList.remove('tour-active'); return; }
  document.body.classList.add('tour-active');
  const [title, description] = tourSteps[tourStep];
  el.innerHTML = `<section class="tour-bar" aria-label="Guided prototype walkthrough"><div class="tour-counter">${tourStep+1}<span>/ 5</span></div><div class="tour-copy"><strong>${title}</strong><p>${description}</p></div><div class="tour-actions"><button class="quiet-button" data-action="end-tour">End tour</button><button class="button secondary" data-action="tour-back" ${tourStep === 0 ? 'disabled' : ''}>Back</button><button class="button primary" data-action="tour-next">${tourStep === 4 ? 'Finish' : 'Next'} ${icon('arrow')}</button></div></section>`;
}
function advanceTour(delta) {
  tourStep += delta;
  if (tourStep >= tourSteps.length) { tourStep = -1; renderTour(); notify('Walkthrough complete. Continue exploring or reset the demo.'); return; }
  severity = 'All'; search = ''; mapVisibleIds = null; HazardMap.reset(); selectedId = 'HW-0241';
  go(tourSteps[tourStep][2]);
  window.scrollTo({ top: 0, behavior: 'instant' });
}
document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const { action, id, value } = button.dataset;
  switch (action) {
    case 'filter': severity = value; render(); document.querySelector(`[data-action="filter"][data-value="${value}"]`)?.focus(); break;
    case 'clear-filter': severity = 'All'; search = ''; mapVisibleIds = null; HazardMap.reset(); render(); break;
    case 'select': selectedId = id; HazardMap.focusIncident(selected()); render(); document.querySelector(`.priority-row[data-id="${id}"]`)?.focus({ preventScroll: true }); break;
    case 'detail': selectedId = id; go('hazard'); window.scrollTo(0,0); break;
    case 'review': selected().reviewed = !selected().reviewed; render(); document.querySelector('[data-action="review"]')?.focus(); notify(selected().reviewed ? 'Marked reviewed in this session.' : 'Review mark removed.'); break;
    case 'ask-why': selectedId = id; ask(`Why is ${selected().name} prioritised?`); break;
    case 'prompt': ask(value); break;
    case 'show-filtered': severity = value; search = ''; mapVisibleIds = null; HazardMap.reset(); go('map'); break;
    case 'clear-chat': messages = []; render(); document.querySelector('#question')?.focus(); break;
    case 'upload': openUpload(); break;
    case 'close-upload': releaseUpload(); uploadDialog.close(); break;
    case 'sample-image': imageSelection++; releaseUpload(); Object.assign(upload, { reading: false, preview: 'assets/bushfire-screenshot.png', source: 'User upload', file: null, error: '' }); renderUpload(); break;
    case 'upload-back': {
      if (upload.step === 2) {
        const form = document.querySelector('#upload-context-form');
        const fields = Object.fromEntries(new FormData(form));
        Object.assign(upload, fields);
      }
      upload.step--; upload.error = ''; renderUpload(); break;
    }
    case 'submit-report':
      if (upload.step !== 3) break;
      upload.id = `DEMO-${String(reports.length+1).padStart(3,'0')}`;
      reports.unshift({ ...upload }); upload.step = 4; renderUpload(); render(); break;
    case 'view-reports': uploadDialog.close(); go('reports'); break;
    case 'open-sample-result': uploadDialog.close(); selectedId = 'HW-0241'; go('hazard'); break;
    case 'report-preview': upload = { ...reports.find(r => r.id === id), step: 5 }; renderUpload(); uploadDialog.showModal(); break;
    case 'reset': resetDialog.showModal(); break;
    case 'cancel-reset': resetDialog.close(); break;
    case 'confirm-reset':
      resetDialog.close(); objectUrls.forEach(url => URL.revokeObjectURL(url)); objectUrls.clear();
      incidents = structuredClone(seed); selectedId = incidents[0].id; severity = 'All'; search = ''; mapVisibleIds = null; HazardMap.reset(); messages = []; reports = []; tourStep = -1; upload = {};
      go('overview'); notify('Demo restored to the original sample data.'); break;
    case 'tour': tourStep = -1; advanceTour(1); break;
    case 'tour-next': advanceTour(1); break;
    case 'tour-back': advanceTour(-1); break;
    case 'end-tour': tourStep = -1; renderTour(); break;
  }
});
document.addEventListener('submit', event => {
  event.preventDefault();
  const form = event.target;
  if (form.id === 'map-search') { search = new FormData(form).get('query').trim(); render(); document.querySelector('#location-search')?.focus(); }
  if (form.id === 'chat-form') { ask(new FormData(form).get('question')); document.querySelector('#question')?.focus(); }
  if (form.id === 'upload-image-form') {
    if (!upload.preview) { upload.error = 'Choose an image or use the sample image to continue.'; renderUpload(); return; }
    upload.step = 2; upload.error = ''; renderUpload(); document.querySelector('#report-location').focus();
  }
  if (form.id === 'upload-context-form') {
    Object.assign(upload, Object.fromEntries(new FormData(form)));
    upload.location = upload.location.trim();
    if (!upload.location) { upload.error = 'Enter a location for this report.'; renderUpload(); document.querySelector('#report-location').focus(); return; }
    upload.step = 3; upload.error = ''; renderUpload(); document.querySelector('[data-action="submit-report"]').focus();
  }
});
document.addEventListener('change', event => {
  if (event.target.id === 'image-file' && event.target.files[0]) chooseFile(event.target.files[0]);
});
document.addEventListener('dragover', event => {
  if (event.target.closest('#upload-drop')) { event.preventDefault(); event.target.closest('#upload-drop').classList.add('dragging'); }
});
document.addEventListener('dragleave', event => event.target.closest('#upload-drop')?.classList.remove('dragging'));
document.addEventListener('drop', event => {
  if (event.target.closest('#upload-drop')) { event.preventDefault(); chooseFile(event.dataTransfer.files[0]); }
});
uploadDialog.addEventListener('cancel', releaseUpload);
window.addEventListener('hashchange', () => { render(); main.focus({ preventScroll: true }); });
render();
