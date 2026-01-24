import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";

// Mapbox token
mapboxgl.accessToken =
  "pk.eyJ1IjoiZm9yYy1tYXBzIiwiYSI6ImNtMGpmZ3p0bDAwNm4ydHE2MGVvbXgxeWgifQ.R-xfGe6a5viJOl3Zf1xE4w";

// ✅ Always use backend base (prevents Vercel returning index.html for /api/*)
const API_BASE = (import.meta?.env?.VITE_API_BASE || "http://127.0.0.1:5000").replace(
  /\/$/,
  ""
);

const NOAA_ALERTS_URL = "https://api.weather.gov/alerts/active";
const GDACS_FEED_URL = `${API_BASE}/api/gdacs-feed`;
const LIVE_INCIDENTS_URL = `${API_BASE}/api/live-incidents`;

function getEmojiForGDACS(type) {
  const t = String(type || "").toLowerCase();
  if (t.includes("cyclone") || t.includes("storm")) return "🌀";
  if (t.includes("flood")) return "🌊";
  if (t.includes("earthquake")) return "🌍";
  if (t.includes("volcano")) return "🌋";
  if (t.includes("drought")) return "🌵";
  if (t.includes("wildfire") || t.includes("fire")) return "🔥";
  return "⚠️";
}

function getEmojiForNOAA(event) {
  const e = String(event || "").toLowerCase();
  if (e.includes("tornado")) return "🌪️";
  if (e.includes("thunderstorm")) return "⛈️";
  if (e.includes("flood")) return "🌊";
  if (e.includes("winter")) return "❄️";
  if (e.includes("heat")) return "🌡️";
  if (e.includes("fire")) return "🔥";
  if (e.includes("hurricane")) return "🌀";
  return "📣";
}

function getEmojiForIncident(type, severity) {
  const t = String(type || "").toLowerCase();
  const s = String(severity || "").toLowerCase();

  if (t.includes("fire")) return "🔥";
  if (t.includes("cyber")) return "🧑‍💻";
  if (t.includes("strike")) return "✊";
  if (t.includes("port")) return "⚓";
  if (t.includes("weather")) return "🌦️";

  if (s.includes("severe")) return "🚨";
  if (s.includes("moderate")) return "⚠️";
  return "📍";
}

