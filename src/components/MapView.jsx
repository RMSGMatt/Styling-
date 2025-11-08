// ✅ Full MapView.jsx with working toggle logic and earthquake source registration

import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import Papa from 'papaparse';

mapboxgl.accessToken = 'pk.eyJ1IjoiZXRtc21hdHQiLCJhIjoiY204OTdkMDZmMDM1NDJ2cHk1M2FvcnkxbyJ9.t8NCNACusdhKWWVuWpYh9A';

const MAPBOX_STYLE_URL = 'mapbox://styles/etmsmatt/cm9oz0hdj00fe01rzdonjg51i';
const USGS_FEED_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';

export default function MapView({ onFacilityClick, locationsUrl }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const [incidentData, setIncidentData] = useState(null);
  const animationFrameRef = useRef(null);
const pulseStepRef = useRef(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showPanels, setShowPanels] = useState(true);
  const [layerVisibility, setLayerVisibility] = useState({
    'natural-hazard': true,
    'logistics-disruption': true,
    'geopolitical-risk': true,
    'cyber-disruption': true,
    'industrial-fire': true,
    'earthquake-live': true,
    'noaa-weather': true,
    'gdacs-alerts': true
  });
  const [noaaMarkers, setNoaaMarkers] = useState([]);
  const [gdacsMarkers, setGdacsMarkers] = useState([]);
  const [earthquakeMagFilter, setEarthquakeMagFilter] = useState(false);
  const facilityMarkersRef = useRef([]);

  function getEmojiForNOAA(event) {
    const map = {
      "Tornado Warning": "🌪️",
      "Severe Thunderstorm Warning": "⛈️",
      "Flood Warning": "🌊",
      "Winter Storm Warning": "❄️",
      "Hurricane Warning": "🌀",
      "Heat Advisory": "🥵",
      "Red Flag Warning": "🔥",
      "High Wind Warning": "💨",
      "Dense Fog Advisory": "🌁",
      "Fire Weather Watch": "🔥",
      "Wind Chill Warning": "🥶",
      "Excessive Heat Warning": "🌡️"
    };
    for (const key in map) {
      if (event.includes(key)) return map[key];
    }
    return "⚠️";
  }

  function getEmojiForGDACS(event_type) {
    const map = {
      tropical_cyclone: '🌀',
      flood: '🌊',
      earthquake: '🌍',
      tsunami: '🌊',
      volcano: '🌋',
      wildfire: '🔥',
      drought: '🌞',
      cold_wave: '🥶',
      heat_wave: '🥵'
    };
    return map[event_type?.toLowerCase()] || '⚠️';
  }

  const toggleLayer = (layerId) => {
    const map = mapRef.current;
    if (!map) return;

    const isVisible = layerVisibility[layerId];

    if (layerId === 'noaa-weather') {
      if (isVisible) {
        noaaMarkers.forEach(marker => marker.remove());
        setNoaaMarkers([]);
      } else {
        fetchNOAAAlerts(true);
      }
    } else {
      const mapLayerExists = map.getLayer(layerId);
      if (mapLayerExists) {
        map.setLayoutProperty(layerId, 'visibility', isVisible ? 'none' : 'visible');
      } else if (!['noaa-weather', 'gdacs-alerts'].includes(layerId)) {
  console.warn(`⚠️ Skipping toggle for '${layerId}' – no Mapbox layer found.`);
}
    }

    setLayerVisibility(prev => ({ ...prev, [layerId]: !prev[layerId] }));
  };

  function getEmojiForType(type) {
    const map = {
      fire: '🔥',
      cyber: '💻',
      hazard: '🌪️',
      logistics: '🚚',
      geopolitical: '🛡️',
      flood: '🌊',
      cyclone: '🌀',
      earthquake: '🌍'
    };
    return map[type.toLowerCase()] || '⚠️';
  }

  const fetchNOAAAlerts = (forceShow = false) => {
    fetch('https://api.weather.gov/alerts/active')
      .then(res => res.json())
      .then(data => {
        if (!data.features || data.features.length === 0) return;

        const newMarkers = [];

        data.features.slice(0, 50).forEach(alert => {
          try {
            const geometry = alert.geometry;
            const props = alert.properties;
            if (!geometry || !props) return;

            const { event, headline, areaDesc } = props;
            const emoji = getEmojiForNOAA(event);
            let coords = null;

            if (geometry.type === 'Point' && Array.isArray(geometry.coordinates)) {
              coords = geometry.coordinates;
            } else if (geometry.type === 'Polygon' && geometry.coordinates?.[0]?.[0]) {
              coords = geometry.coordinates[0][0];
            } else if (geometry.type === 'MultiPolygon' && geometry.coordinates?.[0]?.[0]?.[0]) {
              coords = geometry.coordinates[0][0][0];
            }

            if (!Array.isArray(coords) || coords.length < 2) {
              console.warn("⚠️ NOAA alert skipped due to invalid or missing geometry:", alert);
              return;
            }

            const el = document.createElement('div');
            el.textContent = emoji;
            el.style.fontSize = '20px';
            el.style.cursor = 'pointer';

            if (forceShow || layerVisibility['noaa-weather']) {
              const marker = new mapboxgl.Marker(el)
                .setLngLat(coords)
                .setPopup(new mapboxgl.Popup().setHTML(
                  `<strong>${event}</strong><br>${headline || ''}<br><em>${areaDesc || ''}</em>`
                ))
                .addTo(mapRef.current);
              newMarkers.push(marker);
            }
          } catch (err) {
            console.warn("⚠️ NOAA alert skipped:", err);
          }
        });

        if (forceShow) {
          setNoaaMarkers(newMarkers);
        }
      })
      .catch(err => console.error('❌ NOAA alerts fetch failed:', err));
  };

  // ✅ Map init
  useEffect(() => {
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAPBOX_STYLE_URL,
      projection: 'globe',
      center: [0, 20],
      zoom: 1.2
    });

    mapRef.current = map;

    map.on('style.load', () => {
      if (!map.getSource('earthquake-live')) {
  // Fetch the USGS data manually
  fetch(USGS_FEED_URL)
    .then(res => res.json())
    .then(data => {
      // Sort features by magnitude (descending)
      const sorted = [...data.features].sort((a, b) =>
        (b.properties.mag || 0) - (a.properties.mag || 0)
      );

      // Mark top 5 with a flag
      const topFiveIds = new Set(sorted.slice(0, 5).map(f => f.id));
      data.features = data.features.map(f => ({
        ...f,
        properties: {
          ...f.properties,
          top5: topFiveIds.has(f.id) ? true : false
        }
      }));

      map.addSource('earthquake-live', {
        type: 'geojson',
        data: data
      });

      // Add the base layer after source is added
      map.addLayer({
        id: 'earthquake-live',
        type: 'circle',
        source: 'earthquake-live',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['get', 'mag'],
            0, 4,
            6, 12
          ],
          'circle-color': [
            'case',
            ['==', ['get', 'top5'], true], '#ef4444',  // 🔴 red for top 5
            ['interpolate', ['linear'], ['get', 'mag'],
              0, '#6EE7B7',
              3, '#FBBF24',
              5, '#F87171'
            ]
          ],
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1,
          'circle-opacity': 0.6
        }
      });

      // Add popup and cursor logic
      map.on('click', 'earthquake-live', (e) => {
        const feature = e.features[0];
        const coords = feature.geometry.coordinates;
        const { mag, place, time, top5 } = feature.properties;
        const dateStr = new Date(time).toLocaleString();
        const badge = top5 ? "<span style='color:red'>🔥 Top 5</span><br>" : "";

        new mapboxgl.Popup()
          .setLngLat(coords)
          .setHTML(`${badge}<strong>🌍 M${mag}</strong><br>${place}<br><em>${dateStr}</em>`)
          .addTo(map);
      });

      map.on('mouseenter', 'earthquake-live', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'earthquake-live', () => {
        map.getCanvas().style.cursor = '';
      });
    });
}

     // Load facility markers from locationsUrl
if (locationsUrl) {
  console.log("🌐 Fetching location CSV from:", locationsUrl);
  fetch(locationsUrl)
    .then(response => response.text())
    .then(text => {
      console.log("📄 Raw CSV text:", text.slice(0, 300));
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: h => h.trim().replace(/\uFEFF/g, ''),
        complete: (results) => {
          const rows = results.data;
          console.log("📌 Parsed facility rows:", rows);

          // Remove old markers
          facilityMarkersRef.current.forEach(marker => marker.remove());
          facilityMarkersRef.current = [];

          const bounds = new mapboxgl.LngLatBounds();

          rows.forEach((row, i) => {
            const lat = parseFloat(row.Latitude ?? row.latitude ?? row.lat);
            const lng = parseFloat(row.Longitude ?? row.longitude ?? row.lon ?? row.lng);
            const facility = row.Facility ?? row.facility ?? row.facility_id ?? "Unnamed";

            console.log(`📍 Facility row ${i + 1}:`, { lat, lng, facility });

            if (isNaN(lat) || isNaN(lng)) {
              console.warn(`⚠️ Skipping invalid coordinates:`, row);
              return;
            }

            const el = document.createElement('div');
            el.textContent = '📍';
            el.style.fontSize = '20px';
            el.style.color = 'red';
            el.style.cursor = 'pointer';

            const marker = new mapboxgl.Marker(el)
              .setLngLat([lng, lat])
              .setPopup(new mapboxgl.Popup().setHTML(`<strong>${facility}</strong>`))
              .addTo(mapRef.current);

            facilityMarkersRef.current.push(marker);
            bounds.extend([lng, lat]);

            if (onFacilityClick) {
              el.addEventListener('click', () => onFacilityClick(facility));
            }
          });

          if (!bounds.isEmpty()) {
            mapRef.current.fitBounds(bounds, { padding: 40, maxZoom: 6 });
          }
        },
        error: (err) => {
          console.error("❌ PapaParse error on locations CSV:", err);
        }
      });
    })
    .catch(err => {
      console.error("❌ Error fetching locations CSV:", err);
    });
}
    });}, []);

  // 🔁 Refresh GDACS + USGS
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const refresh = () => {
      map.getSource('earthquake-live')?.setData(USGS_FEED_URL);

      fetch('/api/gdacs-feed')
  .then(res => res.json())
  .then(data => {
    if (!Array.isArray(data.features)) {
      console.warn("⚠️ No GDACS features found — initializing features array");
      data.features = [];
    }

    // ✅ Clear previous GDACS markers
    // ✅ Step 1A: Remove old markers from map
gdacsMarkers.forEach(marker => marker.remove());

// ✅ Step 1B: Clear state before re-rendering
setGdacsMarkers([]);

// ✅ Step 1C: Begin collecting new markers
const newMarkers = [];

let hasEuropeAlert = false;
    data.features.forEach(feature => {
  const { geometry, properties } = feature;
  if (!geometry || !geometry.coordinates) {
    console.warn("⚠️ GDACS: Missing geometry or coordinates", feature);
    return;
  }

  let coords;
  if (geometry.type === 'Point') {
    coords = geometry.coordinates;
  } else if (geometry.type === 'MultiPolygon' && geometry.coordinates?.[0]?.[0]?.[0]) {
    coords = geometry.coordinates[0][0][0]; // fallback corner of polygon
  } else {
    console.warn("⚠️ Unsupported GDACS geometry type:", geometry?.type);
    return;
  }

  const [lng, lat] = coords;
  const name = properties?.eventname || properties?.name || 'GDACS Alert';
  const type = properties?.eventtype || properties?.type || 'event';
  const country = properties?.country || '';
  const description = properties?.htmldescription || properties?.description || '';

  const emoji = getEmojiForGDACS(type);

  console.log("📌 GDACS Marker:", name, lat, lng);

  if (lat > 35 && lat < 70 && lng > -10 && lng < 40) {
    hasEuropeAlert = true;
  }

  if (layerVisibility['gdacs-alerts']) {
    const el = document.createElement('div');
    el.textContent = emoji;
    el.style.fontSize = '24px';
    el.style.cursor = 'pointer';

    const marker = new mapboxgl.Marker(el)
      .setLngLat([lng, lat])
      .setPopup(new mapboxgl.Popup().setHTML(
        `<strong>${name}</strong><br>
         ${country}<br>
         ${description}`
      ))
      .addTo(mapRef.current);

    newMarkers.push(marker);
  }
});

// ✅ Step 4: Inject fallback if no European alerts found
if (!hasEuropeAlert && layerVisibility['gdacs-alerts']) {
  console.warn("⚠️ No European GDACS alerts found. Injecting fallback.");

  const el = document.createElement('div');
  el.textContent = '⚠️';
  el.style.fontSize = '24px';
  el.style.cursor = 'pointer';

  const marker = new mapboxgl.Marker(el)
    .setLngLat([10.0, 51.0]) // Germany center
    .setPopup(new mapboxgl.Popup().setHTML(
      `<strong>Test Alert</strong><br>Fallback marker for Europe<br><em>No GDACS features in bounding box</em>`
    ))
    .addTo(mapRef.current);

  newMarkers.push(marker);
}

// ✅ Fallback: inject European marker if none found
if (!hasEuropeAlert && layerVisibility['gdacs-alerts']) {
  console.warn("⚠️ No European GDACS alerts found. Injecting fallback.");

  const el = document.createElement('div');
  el.textContent = '⚠️';
  el.style.fontSize = '24px';
  el.style.cursor = 'pointer';

  const marker = new mapboxgl.Marker(el)
    .setLngLat([10.0, 51.0]) // Germany center
    .setPopup(new mapboxgl.Popup().setHTML(
      `<strong>Test Alert</strong><br>Fallback marker for Europe<br><em>No GDACS features in bounding box</em>`
    ))
    .addTo(mapRef.current);

  newMarkers.push(marker);
}

setGdacsMarkers(newMarkers);
setLastUpdated(new Date());
  })
  .catch(err => console.error('❌ GDACS refresh failed:', err));
    };

    refresh(); // ✅ Run once immediately on mount
    
    const id = setInterval(refresh, 120000);
    return () => clearInterval(id);
  }, []);

  // ✅ Fetch live incidents every 60 seconds
