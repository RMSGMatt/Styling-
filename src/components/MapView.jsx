import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import Papa from 'papaparse';

mapboxgl.accessToken = 'pk.eyJ1IjoiZXRtc21hdHQiLCJhIjoiY204OTdkMDZmMDM1NDJ2cHk1M2FvcnkxbyJ9.t8NCNACusdhKWWVuWpYh9A';

const MAPBOX_STYLE_URL = 'mapbox://styles/etmsmatt/cm9oz0hdj00fe01rzdonjg51i';

export default function MapView({ onFacilityClick, locationsUrl }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!locationsUrl || mapRef.current) return;

    const initializeMap = async () => {
      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: MAPBOX_STYLE_URL,
        projection: 'globe',
        center: [0, 20],
        zoom: 1.2,
      });

      mapRef.current = map;

      map.on('style.load', () => {
        map.setFog({});
      });

      try {
        const res = await fetch(locationsUrl);
        const text = await res.text();
        const parsed = Papa.parse(text, { header: true });
        const facilities = parsed.data.filter(row =>
          row.Facility && row.Latitude && row.Longitude &&
          !isNaN(parseFloat(row.Latitude)) && !isNaN(parseFloat(row.Longitude))
        );

        facilities.forEach(fac => {
          const lat = parseFloat(fac.Latitude);
          const lon = parseFloat(fac.Longitude);
          if (isNaN(lat) || isNaN(lon)) return;

          const marker = new mapboxgl.Marker()
            .setLngLat([lon, lat])
            .setPopup(new mapboxgl.Popup({ offset: 25 }).setText(fac.Facility))
            .addTo(map);

          marker.getElement().style.cursor = 'pointer';
          marker.getElement().addEventListener('click', (e) => {
            e.stopPropagation();
            marker.togglePopup();
            if (onFacilityClick && fac.Facility) {
              onFacilityClick(fac.Facility);
            }
          });
        });
      } catch (err) {
        console.error("Error loading markers:", err);
      }
    };

    initializeMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [locationsUrl, onFacilityClick]);

  return <div ref={mapContainer} className="w-full h-full" />;
}
