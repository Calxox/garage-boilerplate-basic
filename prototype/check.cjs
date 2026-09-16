'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { incidents, filterIncidents, validateImage, answerQuestion, escape } = require('./model.js');

// One runnable check covering the interactive prototype's actual branches.
assert.equal(incidents.length, 5);
assert.deepEqual(filterIncidents(incidents, 'High').map(i => i.id), ['HW-0241', 'HW-0238']);
assert.equal(filterIncidents(incidents, 'All', '  katoomba  ')[0].id, 'HW-0241');
assert.equal(filterIncidents(incidents, 'Low', 'Katoomba').length, 0);
assert.equal(filterIncidents(incidents, 'All', 'missing place').length, 0);
assert.match(validateImage(null), /Choose an image/);
assert.match(validateImage({ type: 'image/svg+xml', size: 200 }), /JPG, PNG or WebP/);
assert.match(validateImage({ type: 'image/png', size: 10 * 1024 * 1024 + 1 }), /too large/);
assert.match(validateImage({ type: 'image/png', size: 0 }), /empty/);
assert.equal(validateImage({ type: 'image/webp', size: 3000 }), '');
assert.deepEqual(answerQuestion('Show high-severity locations', incidents).refs, ['HW-0241', 'HW-0238']);
assert.equal(answerQuestion('Show high-severity locations', incidents).filter, 'High');
assert.match(answerQuestion('Why is Wentworth Falls prioritised?', incidents).text, /four supporting reports/);
assert.equal(answerQuestion('Compare Katoomba and Wentworth Falls', incidents).refs.length, 2);
assert.match(answerQuestion('What changed recently?', incidents).text, /no live feed/);
assert.match(answerQuestion('Is it safe to travel?', incidents).text, /cannot assess safety/);
assert.match(answerQuestion('Tell me a joke', incidents).text, /outside this scripted demo/);
assert.equal(escape('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
for (const question of ['Why is Katoomba first?', 'Show smoke', 'Show high severity', 'Compare locations']) {
  for (const id of answerQuestion(question, incidents).refs) assert(incidents.some(i => i.id === id));
}
for (const file of ['index.html', 'style.css', 'app.js', 'model.js', 'assets/mark.svg', 'map.js', 'assets/geography.js', 'assets/leaflet/leaflet.js', 'assets/leaflet/leaflet.css', 'assets/leaflet/LICENSE.txt', 'assets/bushfire-screenshot.png', 'assets/bushfire-source.webp', 'assets/image-provenance.json']) {
  assert(fs.statSync(path.join(__dirname, file)).size > 0, file + ' must exist');
}
const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
assert(!/\b(fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage)\b/.test(app), 'No connected services or persistence in the prototype');

assert.equal(answerQuestion('Show low-severity locations', incidents).filter, 'Low');
assert.deepEqual(answerQuestion('Show moderate severity', incidents).refs, ['HW-0234', 'HW-0230']);
assert.deepEqual(answerQuestion('Compare Auckland and Christchurch', incidents).refs, []);
assert.match(answerQuestion('Compare Auckland and Christchurch', incidents).text, /supports comparing/);

const crypto = require('node:crypto');
const provenance = JSON.parse(fs.readFileSync(path.join(__dirname, 'assets/image-provenance.json'), 'utf8'));
const photo = fs.readFileSync(path.join(__dirname, 'assets/bushfire-screenshot.png'));
assert.deepEqual([photo.readUInt32BE(16), photo.readUInt32BE(20)], [1337, 658], 'The full crop has the recorded size');
assert.equal(crypto.createHash('sha256').update(photo).digest('hex'), provenance.cropSha256);
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'assets/bushfire-source.webp'))).digest('hex'), provenance.sourceSha256);
assert.equal(incidents[0].photo, 'assets/bushfire-screenshot.png');
assert.equal(incidents[0].source, 'User upload');
assert(!fs.existsSync(path.join(__dirname, 'assets/bushfire-sample.png')), 'The replaced image asset must be removed');
assert(!/bushfire-sample\.png|fictional sample/.test(app), 'UI must use the supplied image and accurate labels');
console.log('PASS: prototype logic, image validation, source integrity, exact crop dimensions and removal of the replaced image asset.');
const {searchPlaces,parseCoordinates}=require('./map.js');
assert(searchPlaces('Sydney').some(r=>r.place[0]==='Sydney'&&r.place[2]==='AU'));
assert(searchPlaces('Wellington').some(r=>r.place[0]==='Wellington'&&r.place[2]==='NZ'));
assert(searchPlaces('Queenstown New Zealand').some(r=>r.place[2]==='NZ'));
assert(searchPlaces('Queensland').length>0);
assert.deepEqual(searchPlaces('zzzz-no-such-area'),[]);
assert.deepEqual(parseCoordinates('-33.87, 151.21'),{lat:-33.87,lng:151.21});
assert.deepEqual(parseCoordinates('-43.95, -176.55'),{lat:-43.95,lng:183.45});
assert.equal(parseCoordinates('90, 300'),null);
assert.equal(parseCoordinates('0, 0'),null);
assert.equal(parseCoordinates('Sydney'),null);
assert(incidents.every(i=>Number.isFinite(i.lat)&&Number.isFinite(i.lng)));
console.log('PASS: AU/NZ area search, coordinate validation and geographic report positions.');

const mapSource=fs.readFileSync(path.join(__dirname,'map.js'),'utf8');
assert(!/\b(fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|tileLayer)\b/.test(mapSource),'Map must use only bundled data, with no backend or map service');
console.log('PASS: map uses bundled data only.');