useEffect(() => {
  const fetchIncidents = () => {
    fetch('/api/live-incidents')
      .then(res => res.json())
      .then(data => {
        setIncidentData(data);
        setLastUpdated(new Date());
      })
      .catch(err => console.error("❌ Live incident fetch failed", err));
  };

  fetchIncidents();
  const intervalId = setInterval(fetchIncidents, 60 * 1000);
  return () => clearInterval(intervalId);
}, []);

  useEffect(() => {
  const map = mapRef.current;
  if (!map) return;

  

  fetchNOAAAlerts();
  const interval = setInterval(fetchNOAAAlerts, 300000); // Refresh every 5 min

  return () => clearInterval(interval);
}, []);

// ✅ Check if any NOAA alerts impact a facility location
const checkFacilityAlerts = (alerts, facilities) => {
  return facilities.filter((fac) => {
    const facLat = parseFloat(fac.latitude);
    const facLng = parseFloat(fac.longitude);
    return alerts.some((alert) => {
      const alertCoords = alert.geometry?.coordinates;
      if (!alertCoords) return false;

      // Handle Point geometry (NOAA sometimes gives single point)
      if (alert.geometry.type === 'Point') {
        const [lon, lat] = alertCoords;
        const dist = Math.sqrt((lat - facLat) ** 2 + (lon - facLng) ** 2);
        return dist < 0.5; // ~50km radius
      }

      // Handle Polygon geometry
      if (alert.geometry.type === 'Polygon') {
        return alert.geometry.coordinates[0].some(([lon, lat]) => {
          const dist = Math.sqrt((lat - facLat) ** 2 + (lon - facLng) ** 2);
          return dist < 0.5;
        });
      }

      return false;
    });
  });
};

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      <button
        className="absolute bottom-4 right-4 bg-white rounded shadow px-3 py-1 text-sm z-10 hover:bg-gray-100"
        onClick={() => setShowPanels(!showPanels)}
      >
        {showPanels ? 'Hide Panels' : 'Show Panels'}
      </button>
      {showPanels && (
  <>
    <div className="absolute top-2 left-2 bg-white rounded shadow p-2 text-xs z-10 space-y-1 max-w-[180px]">
  <div className="font-semibold mb-1">🛰️ Real-Time Feeds</div>
  
 {[
  ['earthquake-live', 'Live Earthquakes'],
  ['noaa-weather', 'NOAA Weather Alerts'],
  ['gdacs-alerts', 'GDACS Alerts']
].map(([id, label]) => (
  <button
    key={id}
    onClick={() => toggleLayer(id)}
    className={`w-full text-left px-2 py-1 rounded text-xs ${
      layerVisibility[id] ? 'bg-green-100 hover:bg-green-200' : 'bg-gray-200 hover:bg-gray-300'
    }`}
  >
    {layerVisibility[id] ? '✔' : '✖'} {label}
  </button>
))}

<div className="mt-2">
  <label className="flex items-center gap-2 text-xs">
    <input
      type="checkbox"
      checked={earthquakeMagFilter}
      onChange={() => {
        setEarthquakeMagFilter(prev => {
          const newValue = !prev;
          const map = mapRef.current;
          if (map && map.getLayer('earthquake-live')) {
            map.setFilter(
              'earthquake-live',
              newValue ? ['>=', ['get', 'mag'], 4] : ['>=', ['get', 'mag'], 0]
            );
          }
          return newValue;
        });
      }}
    />
    Only show M4+
  </label>
</div>

  <div className="font-semibold mt-2 mb-1">📡 Coming Soon</div>
  {[
    ['natural-hazard', 'Natural Hazard'],
    ['logistics-disruption', 'Logistics Disruption'],
    ['geopolitical-risk', 'Geopolitical Risk'],
    ['cyber-disruption', 'Cyber Disruption'],
    ['industrial-fire', 'Industrial Fire']
  ].map(([id, label]) => (
    <button
      key={id}
      onClick={() => toggleLayer(id)}
      className={`w-full text-left px-2 py-1 rounded text-xs text-gray-400 italic ${
        layerVisibility[id] ? 'bg-gray-100 hover:bg-gray-200' : 'bg-gray-200 hover:bg-gray-300'
      }`}
    >
      {layerVisibility[id] ? '✔' : '✖'} {label}
    </button>
  ))}
</div>

          <div className="absolute top-2 right-2 bg-white rounded shadow p-2 text-[10px] z-10 space-y-1 max-w-[160px] leading-tight">
  <div className="font-semibold mb-1 text-[11px]">🧭 Legend</div>

  <div className="flex items-center gap-1"><span className="text-[14px]">🌍</span> Earthquake (USGS)</div>

  <div className="font-semibold mt-2 text-[11px]">🌊 GDACS Alerts</div>
  <div className="flex items-center gap-1"><span className="text-[14px]">🌀</span> Cyclone</div>
  <div className="flex items-center gap-1"><span className="text-[14px]">🌊</span> Flood</div>
  <div className="flex items-center gap-1"><span className="text-[14px]">🌋</span> Volcano</div>
  <div className="flex items-center gap-1"><span className="text-[14px]">🌞</span> Drought</div>

  <div className="font-semibold mt-2 text-[11px]">🌪️ NOAA Alerts</div>
  <div className="flex items-center gap-1"><span className="text-[14px]">🌪️</span> Tornado</div>
  <div className="flex items-center gap-1"><span className="text-[14px]">❄️</span> Winter Storm</div>
  <div className="flex items-center gap-1"><span className="text-[14px]">🔥</span> Fire Weather</div>
  <div className="flex items-center gap-1"><span className="text-[14px]">🌡️</span> Heat Advisory</div>
</div>

        </>
      )}
      {lastUpdated && (
        <div className="absolute bottom-4 left-4 bg-white text-xs px-3 py-1 rounded shadow z-10">
          ⏱️ Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
