/* Shared demo data and deterministic interactions. No services or persistence. */
(function (root) {
  'use strict';
  const incidents = [
    {
      id: 'HW-0241',
      name: 'Katoomba ridge',
      area: 'Katoomba, NSW',
      severity: 'High',
      hazard: 'Active bushfire',
      confidence: 94,
      images: 8,
      time: '14:24',
      source: 'User upload',
      lat: -33.71977,
      lng: 150.30739,
      hectares: '42',
      quality: 'Clear',
      reviewed: false,
      photo: '/prototype/assets/bushfire-screenshot.png',
      reason: 'Visible flames and eight supporting reports place this location first in the sample review queue.',
      context: 'Flames are visible among tree trunks and vegetation.',
      explainability:
        'Based on the provided image, severity is **high** with **94%** confidence. Visible **actual_flames** and **heavy_smoke** indicate an active fire front that warrants immediate human review and elevated responder priority. Eight corroborating reports in this sample reinforce triage order; operators should confirm extent and spread on the ground.',
      keyFeatureScores: {
        actual_flames: 91,
        heavy_smoke: 78,
        smoke: 85,
        burn_scars: 42,
        burnt_vegetation: 38,
        thermal_hotspots: 55,
      },
    },
    {
      id: 'HW-0238',
      name: 'Wentworth Falls',
      area: 'Wentworth Falls, NSW',
      severity: 'Extreme',
      hazard: 'Active bushfire',
      confidence: 89,
      images: 4,
      time: '14:18',
      source: 'Drone image',
      lat: -33.71033,
      lng: 150.37534,
      hectares: '26',
      quality: 'Moderate',
      reviewed: false,
      reason: 'Visible flames and four supporting reports place this second in the sample review queue.',
      context: 'Flames are visible along a vegetated slope. Smoke limits the view of the far edge.',
      explainability:
        'Based on the provided image, severity is **extreme** with **89%** confidence. **Actual_flames**, **heavy_smoke**, and **burn_scars** together suggest an intense, established fire. Smoke obscures part of the scene, so this briefing supports triage rather than dispatch decisions—treat as highest priority for verification.',
      keyFeatureScores: {
        actual_flames: 96,
        heavy_smoke: 88,
        smoke: 82,
        burn_scars: 71,
        burnt_vegetation: 64,
        thermal_hotspots: 59,
      },
    },
    {
      id: 'HW-0234',
      name: 'Blackheath sector',
      area: 'Blackheath, NSW',
      severity: 'Moderate',
      hazard: 'Smoke detected',
      confidence: 81,
      images: 3,
      time: '14:07',
      source: 'Citizen image',
      lat: -33.63567,
      lng: 150.28318,
      hectares: '12',
      quality: 'Moderate',
      reviewed: false,
      reason: 'A visible smoke column needs review, but no flame front is confirmed in the sample assessment.',
      context: 'Smoke rises behind a ridge. The terrain obscures the suspected source.',
      explainability:
        'Based on the provided image, severity is **moderate** with **81%** confidence. **Smoke** is present without confirmed **actual_flames** in this frame. Prioritise confirmation—smoke alone does not prove an active fire, but it merits timely review given terrain that may hide the source.',
      keyFeatureScores: {
        smoke: 79,
        heavy_smoke: 52,
        actual_flames: 18,
        burn_scars: 22,
        burnt_vegetation: 15,
        thermal_hotspots: 12,
      },
    },
    {
      id: 'HW-0230',
      name: 'Leura valley',
      area: 'Leura, NSW',
      severity: 'Moderate',
      hazard: 'Smoke detected',
      confidence: 76,
      images: 2,
      time: '13:56',
      source: 'CCTV image',
      lat: -33.71667,
      lng: 150.33333,
      hectares: '8',
      quality: 'Limited',
      reviewed: false,
      reason: 'Two sample reports show possible smoke in the valley.',
      context: 'A pale plume is visible in the distance; contrast is low.',
      explainability:
        'Based on the provided image, severity is **moderate** with **76%** confidence. **Smoke** is suggested but image quality is limited. Use this as a cue for follow-up imagery or ground checks rather than as sole evidence of an active fire.',
      keyFeatureScores: {
        smoke: 68,
        heavy_smoke: 31,
        actual_flames: 9,
        burn_scars: 11,
        burnt_vegetation: 8,
        thermal_hotspots: 6,
      },
    },
    {
      id: 'HW-0226',
      name: 'Mount Victoria',
      area: 'Mount Victoria, NSW',
      severity: 'Low',
      hazard: 'Possible smoke',
      confidence: 61,
      images: 1,
      time: '13:42',
      source: 'Citizen image',
      lat: -33.59104,
      lng: 150.25539,
      hectares: '—',
      quality: 'Limited',
      reviewed: false,
      reason: 'One low-clarity sample report shows possible smoke, with no visible flames.',
      context: 'A distant pale feature could be smoke or cloud.',
      explainability:
        'Based on the provided image, severity is **low** with **61%** confidence. No strong fire features exceed threshold; the scene may be haze or cloud. Low severity is not an all-clear—schedule verification when resources allow.',
      keyFeatureScores: {
        smoke: 44,
        heavy_smoke: 19,
        actual_flames: 5,
        burn_scars: 8,
        burnt_vegetation: 6,
        thermal_hotspots: 4,
      },
    },
    {
      id: 'HW-0219',
      name: 'Medlow Bath lookout',
      area: 'Medlow Bath, NSW',
      severity: 'None',
      hazard: 'No bushfire detected',
      confidence: 72,
      images: 1,
      time: '13:28',
      source: 'Field image',
      lat: -33.6742,
      lng: 150.2815,
      hectares: '—',
      quality: 'Clear',
      reviewed: false,
      context: 'Open ridgeline and sky; no smoke column or flame front visible.',
      reason: 'Sample assessment found no bushfire hazard above threshold.',
      explainability:
        'Based on the provided image, severity is **none** with **72%** confidence. This is likely not a bushfire scene—no clear hazard features were detected. Continue monitoring if conditions change; confidence is not extremely high, so reassess with additional media if concern remains.',
      keyFeatureScores: {
        actual_flames: 3,
        smoke: 8,
        heavy_smoke: 2,
        burn_scars: 6,
        burnt_vegetation: 5,
        thermal_hotspots: 4,
      },
    },
  ];
  const escape = (value) =>
    String(value).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  function filterIncidents(items, severity = 'All', query = '') {
    const needle = query.trim().toLowerCase();
    return items.filter(
      (item) =>
        (severity === 'All' || item.severity === severity) &&
        `${item.id} ${item.name} ${item.area} ${item.hazard}`.toLowerCase().includes(needle)
    );
  }
  function validateImage(file) {
    if (!file) return 'Choose an image or use the sample image to continue.';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
      return 'Choose a JPG, PNG or WebP image.';
    if (file.size > 10 * 1024 * 1024) return 'This image is too large. Choose a file under 10 MB.';
    if (!file.size) return 'This file is empty. Choose another image.';
    return '';
  }
  function answerQuestion(question, items, selectedId) {
    const q = question.toLowerCase().trim();
    const selected = items.find((i) => i.id === selectedId) || items[0];
    const explain = (item) => item.explainability || item.reason;
    if (/dispatch|evacuat|safe to|should i|emergency number/.test(q))
      return {
        text: 'This prototype cannot assess safety or make response decisions. It can show fictional evidence and explain the sample review order. Try “Which locations are high severity?”',
        refs: [],
      };
    if (/compar/.test(q) && !(/katoomba/.test(q) && /wentworth/.test(q)))
      return {
        text: 'This demo supports comparing Katoomba ridge and Wentworth Falls. Try the suggested comparison question below.',
        refs: [],
      };
    if (/compar/.test(q))
      return {
        text: `In the sample scenario, Katoomba ridge is ranked first with 8 supporting images and 94% confidence. Wentworth Falls is **Extreme** severity with 89% confidence. These values support human review; they do not determine a dispatch decision.`,
        refs: ['HW-0241', 'HW-0238'],
      };
    if (/why|explain|priorit|rank|first/.test(q)) {
      const target =
        items.find(
          (i) =>
            q.includes(i.name.toLowerCase()) || q.includes(i.name.toLowerCase().split(' ')[0])
        ) || selected;
      return { text: `${target.name}: ${explain(target)}`, refs: [target.id] };
    }
    if (/high|moderate|low|critical|urgent|sever|extreme|none/.test(q)) {
      const level = /\bnone\b/.test(q)
        ? 'None'
        : /\bextreme\b/.test(q)
          ? 'Extreme'
          : /\blow\b/.test(q)
            ? 'Low'
            : /\bmoderate\b/.test(q)
              ? 'Moderate'
              : 'High';
      const matched = items.filter((i) => i.severity === level);
      return {
        text: `${matched.length} ${matched.length === 1 ? 'location has' : 'locations have'} ${level} severity in the sample data: ${matched.map((i) => i.name).join(' and ') || 'none'}. Select a source below to inspect its evidence, or open the filtered map.`,
        refs: matched.map((i) => i.id),
        filter: level,
      };
    }
    if (/chang|latest|recent|new/.test(q))
      return {
        text: 'The demo snapshot is fixed at 14:32 AEST. Katoomba ridge has the most recent preloaded evidence, captured at 14:24. Reports you add appear as unassessed session reports. There is no live feed or automated image analysis.',
        refs: ['HW-0241'],
      };
    if (/smoke/.test(q)) {
      const smoke = items.filter((i) => i.hazard.toLowerCase().includes('smoke'));
      return {
        text: `The sample smoke reports are ${smoke.map((i) => i.name).join(', ')}. Smoke observations need review and do not establish an active fire.`,
        refs: smoke.map((i) => i.id),
      };
    }
    return {
      text: 'That question is outside this scripted demo. Try asking why Katoomba is ranked first, comparing Katoomba with Wentworth Falls, or showing high-severity locations.',
      refs: [],
    };
  }
  const api = { incidents, escape, filterIncidents, validateImage, answerQuestion };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HazardDemo = api;
})(typeof window !== 'undefined' ? window : globalThis);
