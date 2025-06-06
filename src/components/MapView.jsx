import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import Papa from 'papaparse';

mapboxgl.accessToken = 'pk.eyJ1IjoiZXRtc21hdHQiLCJhIjoiY204OTdkMDZmMDM1NDJ2cHk1M2FvcnkxbyJ9.t8NCNACusdhKWWVuWpYh9A';

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
      fetch('/data/locations.csv')
        .then(res => res.text())
        .then(csvText => {
          Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              const facilities = results.data;

              facilities.forEach((fac) => {
                const name = fac.Facility?.trim() || fac.location?.trim() || fac.Site?.trim();
                const lat = parseFloat(fac.Latitude);
                const lon = parseFloat(fac.Longitude);
                if (!name || isNaN(lat) || isNaN(lon)) return;

                const rows = filteredRows.filter(row => row.Facility?.trim() === name);

                console.log("Facility from CSV:", name);
                console.log("Matching rows:", rows);

                if (!rows.length) return;

                // Optional override for debug only
                // const rows = [{}];

                const quantityColumn =
                  selectedOutputType === 'inventory' ? 'Initial Inventory' :
                  selectedOutputType === 'flow' ? 'Quantity Fulfilled' :
                  selectedOutputType === 'production' ? 'Quantity Produced' :
                  selectedOutputType === 'occurrence' ? 'Quantity Unmet' :
                  null;

                const total = rows.reduce((sum, r) => sum + (Number(r?.[quantityColumn]) || 0), 0);
                const skus = [...new Set(rows.map(r => r.SKU))];
                const dates = [...new Set(rows.map(r => r.Date))];
                const dateRange = dates.length ? `${dates[0]} to ${dates[dates.length - 1]}` : 'N/A';

                const popupContent = `
                  <strong>${name}</strong><br/>
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
                  if (onFacilityClick) onFacilityClick(name);
                });

                new mapboxgl.Marker(markerEl)
                  .setLngLat([lon, lat])
                  .setPopup(new mapboxgl.Popup().setHTML(popupContent))
                  .addTo(map);
              });
            }
          });
        });
    });

    return () => map.remove();
  }, [filteredRows, selectedOutputType, onFacilityClick]);

  return <div ref={mapContainer} className="w-full h-[600px]" />;
}