async function safeFetchJson(url) {
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}: ${text.slice(0, 200)}`);
  }

  if (!contentType.toLowerCase().includes("application/json")) {
    // This is the exact failure you were seeing: HTML returned instead of JSON.
    throw new Error(
      `Non-JSON response from ${url}. content-type=${contentType}. First chars: ${text.slice(
        0,
        40
      )}`
    );
  }

  return JSON.parse(text);
}

export function MapView({
  locationsUrl,
  onFacilitySelect,
  height = "600px",
  setMapInstance,
  // these toggles exist on your ControlTower; we honor what’s passed
  showLiveHazards = true,
  showLogistics = true,
  showIncidents = true, // ✅ this will control /api/live-incidents markers
  showNOAA = true,
  showGDACS = true,
}) {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);

  // marker refs
  const noaaMarkersRef = useRef([]);
  const gdacsMarkersRef = useRef([]);
  const incidentMarkersRef = useRef([]);
  const facilityMarkersRef = useRef([]);

  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const clearMarkers = (ref) => {
    try {
      ref.current.forEach((m) => m.remove());
    } catch (_) {}
    ref.current = [];
  };

  // -----------------------------
  // Feed fetchers
  // -----------------------------
  const fetchNOAAAlerts = async () => {
    if (!mapRef.current) return;

    try {
      const data = await safeFetchJson(NOAA_ALERTS_URL);
      if (!data?.features || !Array.isArray(data.features)) return;

      clearMarkers(noaaMarkersRef);

      data.features.forEach((f) => {
        const p = f?.properties || {};
        const event = p.event || "Alert";
        const desc = p.headline || p.description || "";
        const emoji = getEmojiForNOAA(event);

        // weather.gov alerts can be polygon/multipolygon; try best effort to get a point
        let coord = null;

        // If Point:
        if (f?.geometry?.type === "Point" && Array.isArray(f.geometry.coordinates)) {
          coord = f.geometry.coordinates;
        }

        // If Polygon/MultiPolygon: grab first coordinate of first ring as fallback
        if (!coord && f?.geometry?.coordinates) {
          const c = f.geometry.coordinates;
          // MultiPolygon -> c[0][0][0]
          if (Array.isArray(c?.[0]?.[0]?.[0])) coord = c[0][0][0];
          // Polygon -> c[0][0]
          else if (Array.isArray(c?.[0]?.[0])) coord = c[0][0];
        }

        if (!coord || coord.length < 2) return;

        const el = document.createElement("div");
        el.style.fontSize = "20px";
        el.style.cursor = "pointer";
        el.textContent = emoji;

        const popup = new mapboxgl.Popup({ offset: 12 }).setHTML(
          `<div style="font-size:12px;max-width:240px;">
             <div style="font-weight:700;margin-bottom:6px;">${emoji} ${event}</div>
             <div style="opacity:0.9;">${desc}</div>
           </div>`
        );

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat(coord)
          .setPopup(popup)
          .addTo(mapRef.current);

        noaaMarkersRef.current.push(marker);
      });
    } catch (err) {
      console.error("❌ NOAA refresh failed:", err);
    }
  };

  const fetchGDACSAlerts = async () => {
    if (!mapRef.current) return;

    try {
      const data = await safeFetchJson(GDACS_FEED_URL);
      if (!data?.features || !Array.isArray(data.features)) return;

      clearMarkers(gdacsMarkersRef);

      data.features.forEach((f) => {
        const props = f?.properties || {};
        const name = props.name || "GDACS Alert";
        const type = props.type || "Alert";
        const desc = props.description || "";
        const emoji = getEmojiForGDACS(type);

        const geom = f?.geometry || {};
        if (geom.type !== "Point" || !Array.isArray(geom.coordinates)) return;
        const [lng, lat] = geom.coordinates;
        if (typeof lng !== "number" || typeof lat !== "number") return;

        const el = document.createElement("div");
        el.style.fontSize = "20px";
        el.style.cursor = "pointer";
        el.textContent = emoji;

        const popup = new mapboxgl.Popup({ offset: 12 }).setHTML(
          `<div style="font-size:12px;max-width:240px;">
             <div style="font-weight:700;margin-bottom:6px;">${emoji} ${name}</div>
             <div style="opacity:0.9;"><b>Type:</b> ${type}</div>
             <div style="opacity:0.9;margin-top:6px;">${desc}</div>
           </div>`
        );

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([lng, lat])
          .setPopup(popup)
          .addTo(mapRef.current);

        gdacsMarkersRef.current.push(marker);
      });
    } catch (err) {
      console.error("❌ GDACS refresh failed:", err);
    }
  };

  const fetchLiveIncidents = async () => {
    if (!mapRef.current) return;

    try {
      const data = await safeFetchJson(LIVE_INCIDENTS_URL);
      if (!data?.features || !Array.isArray(data.features)) return;

      clearMarkers(incidentMarkersRef);

      data.features.forEach((f) => {
        const props = f?.properties || {};
        const type = props.type || "incident";
        const severity = props.severity || "unknown";
        const desc = props.description || "";
        const emoji = getEmojiForIncident(type, severity);

        const geom = f?.geometry || {};
        if (geom.type !== "Point" || !Array.isArray(geom.coordinates)) return;
        const [lng, lat] = geom.coordinates;
        if (typeof lng !== "number" || typeof lat !== "number") return;

        const el = document.createElement("div");
        el.style.fontSize = "20px";
        el.style.cursor = "pointer";
        el.textContent = emoji;

        const popup = new mapboxgl.Popup({ offset: 12 }).setHTML(
          `<div style="font-size:12px;max-width:240px;">
             <div style="font-weight:700;margin-bottom:6px;">${emoji} ${String(type).toUpperCase()}</div>
             <div style="opacity:0.9;"><b>Severity:</b> ${severity}</div>
             <div style="opacity:0.9;margin-top:6px;">${desc}</div>
           </div>`
        );

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([lng, lat])
          .setPopup(popup)
          .addTo(mapRef.current);

        incidentMarkersRef.current.push(marker);
      });
    } catch (err) {
      console.error("❌ Live incident fetch failed:", err);
    }
  };

  // -----------------------------
  // Init map once
  // -----------------------------
  useEffect(() => {
    if (mapRef.current) return;

    console.log("🧭 [MapView] Creating new Mapbox instance...");

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [0, 20],
      zoom: 1.4,
      projection: "globe",
    });

    mapRef.current = map;
    if (typeof setMapInstance === "function") setMapInstance(map);

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("style.load", () => {
      try {
        map.setFog({});
      } catch (_) {}
    });

    return () => {
      console.log("🧭 [MapView] Destroying Mapbox instance");
      try {
        clearMarkers(noaaMarkersRef);
        clearMarkers(gdacsMarkersRef);
        clearMarkers(incidentMarkersRef);
        clearMarkers(facilityMarkersRef);
      } catch (_) {}
      map.remove();
      mapRef.current = null;
    };
  }, [setMapInstance]);

  // -----------------------------
  // Feed refresh loops (controlled by toggles)
  // -----------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    let stopped = false;

    const run = async () => {
      if (stopped) return;

      // Only pull feeds if the UI says they’re on
      if (showNOAA) await fetchNOAAAlerts();
      else clearMarkers(noaaMarkersRef);

      if (showGDACS) await fetchGDACSAlerts();
      else clearMarkers(gdacsMarkersRef);

      if (showIncidents) await fetchLiveIncidents();
      else clearMarkers(incidentMarkersRef);

      setLastUpdatedAt(new Date().toISOString());
    };

    // initial run
    run();

    // refresh interval
    const interval = setInterval(run, 60 * 1000);

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [showNOAA, showGDACS, showIncidents, showLiveHazards, showLogistics]);

  // -----------------------------
  // Facilities from CSV
  // -----------------------------
  const renderFacilitiesFromCsv = (map, csvText) => {
    if (!csvText || typeof csvText !== "string") return;

    console.log("📄 Raw CSV text:", csvText.slice(0, 300));

    const rows = csvText
      .split("\n")
      .map((r) => r.trim())
      .filter(Boolean);

    if (rows.length < 2) return;

    const header = rows[0].split(",").map((h) => h.trim().toLowerCase());

    const latIdx =
      header.indexOf("latitude") !== -1 ? header.indexOf("latitude") : header.indexOf("lat");
    const lngIdx =
      header.indexOf("longitude") !== -1 ? header.indexOf("longitude") : header.indexOf("lng");
    const nameIdx =
      header.indexOf("facility") !== -1
        ? header.indexOf("facility")
        : header.indexOf("name");

    if (latIdx < 0 || lngIdx < 0) {
      console.warn("⚠️ [MapView] CSV missing latitude/longitude columns");
      return;
    }

    const facilities = rows.slice(1).map((line, idx) => {
      const cols = line.split(",").map((c) => c.trim());
      const lat = parseFloat(cols[latIdx]);
      const lng = parseFloat(cols[lngIdx]);
      const facility = cols[nameIdx] || `Facility ${idx + 1}`;
      return { id: idx + 1, lat, lng, facility };
    });

    console.log("📌 Parsed facility rows:", facilities);

    let count = 0;
    const bounds = new mapboxgl.LngLatBounds();

    facilities.forEach((f) => {
      if (!Number.isFinite(f.lat) || !Number.isFinite(f.lng)) return;

      const el = document.createElement("div");
      el.style.width = "12px";
      el.style.height = "12px";
      el.style.borderRadius = "50%";
      el.style.background = "#8BFFB5";
      el.style.border = "2px solid #0b3d2c";
      el.style.boxShadow = "0 0 10px rgba(139,255,181,0.6)";
      el.style.cursor = "pointer";

      const popup = new mapboxgl.Popup({ offset: 12 }).setHTML(
        `<div style="font-size:12px;"><b>${f.facility}</b><br/>${f.lat.toFixed(
          3
        )}, ${f.lng.toFixed(3)}</div>`
      );

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([f.lng, f.lat])
        .setPopup(popup)
        .addTo(map);

      el.addEventListener("click", () => {
        if (typeof onFacilitySelect === "function") onFacilitySelect(f.id);
      });

      facilityMarkersRef.current.push(marker);
      bounds.extend([f.lng, f.lat]);
      count++;
    });

    if (count > 0) {
      console.log(`✅ [MapView] Added ${count} facility markers`);
      map.fitBounds(bounds, { padding: 80, duration: 1000 });
    }
  };

  // Reload facilities whenever locationsUrl changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !locationsUrl) {
      console.log("⚠️ [MapView] Skipping reload — map not ready or URL missing:", locationsUrl);
      return;
    }

    const doReload = async () => {
      try {
        clearMarkers(facilityMarkersRef);
        const csvUrl = `${locationsUrl}?v=${Date.now()}`;
        console.log("🌐 Fetching location CSV from:", csvUrl);

        const res = await fetch(csvUrl);
        const text = await res.text();
        renderFacilitiesFromCsv(map, text);
      } catch (err) {
        console.error("❌ [MapView] Facility reload failed:", err);
      }
    };

    // if style not loaded yet, wait once
    if (!map.isStyleLoaded()) {
      console.log("⏳ [MapView] Style not loaded yet, queuing facility reload for:", locationsUrl);
      const handler = () => {
        doReload();
        map.off("style.load", handler);
      };
      map.on("style.load", handler);
      return;
    }

    doReload();
  }, [locationsUrl]);

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-full rounded-lg overflow-hidden border border-gray-300"
      style={{ height }}
      data-last-updated={lastUpdatedAt || ""}
    />
  );
}

export default React.memo(MapView);
