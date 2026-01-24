// src/components/MapView.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";

/* ============================================================================
   MAPBOX TOKEN — MUST BE SET AT MODULE LOAD
   ============================================================================ */
const MAPBOX_TOKEN =
  import.meta?.env?.VITE_MAPBOX_TOKEN ||
  import.meta?.env?.VITE_MAPBOX_ACCESS_TOKEN ||
  "";

if (!MAPBOX_TOKEN) {
  console.error("❌ Mapbox token missing (VITE_MAPBOX_TOKEN). Map cannot load.");
} else {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

/* ============================================================================
   SAFE JSON HELPER
   ============================================================================ */
function safeJson(res) {
  return res
    .json()
    .catch(async () => ({ _raw: await res.text().catch(() => "") }));
}

/* ============================================================================
   MAPVIEW COMPONENT
   ============================================================================ */
export default function MapView({
  locationsUrl,
  onFacilitySelect,
  height = "560px",
}) {
  const API_BASE = useMemo(
    () =>
      (import.meta?.env?.VITE_API_BASE || "http://127.0.0.1:5000").replace(
        /\/$/,
        ""
      ),
    []
  );

  const apiUrl = (path) =>
    `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  // Marker refs
  const facilityMarkersRef = useRef([]);
  const gdacsMarkersRef = useRef([]);
  const liveMarkersRef = useRef([]);
  const noaaMarkersRef = useRef([]);

  const [lastUpdated, setLastUpdated] = useState(null);
  const [layerVisibility, setLayerVisibility] = useState({
    facilities: true,
    gdacs: true,
    live: true,
    noaa: true,
  });

  /* ============================================================================
     EMOJI HELPERS
     ============================================================================ */
  const emojiGDACS = (p = {}) => {
    const t = String(p.type || p.eventtype || "").toLowerCase();
    if (t.includes("earthquake")) return "🌍";
    if (t.includes("flood")) return "🌊";
    if (t.includes("cyclone") || t.includes("storm")) return "🌀";
    if (t.includes("fire")) return "🔥";
    if (t.includes("volcano")) return "🌋";
    return "⚠️";
  };

  const emojiNOAA = (p = {}) => {
    const e = String(p.event || "").toLowerCase();
    if (e.includes("tornado")) return "🌪️";
    if (e.includes("flood")) return "🌊";
    if (e.includes("winter") || e.includes("snow")) return "❄️";
    if (e.includes("hurricane")) return "🌀";
    if (e.includes("fire")) return "🔥";
    return "⚠️";
  };

  const emojiLive = (p = {}) => {
    const t = String(p.type || "").toLowerCase();
    if (t.includes("fire")) return "🔥";
    if (t.includes("cyber")) return "🧑‍💻";
    if (t.includes("strike")) return "✊";
    if (t.includes("port")) return "⚓";
    return "⚠️";
  };

  /* ============================================================================
     MARKER UTILITIES
     ============================================================================ */
  const clearMarkers = (ref) => {
    ref.current.forEach((m) => {
      try {
        m.remove();
      } catch {}
    });
    ref.current = [];
  };

  const renderGeoMarkers = (map, features, ref, emojiFn, titleFn) => {
    clearMarkers(ref);
    if (!Array.isArray(features)) return;

    features.forEach((f) => {
      try {
        const geom = f.geometry;
        const props = f.properties || {};
        if (!geom) return;

        let coords = null;
        if (geom.type === "Point") coords = geom.coordinates;
        else if (geom.type === "Polygon")
          coords = geom.coordinates?.[0]?.[0];
        else if (geom.type === "MultiPolygon")
          coords = geom.coordinates?.[0]?.[0]?.[0];

        if (!coords) return;

        const [lng, lat] = coords.map(Number);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        const el = document.createElement("div");
        el.textContent = emojiFn(props);
        el.style.fontSize = "20px";
        el.style.cursor = "pointer";

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([lng, lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 18 }).setHTML(
              `<div style="max-width:260px">
                 <div style="font-weight:800;color:#1D625B">
                   ${titleFn(props)}
                 </div>
                 <div style="font-size:12px;color:#334155">
                   ${props.description || props.headline || ""}
                 </div>
               </div>`
            )
          )
          .addTo(map);

        ref.current.push(marker);
      } catch (e) {
        console.warn("Marker render failed:", e);
      }
    });
  };

  /* ============================================================================
     FETCHERS
     ============================================================================ */
  const fetchNOAA = async () => {
    const map = mapRef.current;
    if (!map || !layerVisibility.noaa) {
      clearMarkers(noaaMarkersRef);
      return;
    }

    const res = await fetch("https://api.weather.gov/alerts/active", {
      headers: { Accept: "application/geo+json" },
    });
    const data = await safeJson(res);
    renderGeoMarkers(
      map,
      data?.features || [],
      noaaMarkersRef,
      emojiNOAA,
      (p) => `NOAA • ${p.event || "Alert"}`
    );
  };

  const fetchGDACS = async () => {
    const map = mapRef.current;
    if (!map || !layerVisibility.gdacs) {
      clearMarkers(gdacsMarkersRef);
      return;
    }

    const res = await fetch(apiUrl("/api/gdacs-feed"));
    const data = await safeJson(res);
    if (!res.ok) return;

    renderGeoMarkers(
      map,
      data?.features || [],
      gdacsMarkersRef,
      emojiGDACS,
      (p) => `GDACS • ${p.name || p.type || "Event"}`
    );
  };

  const fetchLive = async () => {
    const map = mapRef.current;
    if (!map || !layerVisibility.live) {
      clearMarkers(liveMarkersRef);
      return;
    }

    const res = await fetch(apiUrl("/api/live-incidents"));
    const data = await safeJson(res);
    if (!res.ok) return;

    renderGeoMarkers(
      map,
      data?.features || [],
      liveMarkersRef,
      emojiLive,
      (p) => `Incident • ${String(p.type || "EVENT").toUpperCase()}`
    );
  };

  /* ============================================================================
     MAP INIT
     ============================================================================ */
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (!mapboxgl.accessToken) return;

    if (mapRef.current) {
      try {
        mapRef.current.remove();
      } catch {}
      mapRef.current = null;
    }

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style:
        import.meta?.env?.VITE_MAPBOX_STYLE ||
        "mapbox://styles/mapbox/light-v11",
      center: [-95, 37],
      zoom: 3,
    });

    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", async () => {
      await fetchGDACS();
      await fetchLive();
      await fetchNOAA();
      setLastUpdated(new Date().toLocaleTimeString());
    });

    return () => {
      try {
        map.remove();
      } catch {}
      mapRef.current = null;
    };
  }, [API_BASE]);

  /* ============================================================================
     PERIODIC REFRESH
     ============================================================================ */
  useEffect(() => {
    const id = setInterval(async () => {
      await fetchGDACS();
      await fetchLive();
      await fetchNOAA();
      setLastUpdated(new Date().toLocaleTimeString());
    }, 60_000);
    return () => clearInterval(id);
  }, [layerVisibility]);

  /* ============================================================================
     RENDER
     ============================================================================ */
  return (
    <div className="w-full">
      <div className="text-xs text-gray-500 mb-1">
        Map Feeds • Updated {lastUpdated || "--"}
      </div>

      <div
        ref={mapContainerRef}
        className="w-full rounded-2xl border border-[#D8E5DD]"
        style={{ height }}
      />
    </div>
  );
}
