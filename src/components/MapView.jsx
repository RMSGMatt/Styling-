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
  const [layerVisibility, setLayerVisibility] = useState({
    'natural-hazard': true,
    'logistics-disruption': true,
    'geopolitical-risk': true,
    'cyber-disruption': true,
    'industrial-fire': true,
    'earthquake-live': true,
    'gdacs-live': true
  });
  const [showPanels, setShowPanels] = useState(true);

  const toggleLayer = (layerId) => {
    const map = mapRef.current;
    if (!map) return;

    const isVisible = layerVisibility[layerId];
    map.setLayoutProperty(layerId, 'visibility', isVisible ? 'none' : 'visible');

    setLayerVisibility(prev => ({ ...prev, [layerId]: !prev[layerId] }));
  };

  useEffect(() => {
    fetch('/mock_incidents.json')
      .then(res => res.json())
      .then(setIncidentData)
      .catch(err => console.error("❌ Incident load failed", err));
  }, []);

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
      map.setFog({});

      map.addSource('earthquake-live', { type: 'geojson', data: USGS_FEED_URL });
      map.addLayer({
        id: 'earthquake-live',
        type: 'circle',
        source: 'earthquake-live',
        paint: {
          'circle-radius': 6,
          'circle-color': '#0ea5e9',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1
        }
      });

      map.addSource('gdacs-live', {
        type: 'geojson',
        data: '/api/gdacs-feed'
      });
      map.addLayer({
        id: 'gdacs-live',
        type: 'circle',
        source: 'gdacs-live',
        paint: {
          'circle-radius': 8,
          'circle-color': '#f43f5e',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1
        }
      });
      map.on('click', 'gdacs-live', (e) => {
        const props = e.features[0].properties;
        new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`
            <strong>${props.name}</strong><br/>
            ${props.description}<br/>
            <em>${props.date}</em>
          `)
          .addTo(map);
      });
      map.on('mouseenter', 'gdacs-live', () => map.getCanvas().style.cursor = 'pointer');
      map.on('mouseleave', 'gdacs-live', () => map.getCanvas().style.cursor = '');

      if (locationsUrl) {
        fetch(locationsUrl)
          .then(res => res.text())
          .then(text => {
            const parsed = Papa.parse(text, { header: true });
            const facilities = parsed.data.filter(row => row.Facility && row.Latitude && row.Longitude && row.Country && !isNaN(parseFloat(row.Latitude)) && !isNaN(parseFloat(row.Longitude)));

            const impactedCountries = incidentData?.features.map(f => f.properties.country?.trim().toLowerCase()).filter(Boolean);

            facilities.forEach(fac => {
              const lat = parseFloat(fac.Latitude);
              const lon = parseFloat(fac.Longitude);
              const facilityCountry = fac.Country?.trim().toLowerCase();
              const isImpacted = impactedCountries?.includes(facilityCountry);

              const markerEl = document.createElement('div');
              markerEl.className = 'facility-marker';
              markerEl.style.width = '12px';
              markerEl.style.height = '12px';
              markerEl.style.borderRadius = '50%';
              markerEl.style.backgroundColor = isImpacted ? '#dc2626' : '#1d4ed8';
              markerEl.style.border = '2px solid white';
              markerEl.style.position = 'relative';

              if (isImpacted) {
                const alertIcon = document.createElement('div');
                alertIcon.style.width = '6px';
                alertIcon.style.height = '6px';
                alertIcon.style.borderRadius = '50%';
                alertIcon.style.backgroundColor = 'yellow';
                alertIcon.style.position = 'absolute';
                alertIcon.style.top = '0';
                alertIcon.style.right = '0';
                markerEl.appendChild(alertIcon);
              }

              const marker = new mapboxgl.Marker(markerEl)
                .setLngLat([lon, lat])
                .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`<strong>${fac.Facility}</strong><br>${fac.Country}${isImpacted ? '<br><span style="color:red;">⚠ Impacted</span>' : ''}`))
                .addTo(map);

              marker.getElement().style.cursor = 'pointer';
              marker.getElement().addEventListener('click', (e) => {
                e.stopPropagation();
                marker.togglePopup();
                if (onFacilityClick && fac.Facility) onFacilityClick(fac.Facility);
              });
            });
          })
          .catch(err => console.error("❌ Facility marker load failed:", err));
      }

      if (incidentData) {
        map.addSource('incidents', {
          type: 'geojson',
          data: incidentData
        });

        const layerDefs = [
          { id: 'natural-hazard', label: 'Natural Hazard', color: '#e11d48' },
          { id: 'logistics-disruption', label: 'Logistics Disruption', color: '#facc15' },
          { id: 'geopolitical-risk', label: 'Geopolitical Risk', color: '#8b5cf6' },
          { id: 'cyber-disruption', label: 'Cyber Disruption', color: '#3b82f6' },
          { id: 'industrial-fire', label: 'Industrial Fire', color: '#fb923c' }
        ];

        layerDefs.forEach(({ id, label, color }) => {
          map.addLayer({
            id,
            type: 'circle',
            source: 'incidents',
            filter: ['==', ['get', 'type'], label],
            paint: {
              'circle-radius': 8,
              'circle-color': color,
              'circle-stroke-color': '#fff',
              'circle-stroke-width': 1
            }
          });
        });

        map.on('click', layerDefs.map(l => l.id), (e) => {
          const props = e.features[0].properties;
          new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`<strong>${props.type}</strong><br>${props.description}<br>Severity: ${props.severity}`)
            .addTo(map);
        });

        map.on('mouseenter', layerDefs.map(l => l.id), () => map.getCanvas().style.cursor = 'pointer');
        map.on('mouseleave', layerDefs.map(l => l.id), () => map.getCanvas().style.cursor = '');
      }
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [incidentData, locationsUrl, onFacilityClick]);

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
            <div className="font-semibold mb-1">🛰️ Layers</div>
            {[
              ['natural-hazard', 'Natural Hazard'],
              ['logistics-disruption', 'Logistics Disruption'],
              ['geopolitical-risk', 'Geopolitical Risk'],
              ['cyber-disruption', 'Cyber Disruption'],
              ['industrial-fire', 'Industrial Fire'],
              ['earthquake-live', 'Live Earthquakes'],
              ['gdacs-live', 'Live GDACS Hazards']
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
          </div>

          <div className="absolute top-2 right-2 bg-white rounded shadow p-2 text-xs z-10 space-y-1">
            <div className="flex items-center gap-2"><span className="w-3 h-3 bg-[#e11d48] rounded-full inline-block" /> Natural Hazard</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 bg-[#facc15] rounded-full inline-block" /> Logistics Disruption</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 bg-[#8b5cf6] rounded-full inline-block" /> Geopolitical Risk</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 bg-[#3b82f6] rounded-full inline-block" /> Cyber Disruption</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 bg-[#fb923c] rounded-full inline-block" /> Industrial Fire</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 bg-[#0ea5e9] rounded-full inline-block" /> Live Earthquakes</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 bg-[#f43f5e] rounded-full inline-block" /> Live GDACS Hazards</div>
          </div>
        </>
      )}
    </div>
  );
}
