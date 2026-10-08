/* Offline geographic navigation; reports are supplied by the workspace. */
(function(root) {
  'use strict';
  const geography = typeof module !== 'undefined' && module.exports ? require('./assets/geography.js') : root.HazardGeography;
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const countryName = code => code === 'AU' ? 'Australia' : 'New Zealand';
  const displayLng = lng => lng <= -170 ? lng + 360 : lng;
  const validPoint = item => Number.isFinite(item.lat) && Number.isFinite(item.lng) && item.lat >= -90 && item.lat <= 90 && item.lng >= -180 && item.lng <= 180;
  const normalise = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  function parseCoordinates(query) {
    const match = query.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (!match) return null;
    const lat = Number(match[1]), rawLng = Number(match[2]), lng = displayLng(rawLng);
    return lat >= -50 && lat <= -8 && lng >= 110 && lng <= 190 ? {lat, lng} : null;
  }
  // ponytail: scan a fixed local gazetteer on submit; add an index only if the catalogue grows enough to cause lag.
  function searchPlaces(query) {
    const q = normalise(query);
    if (q.length < 2) return [];
    const words = q.split(/[\s,]+/).filter(Boolean);
    return geography.places.map((place, index) => {
      const name = normalise(place[0]);
      const text = normalise(place[0] + ' ' + place[1] + ' ' + countryName(place[2]) + ' ' + place[2]);
      if (!words.every(word => text.includes(word))) return null;
      return {index, place, score: name === q ? 0 : name.startsWith(q) ? 1 : 2};
    }).filter(Boolean).sort((a,b) => a.score - b.score).slice(0,8);
  }
  const bounds = {both:[[-50,110],[-8,190]],au:[[-44,112],[-10,154]],nz:[[-48,165],[-34,190]]};
  let map, context, markerLayer, selectedLayer, placeLayer, camera, selectedArea, activePreset = 'both', fittingPreset = false, query = '', results = [], searchMessage = '', addressController, searchVersion = 0, searchingAddress = false;
  function fitPreset(scope) { activePreset = scope; fittingPreset = true; map.stop(); map.fitBounds(bounds[scope], {padding:[22,22],animate:false}); fittingPreset = false; }
  function resultsHtml() {
    return results.map((result, index) => {
      if(result.address) return '<button type="button" class="area-result" data-address-index="' + index + '"><strong>' + esc(result.address.label) + '</strong><span>Mapped street address · Select to move the map</span></button>';
      const p = result.place;
      return '<button type="button" class="area-result" data-area-index="' + result.index + '"><strong>' + esc(p[0]) + '</strong><span>' + esc(p[1] + ' · ' + countryName(p[2]) + (p[5] === 7 ? ' · Region' : '')) + '</span></button>';
    }).join('') + (results.some(result => result.address) ? '<small>Address data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></small>' : '') + (searchMessage ? '<p role="status">' + esc(searchMessage) + '</p>' : '');
  }
  function html() {
    return '<section class="geographic-panel"><form id="area-search-form" class="area-search"><label for="area-query">Find an area</label><div><input id="area-query" name="area" maxlength="240" value="' + esc(query) + '" placeholder="Street address, city, region or latitude, longitude" autocomplete="off" aria-describedby="area-help"><button type="submit" class="button primary">Find area</button></div><small id="area-help">Australia & New Zealand · Places and coordinates work offline. Unmatched searches use online address lookup; include a suburb or postcode.</small></form><div id="area-results" aria-live="polite">' + resultsHtml() + '</div><div class="map-presets" role="group" aria-label="Map coverage"><button type="button" data-area-scope="both">Both countries</button><button type="button" data-area-scope="au">Australia</button><button type="button" data-area-scope="nz">New Zealand</button></div><div id="geographic-map" class="interactive-map" tabindex="0" role="region" aria-label="Interactive map of Australia and New Zealand"></div><div class="area-status"><strong id="selected-area-label">Australia & New Zealand</strong><span id="selected-area-context">Drag to move, use +/− or pinch to zoom, and click the map to select an area.</span><button class="text-button" type="button" id="clear-area" hidden>Clear selection</button><small>Offline geography · Select a street address, named place or any point on the map.</small></div></section>';
  }
  function updateSelection() {
    selectedLayer.clearLayers();
    if (selectedArea) {
      root.L.circleMarker([selectedArea.lat, selectedArea.lng], {radius:9,color:'#1d5f86',fillColor:'#3188b8',fillOpacity:.9,weight:3}).addTo(selectedLayer);
    }
    const count = context.items.filter(item => validPoint(item) && map.getBounds().contains([item.lat,displayLng(item.lng)])).length;
    document.querySelector('#selected-area-label').textContent = selectedArea ? selectedArea.name : 'Explore Australia & New Zealand';
    document.querySelector('#selected-area-context').textContent = (selectedArea ? selectedArea.lat.toFixed(4) + ', ' + selectedArea.lng.toFixed(4) + ' · ' : '') + count + ' report locations in view. Click the map to select an area.';
    document.querySelector('#clear-area').hidden = !selectedArea;
  }
  function updatePlaceLabels() {
    placeLayer.clearLayers();
    if (map.getZoom() < 5) {
      [['Australia',-25,134],['New Zealand',-41.5,173]].forEach(([name,lat,lng])=>{
        root.L.marker([lat,lng],{interactive:false,keyboard:false,icon:root.L.divIcon({className:'country-map-label',html:esc(name),iconSize:[110,20]})}).addTo(placeLayer);
      });
      return;
    }
    const occupied = new Set();
    let count = 0;
    for (const place of geography.places) {
      if (place[5] < 10 || (map.getZoom() < 10 && place[5] !== 12)) continue;
      const lng = displayLng(place[4]);
      if (!map.getBounds().contains([place[3],lng])) continue;
      const point = map.latLngToContainerPoint([place[3],lng]);
      const cell = Math.floor(point.x/100)+','+Math.floor(point.y/35);
      if (occupied.has(cell)) continue;
      occupied.add(cell);
      root.L.circleMarker([place[3],lng],{radius:3,color:'#708172',fillOpacity:1,weight:1})
        .bindTooltip(esc(place[0]),{permanent:true,direction:'right',className:'place-map-label',offset:[3,0]})
        .on('click',()=>selectArea(place[0]+' · '+countryName(place[2]),place[3],lng,Math.max(10,map.getZoom())))
        .addTo(placeLayer);
      if (++count === 50) break;
    }
  }

  function updateMarkers() {
    updatePlaceLabels();
    markerLayer.clearLayers();
    const items = context.items.filter(item => validPoint(item) && map.getBounds().contains([item.lat,displayLng(item.lng)]));
    items.forEach((item,index)=>{
        const rank = context.order.indexOf(item.id);
        const marker = root.L.marker([item.lat,displayLng(item.lng)], {icon:root.L.divIcon({className:'hazard-marker '+item.severity.toLowerCase()+(item.reviewed?' reviewed':''),html:'<span>'+(rank >= 0 ? rank + 1 : index + 1)+'</span>',iconSize:[40,40]}),title:item.name + ' · '+item.severity,alt:item.name + ', '+item.severity+' severity'});
        marker.on('click',()=>context.onSelect(item.id)).addTo(markerLayer);
        marker.bindTooltip(esc(item.name)+' · '+esc(item.severity));
      });
    context.onViewChange(items.map(item=>item.id));
    updateSelection();
  }
  function selectArea(name,lat,lng,zoom) {
    activePreset = null;
    selectedArea = {name,lat,lng:displayLng(lng)};
    map.stop(); map.setView([selectedArea.lat,selectedArea.lng],zoom,{animate:false});
    updateSelection();
  }
  function mount(options) {
    if (!document.querySelector('#geographic-map')) return;
    context=options;
    map=root.L.map('geographic-map',{minZoom:2,maxZoom:18,zoomSnap:.25,scrollWheelZoom:true,zoomAnimation:false,markerZoomAnimation:false,inertia:false,maxBounds:[[-58,98],[0,195]],maxBoundsViscosity:.9});
    map.attributionControl.addAttribution('<a href="https://www.geonames.org/">GeoNames</a> · <a href="https://www.naturalearthdata.com/">Natural Earth</a> · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>');
    map.createPane('country-outline'); map.getPane('country-outline').style.zIndex = 150;
    root.L.geoJSON(geography.countries,{pane:'country-outline',style:{color:'#9aab93',fillColor:'#dfe7d7',fillOpacity:1,weight:1},interactive:false}).addTo(map);
    placeLayer=root.L.layerGroup().addTo(map);
    markerLayer=root.L.layerGroup().addTo(map);
    selectedLayer=root.L.layerGroup().addTo(map);
    if (activePreset) fitPreset(activePreset);
    else if (camera) map.setView(camera.center,camera.zoom,{animate:false});
    else fitPreset('both');
    map.on('resize',()=>{if(activePreset)fitPreset(activePreset);});
    map.on('dragstart',()=>{activePreset=null;});
    map.on('zoomstart',()=>{if(!fittingPreset)activePreset=null;});
    map.on('moveend',()=>{camera={center:map.getCenter(),zoom:map.getZoom()};updateMarkers();});
    map.on('click',event=>{selectedArea={name:'Selected area',lat:event.latlng.lat,lng:event.latlng.lng};updateSelection();});
    document.querySelectorAll('[data-area-scope]').forEach(button=>button.addEventListener('click',()=>{
      cancelAddressSearch();selectedArea=null;results=[];searchMessage='';query='';
      document.querySelector('#area-query').value='';
      document.querySelector('#area-results').innerHTML='';
      fitPreset(button.dataset.areaScope);
    }));
    document.querySelector('#area-query').addEventListener('input',event=>{cancelAddressSearch();query=event.target.value;results=[];searchMessage='';document.querySelector('#area-results').innerHTML='';});
    document.querySelector('#area-search-form').addEventListener('submit',async event=>{
      event.preventDefault();
      cancelAddressSearch();
      query=new FormData(event.target).get('area').trim();
      const coords=parseCoordinates(query);
      results=coords?[]:searchPlaces(query);
      searchMessage=coords?'':results.length?'Select a result to move the map.':'No matching area. Try a nearby town, a region, or latitude, longitude within Australia and New Zealand.';
      document.querySelector('#area-results').innerHTML=resultsHtml();
      if(coords) selectArea('Selected coordinates',coords.lat,coords.lng,12);
      if(coords || results.length || !context.searchAddresses || query.length < 4) return;
      const version = ++searchVersion;
      const controller = new AbortController();
      addressController = controller;
      searchingAddress = true;
      searchMessage = 'Finding street addresses…';
      document.querySelector('#area-results').innerHTML = resultsHtml();
      try {
        const addresses = await context.searchAddresses(query, controller.signal);
        if(version !== searchVersion || !map) return;
        results = addresses.filter(address => address && typeof address.label === 'string' && validPoint({lat:address.coordinates?.latitude,lng:address.coordinates?.longitude})).map(address => ({address}));
        searchMessage = results.length ? 'Select the full address to move the map to its mapped point.' : 'No matching street address. Add a suburb or postcode, or enter coordinates; a suburb centre will not be substituted.';
      } catch(error) {
        if(version !== searchVersion || controller.signal.aborted || !map) return;
        results=[];searchMessage=error instanceof Error ? error.message : 'Address lookup is unavailable. Enter coordinates or select a place.';
      } finally {
        if(version === searchVersion && map) {searchingAddress=false;addressController=null;document.querySelector('#area-results').innerHTML=resultsHtml();}
      }
    });
    document.querySelector('#area-results').addEventListener('click',event=>{
      const addressButton=event.target.closest('[data-address-index]');
      if(addressButton) {
        const address=results[Number(addressButton.dataset.addressIndex)]?.address;
        if(address) {cancelAddressSearch();selectArea(address.label,address.coordinates.latitude,address.coordinates.longitude,16);results=[];searchMessage='';document.querySelector('#area-results').innerHTML='';document.querySelector('#geographic-map').focus();}
        return;
      }
      const button=event.target.closest('[data-area-index]');
      if(!button) return;
      const place=geography.places[Number(button.dataset.areaIndex)];
      if(place) {selectArea(place[0]+' · '+countryName(place[2]),place[3],place[4],place[5]);results=[];searchMessage='';document.querySelector('#area-results').innerHTML='';document.querySelector('#geographic-map').focus();}
    });
    document.querySelector('#clear-area').addEventListener('click',()=>{cancelAddressSearch();selectedArea=null;updateSelection();});
    updateMarkers();
  }
  function cancelAddressSearch() {searchVersion++;addressController?.abort();addressController=null;if(searchingAddress)searchMessage='Search interrupted. Submit the address again to retry.';searchingAddress=false;}
  function destroy() {cancelAddressSearch();if(map){camera={center:map.getCenter(),zoom:map.getZoom()};map.off();map.remove();map=null;}}
  function reset() {destroy();camera=null;selectedArea=null;activePreset='both';query='';results=[];searchMessage='';}
  function focusIncident(item) {if(!validPoint(item))return;activePreset=null;camera={center:[item.lat,displayLng(item.lng)],zoom:12};if(map)map.setView(camera.center,camera.zoom,{animate:false});}
  const api={html,mount,destroy,reset,focusIncident,searchPlaces,parseCoordinates};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HazardMap=api;
})(typeof window!=='undefined'?window:globalThis);
