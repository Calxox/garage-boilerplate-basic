/* Shared demo data and deterministic interactions. No services or persistence. */
(function (root) {
  'use strict';
  const incidents = [
    { id: 'HW-0241', name: 'Katoomba ridge', area: 'Katoomba, NSW', severity: 'High', hazard: 'Active bushfire', confidence: 94, images: 8, time: '14:24', source: 'User upload', lat: -33.71977, lng: 150.30739, hectares: '42', quality: 'Clear', reviewed: false, photo: 'assets/bushfire-screenshot.png', reason: 'Visible flames and eight supporting reports place this location first in the sample review queue.', context: 'Flames are visible among tree trunks and vegetation.', uncertainty: 'A single image does not establish the full fire extent or direction of spread. Further reports are needed to verify conditions.' },
    { id: 'HW-0238', name: 'Wentworth Falls', area: 'Wentworth Falls, NSW', severity: 'High', hazard: 'Active bushfire', confidence: 89, images: 4, time: '14:18', source: 'Drone image', lat: -33.71033, lng: 150.37534, hectares: '26', quality: 'Moderate', reviewed: false, reason: 'Visible flames and four supporting reports place this second in the sample review queue. Some of the scene is obscured by smoke.', context: 'Flames are visible along a vegetated slope. Smoke limits the view of the far edge.', uncertainty: 'The boundary and estimated area are illustrative. A field assessment would be required.' },
    { id: 'HW-0234', name: 'Blackheath sector', area: 'Blackheath, NSW', severity: 'Moderate', hazard: 'Smoke detected', confidence: 81, images: 3, time: '14:07', source: 'Citizen image', lat: -33.63567, lng: 150.28318, hectares: '12', quality: 'Moderate', reviewed: false, reason: 'A visible smoke column needs review, but no flame front is confirmed in the sample assessment.', context: 'Smoke rises behind a ridge. The terrain obscures the suspected source.', uncertainty: 'Smoke alone does not establish an active fire. The source is unconfirmed.' },
    { id: 'HW-0230', name: 'Leura valley', area: 'Leura, NSW', severity: 'Moderate', hazard: 'Smoke detected', confidence: 76, images: 2, time: '13:56', source: 'CCTV image', lat: -33.71667, lng: 150.33333, hectares: '8', quality: 'Limited', reviewed: false, reason: 'Two sample reports show possible smoke in the valley. Limited visibility reduces confidence.', context: 'A pale plume is visible in the distance; contrast is low.', uncertainty: 'Haze and smoke are difficult to distinguish in this sample. Additional evidence would be needed.' },
    { id: 'HW-0226', name: 'Mount Victoria', area: 'Mount Victoria, NSW', severity: 'Low', hazard: 'Possible smoke', confidence: 61, images: 1, time: '13:42', source: 'Citizen image', lat: -33.59104, lng: 150.25539, hectares: '—', quality: 'Limited', reviewed: false, reason: 'One low-clarity sample report shows possible smoke, with no visible flames. It remains unverified.', context: 'A distant pale feature could be smoke or cloud.', uncertainty: 'Low severity does not mean safe. This sample needs human verification.' }
  ];
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function filterIncidents(items, severity = 'All', query = '') {
    const needle = query.trim().toLowerCase();
    return items.filter(item => (severity === 'All' || item.severity === severity) && `${item.id} ${item.name} ${item.area} ${item.hazard}`.toLowerCase().includes(needle));
  }
  function validateImage(file) {
    if (!file) return 'Choose an image or use the sample image to continue.';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Choose a JPG, PNG or WebP image.';
    if (file.size > 10 * 1024 * 1024) return 'This image is too large. Choose a file under 10 MB.';
    if (!file.size) return 'This file is empty. Choose another image.';
    return '';
  }
  // ponytail: keyword matching only; replace with a reviewed query service for the functional MVP.
  function answerQuestion(question, items, selectedId) {
    const q = question.toLowerCase().trim();
    const selected = items.find(i => i.id === selectedId) || items[0];
    if (/dispatch|evacuat|safe to|should i|emergency number/.test(q)) return { text: 'This prototype cannot assess safety or make response decisions. It can show fictional evidence and explain the sample review order. Try “Which locations are high severity?”', refs: [] };
    if (/compar/.test(q) && !(/katoomba/.test(q) && /wentworth/.test(q))) return { text: 'This demo supports comparing Katoomba ridge and Wentworth Falls. Try the suggested comparison question below.', refs: [] };
    if (/compar/.test(q)) return { text: `In the sample scenario, Katoomba ridge is ranked first with 8 supporting images and 94% sample confidence. Wentworth Falls is second with 4 images and 89% sample confidence. Both are High severity. These illustrative values support human review; they do not determine a dispatch decision.`, refs: ['HW-0241', 'HW-0238'] };
    if (/why|explain|priorit|rank|first/.test(q)) {
      const target = items.find(i => q.includes(i.name.toLowerCase()) || q.includes(i.name.toLowerCase().split(' ')[0])) || selected;
      return { text: `${target.name}: ${target.reason} ${target.uncertainty}`, refs: [target.id] };
    }
    if (/high|moderate|low|critical|urgent|sever/.test(q)) {
      const level = /\blow\b/.test(q) ? 'Low' : /\bmoderate\b/.test(q) ? 'Moderate' : 'High';
      const high = items.filter(i => i.severity === level);
      return { text: `${high.length} ${high.length === 1 ? 'location has' : 'locations have'} ${level} severity in the sample data: ${high.map(i => i.name).join(' and ')}. Select a source below to inspect its evidence, or open the filtered map.`, refs: high.map(i => i.id), filter: level };
    }
    if (/chang|latest|recent|new/.test(q)) return { text: 'The demo snapshot is fixed at 14:32 AEST. Katoomba ridge has the most recent preloaded evidence, captured at 14:24. Reports you add appear as unassessed session reports. There is no live feed or automated image analysis.', refs: ['HW-0241'] };
    if (/smoke/.test(q)) {
      const smoke = items.filter(i => i.hazard.toLowerCase().includes('smoke'));
      return { text: `The sample smoke reports are ${smoke.map(i => i.name).join(', ')}. Smoke observations need review and do not establish an active fire.`, refs: smoke.map(i => i.id) };
    }
    return { text: 'That question is outside this scripted demo. Try asking why Katoomba is ranked first, comparing Katoomba with Wentworth Falls, or showing high-severity locations.', refs: [] };
  }
  const api = { incidents, escape, filterIncidents, validateImage, answerQuestion };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HazardDemo = api;
})(typeof window !== 'undefined' ? window : globalThis);
