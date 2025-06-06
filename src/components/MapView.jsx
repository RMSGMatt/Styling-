import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = 'pk.eyJ1IjoiZXRtc21hdHQiLCJhIjoiY204OTdkMDZmMDM1NDJ2cHk1M2FvcnkxbyJ9.t8NCNACusdhKWWVuWpYh9A';

const facilities = [
  { name: 'Novi, MI', lat: 42.4806, lon: -83.4755 },
  { name: 'Aichi, Japan', lat: 35.1802, lon: 136.9066 },
  { name: 'Stuttgart, Germany', lat: 48.7758, lon: 9.1829 },
  { name: 'Bangkok, Thailand', lat: 13.7563, lon: 100.5018 },
  { name: 'Pune, India', lat: 18.5204, lon: 73.8567 }
];

export default function MapView({ filteredRows = [], selectedOutputType = 'inventory', onFacilityClick }) {
  const mapContainer = useRef(null);

  useEffect(() => {
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/etmsmatt/cm9oz0hdj00fe01rzdonjg51i',
      projection: 'globe',
      center: [0, 20],
      zoom: 1.2
    });

    map.on('style.load', () => map.setFog({}));

    map.on('load', () => {
      facilities.forEach(fac => {
        const rows = filteredRows.filter(row => row.Facility === fac.name);
        if (!rows.length) return;

        const skus = [...new Set(rows.map(r => r.SKU))];
        const quantityColumn =
          selectedOutputType === 'inventory' ? 'Initial Inventory' :
          selectedOutputType === 'flow' ? 'Quantity Fulfilled' :
          selectedOutputType === 'production' ? 'Quantity Produced' :
          selectedOutputType === 'occurrence' ? 'Quantity Unmet' :
          null;

        const total = rows.reduce((sum, r) => sum + (Number(r?.[quantityColumn]) || 0), 0);
        const dates = [...new Set(rows.map(r => r.Date))];
        const dateRange = dates.length ? `${dates[0]} to ${dates[dates.length - 1]}` : 'N/A';

        const popupContent = `
          <strong>${fac.name}</strong><br/>
          Type: ${selectedOutputType}<br/>
          Total: ${total}<br/>
          SKUs: ${skus.join(', ')}<br/>
          Dates: ${dateRange}
        `;

        const markerEl = document.createElement('div');
        markerEl.className = 'custom-marker';
        markerEl.style.width = '16px';
        markerEl.style.height = '16px';
        markerEl.style.backgroundColor = '#2DD4BF';
        markerEl.style.border = '2px solid #fff';
        markerEl.style.borderRadius = '50%';
        markerEl.style.cursor = 'pointer';

        markerEl.addEventListener('click', () => {
          if (onFacilityClick) onFacilityClick(fac.name);
        });

        new mapboxgl.Marker(markerEl)
          .setLngLat([fac.lon, fac.lat])
          .setPopup(new mapboxgl.Popup().setHTML(popupContent))
          .addTo(map);
      });
    });

    return () => map.remove();
  }, [filteredRows, selectedOutputType, onFacilityClick]);

  return <div ref={mapContainer} className="w-full h-full" />;
}
