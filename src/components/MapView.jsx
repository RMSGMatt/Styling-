// src/components/MapView.jsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import mapboxgl from "mapbox-gl";
import { getApiBase } from "../config/apiBase";

/* ============================================================================
   0) MAPBOX TOKEN — SET ONCE AT MODULE LOAD
   ============================================================================ */
console.log("🧭 MapView.jsx MOUNTED");

// ✅ Capture Vite env once (and expose for debugging in prod)
const VITE_ENV = import.meta?.env || {};
if (typeof window !== "undefined") {
  window.__FORC_VITE_ENV__ = VITE_ENV; // <- lets you inspect in DevTools safely
}

const MAPBOX_TOKEN =
  VITE_ENV.VITE_MAPBOX_TOKEN || VITE_ENV.VITE_MAPBOX_ACCESS_TOKEN || "";

console.log("🧭 MapView env check:", {
  MODE: VITE_ENV.MODE,
  HAS_VITE_MAPBOX_TOKEN: Boolean(VITE_ENV.VITE_MAPBOX_TOKEN),
  HAS_VITE_MAPBOX_ACCESS_TOKEN: Boolean(VITE_ENV.VITE_MAPBOX_ACCESS_TOKEN),
  TOKEN_LEN: (VITE_ENV.VITE_MAPBOX_TOKEN || VITE_ENV.VITE_MAPBOX_ACCESS_TOKEN || "")
    .length,
  MAPBOX_KEYS: Object.keys(VITE_ENV).filter((k) => k.toLowerCase().includes("mapbox")),
});

if (!MAPBOX_TOKEN) {
  console.error("❌ Mapbox token missing (VITE_MAPBOX_TOKEN). Map cannot load.");
} else {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}


/* ============================================================================
   1) SAFE JSON HELPER
   ============================================================================ */
function safeJson(res) {
  return res
    .json()
    .catch(async () => ({ _raw: await res.text().catch(() => "") }));
}

/* ============================================================================
   2) CSV PARSER (LIGHTWEIGHT)
   ============================================================================ */
function parseCSV(text) {
  const lines = (text || "").trim().split(/\r?\n/);
  if (!lines.length) return [];
  const header = lines[0].split(",").map((s) => s.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((s) => s.trim());
    const row = {};
    header.forEach((h, i) => (row[h] = cols[i]));
    return row;
  });
}

/* ============================================================================
   3) SMALL UTIL: SAFE FIT BOUNDS
   ============================================================================ */
function fitToBoundsSafe(map, bounds, padding = 80) {
  try {
    map.fitBounds(bounds, {
      padding,
      duration: 650,
      maxZoom: 3.5,
    });
  } catch {}
}

/* ============================================================================
   4) MAIN COMPONENT
   ============================================================================ */
export default function MapView({
  locationsUrl,
  height = 520,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  const facilityMarkersRef = useRef([]);
  const gdacsMarkersRef = useRef([]);
  const liveMarkersRef = useRef([]);
  const noaaMarkersRef = useRef([]);
  const usgsMarkersRef = useRef([]);

  const facilityBoundsRef = useRef(null);

  const [lastUpdated, setLastUpdated] = useState("");

  const [layerVisibility, setLayerVisibility] = useState({
    facilities: true,
    usgs: true,
    noaa: true,
    gdacs: true,
    live: true,
  });

  const apiBase = useMemo(() => getApiBase(), []);
  const apiUrl = useCallback(
    (path) => `${apiBase}${path.startsWith("/") ? path : `/${path}`}`,
    [apiBase]
  );

  /* ============================================================================
     5) MARKER HELPERS
     ============================================================================ */
  const clearMarkers = (ref) => {
    try {
      (ref.current || []).forEach((m) => m.remove());
    } catch {}
    ref.current = [];
  };

  const recenterToGlobe = () => {
    const map = mapRef.current;
    if (!map) return;
    try {
      map.easeTo({
        center: [0, 35],
        zoom: 0.45,
        pitch: 0,
        bearing: 0,
        duration: 650,
      });
    } catch {}
  };

  /* ============================================================================
     6) EMOJI HELPERS
     ============================================================================ */
  const getEmojiForGDACS = (p) => {
    const t = String(p?.eventtype || p?.type || p?.hazard || "")
      .toLowerCase()
      .trim();

    if (t.includes("earthquake")) return "🌍";
    if (t.includes("flood")) return "🌊";
    if (t.includes("cyclone") || t.includes("storm")) return "🌀";
    if (t.includes("wildfire") || t.includes("fire")) return "🔥";
    if (t.includes("volcano")) return "🌋";
    if (t.includes("drought")) return "🌾";
    return "⚠️";
  };

  // 🧨 USGS Earthquakes — emoji based on magnitude
  const getEmojiForUSGSQuake = (p) => {
    const mag = Number(p?.mag ?? p?.magnitude ?? 0);
    if (mag >= 6) return "🔴";
    if (mag >= 5) return "🟠";
    if (mag >= 4) return "🟡";
    return "🟢";
  };

  const getTitleForUSGSQuake = (p) => {
    const mag = Number(p?.mag ?? p?.magnitude ?? 0);
    const place = String(p?.place || p?.title || "Earthquake");
    return `USGS • M${Number.isFinite(mag) ? mag.toFixed(1) : "?"} • ${place}`;
  };

  const getEmojiForNOAA = (p) => {
    const e = String(p?.event || p?.headline || "").toLowerCase();
    if (e.includes("tornado")) return "🌪️";
    if (e.includes("severe")) return "⛈️";
    if (e.includes("flood")) return "🌊";
    if (e.includes("winter")) return "❄️";
    if (e.includes("fire")) return "🔥";
    if (e.includes("hurricane")) return "🌀";
    return "⚠️";
  };

  const getEmojiForLiveIncident = (p) => {
    const t = String(p?.type || p?.category || "").toLowerCase();
    if (t.includes("earthquake")) return "🌍";
    if (t.includes("flood")) return "🌊";
    if (t.includes("storm")) return "🌀";
    if (t.includes("fire")) return "🔥";
    if (t.includes("cyber")) return "💻";
    return "🔥";
  };

  /* ============================================================================
     7) GENERIC GEOJSON MARKER RENDERER
     ============================================================================ */
  const renderPointMarkersFromGeoJSON = useCallback(
    (map, features, destRef, emojiFn, titleFn) => {
      clearMarkers(destRef);
      if (!Array.isArray(features) || !features.length) return;

      features.forEach((f) => {
        try {
          const geom = f?.geometry;
          const props = f?.properties || {};
          if (!geom) return;

          let coords = null;

          if (geom.type === "Point" && Array.isArray(geom.coordinates)) {
            coords = geom.coordinates;
          } else if (geom.type === "Polygon" && geom.coordinates?.[0]?.[0]) {
            coords = geom.coordinates[0][0];
          } else if (
            geom.type === "MultiPolygon" &&
            geom.coordinates?.[0]?.[0]?.[0]
          ) {
            coords = geom.coordinates[0][0][0];
          }

          if (!coords || coords.length < 2) return;

          const [lng, lat] = coords.map(Number);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

          const el = document.createElement("div");
          el.style.fontSize = "20px";
          el.style.cursor = "pointer";
          el.textContent = emojiFn(props);

          const title = titleFn(props);

          const marker = new mapboxgl.Marker({ element: el })
            .setLngLat([lng, lat])
            .setPopup(
              new mapboxgl.Popup({ offset: 18 }).setHTML(
                `<div style="max-width:260px">
                   <div style="font-weight:800;color:#1D625B;margin-bottom:4px">${title}</div>
                   <div style="font-size:12px;line-height:1.35;color:#334155">
                     ${props.description || props.headline || props.areaDesc || ""}
                   </div>
                 </div>`
              )
            )
            .addTo(map);

          destRef.current.push(marker);
        } catch (e) {
          console.warn("Marker render failed:", e);
        }
      });
    },
    []
  );

  /* ============================================================================
     8) FACILITIES RENDERER
     ============================================================================ */
  const renderFacilitiesFromCsv = useCallback((map, csvText) => {
    clearMarkers(facilityMarkersRef);
    facilityBoundsRef.current = null;

    const rows = parseCSV(csvText);
    if (!rows.length) return;

    const bounds = new mapboxgl.LngLatBounds();

    rows.forEach((r) => {
      const lat = Number(r.lat || r.latitude);
      const lng = Number(r.lng || r.lon || r.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      bounds.extend([lng, lat]);

      const el = document.createElement("div");
      el.style.fontSize = "18px";
      el.style.cursor = "pointer";
      el.textContent = "🏭";

      const name =
        r.facility ||
        r.name ||
        r.location ||
        r.site ||
        "Facility";

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([lng, lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 18 }).setHTML(
            `<div style="max-width:240px">
               <div style="font-weight:800;color:#1D625B;margin-bottom:4px">${name}</div>
               <div style="font-size:12px;line-height:1.35;color:#334155">
                 ${r.region ? `Region: ${r.region}<br/>` : ""}
                 ${r.country ? `Country: ${r.country}` : ""}
               </div>
             </div>`
          )
        )
        .addTo(map);

      facilityMarkersRef.current.push(marker);
    });

    if (!bounds.isEmpty()) {
      facilityBoundsRef.current = bounds;
    }
  }, []);

  /* ============================================================================
     9) FETCHERS — ALWAYS USE mapRef.current (no re-init)
     ============================================================================ */
  const fetchNOAAAlerts = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;

    if (!layerVisibility.noaa) {
      clearMarkers(noaaMarkersRef);
      return;
    }

    try {
      const res = await fetch("https://api.weather.gov/alerts/active");
      const data = await safeJson(res);

      if (!res.ok) {
        console.error("❌ NOAA alerts HTTP", res.status, data);
        return;
      }

      const feats = data?.features || [];
      renderPointMarkersFromGeoJSON(
        map,
        feats,
        noaaMarkersRef,
        (p) => getEmojiForNOAA(p),
        (p) => `NOAA • ${String(p.event || "Alert")}`
      );
    } catch (e) {
      console.error("❌ NOAA alerts fetch failed", e);
    }
  }, [layerVisibility.noaa, renderPointMarkersFromGeoJSON]);

  const fetchGDACS = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;

    if (!layerVisibility.gdacs) {
      clearMarkers(gdacsMarkersRef);
      return;
    }

    try {
      const res = await fetch(apiUrl("/api/gdacs-feed"));
      const data = await safeJson(res);

      if (!res.ok) {
        console.error("❌ GDACS HTTP", res.status, data);
        return;
      }

      const feats = data?.features || [];
      renderPointMarkersFromGeoJSON(
        map,
        feats,
        gdacsMarkersRef,
        (p) => getEmojiForGDACS(p),
        (p) => `GDACS • ${String(p.eventtype || p.type || "Event")}`
      );
    } catch (e) {
      console.error("❌ GDACS fetch failed", e);
    }
  }, [apiUrl, layerVisibility.gdacs, renderPointMarkersFromGeoJSON]);

  const fetchLiveIncidents = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;

    if (!layerVisibility.live) {
      clearMarkers(liveMarkersRef);
      return;
    }

    try {
      const res = await fetch(apiUrl("/api/live-incidents"));
      const data = await safeJson(res);

      if (!res.ok) {
        console.error("❌ Live incidents HTTP", res.status, data);
        return;
      }

      const feats = data?.features || [];
      renderPointMarkersFromGeoJSON(
        map,
        feats,
        liveMarkersRef,
        (p) => getEmojiForLiveIncident(p),
        (p) => `Incident • ${String(p.type || "event").toUpperCase()}`
      );
    } catch (e) {
      console.error("❌ Live incident fetch failed", e);
    }
  }, [apiUrl, layerVisibility.live, renderPointMarkersFromGeoJSON]);

  // 🌐 USGS Earthquakes (GeoJSON feed) — independent of backend
  const fetchUSGSEarthquakes = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;

    if (!layerVisibility.usgs) {
      clearMarkers(usgsMarkersRef);
      return;
    }

    try {
      // all quakes in the past day (good default for demos)
      const res = await fetch(
        "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson"
      );
      const data = await safeJson(res);

      if (!res.ok) {
        console.error("❌ USGS earthquakes HTTP", res.status, data);
        return;
      }

      const feats = data?.features || [];

      // USGS places useful fields under properties (mag/place/time)
      renderPointMarkersFromGeoJSON(
        map,
        feats,
        usgsMarkersRef,
        (p) => getEmojiForUSGSQuake(p),
        (p) => getTitleForUSGSQuake(p)
      );
    } catch (e) {
      console.error("❌ USGS earthquakes fetch failed", e);
    }
  }, [layerVisibility.usgs, renderPointMarkersFromGeoJSON]);

  /* ============================================================================
     10) MAP INIT — RUNS EXACTLY ONCE
     ============================================================================ */
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapboxgl.accessToken) {
      console.error(
        "❌ Mapbox token missing (VITE_MAPBOX_TOKEN). Map cannot load."
      );
      return;
    }

    // Prevent double-mount issues
    if (mapRef.current) return;

    const MAP_STYLE =
      import.meta?.env?.VITE_MAPBOX_STYLE ||
      "mapbox://styles/mapbox/satellite-streets-v12";

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,

      // 🌍 Full globe framing (initial)
      center: [0, 35],
      zoom: 0.45,
      pitch: 0,
      bearing: 0,
    });

    mapRef.current = map;
    window.__FORC_MAP__ = map;

    map.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: true }),
      "top-right"
    );

    const onLoad = async () => {
      try {
        map.setProjection("globe");
        map.setRenderWorldCopies(false);

        map.setFog({
          range: [0.8, 8],
          "horizon-blend": 0.25,
          color: "#0b1020",
          "high-color": "#1b2b4f",
          "space-color": "#000000",
        });

        map.setPadding({
          top: 10,
          bottom: 190,
          left: 10,
          right: 10,
        });

        setTimeout(() => {
          map.resize();
          map.easeTo({
            center: [0, 35],
            zoom: 0.45,
            pitch: 0,
            bearing: 0,
            duration: 0,
          });
        }, 0);
      } catch (err) {
        console.warn("Map globe init failed:", err);
      }

      // initial pulls
      await fetchGDACS();
      await fetchUSGSEarthquakes();
      await fetchLiveIncidents();
      await fetchNOAAAlerts();
      setLastUpdated(new Date().toLocaleTimeString());

      // facilities
      if (locationsUrl && layerVisibility.facilities) {
        try {
          const csvUrl = `${locationsUrl}?v=${Date.now()}`;
          const res = await fetch(csvUrl);
          const txt = await res.text();
          renderFacilitiesFromCsv(map, txt);
        } catch (e) {
          console.error("❌ Facility CSV load failed:", e);
        }
      }
    };

    map.on("load", onLoad);

    return () => {
      try {
        map.off("load", onLoad);
      } catch {}
      try {
        map.remove();
      } catch {}
      mapRef.current = null;
      try {
        delete window.__FORC_MAP__;
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ============================================================================
     11) FACILITIES RELOAD ON URL/TOGGLE CHANGE
     ============================================================================ */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!layerVisibility.facilities) {
      clearMarkers(facilityMarkersRef);
      return;
    }
    if (!locationsUrl) return;

    const run = async () => {
      try {
        const csvUrl = `${locationsUrl}?v=${Date.now()}`;
        const res = await fetch(csvUrl);
        const txt = await res.text();
        renderFacilitiesFromCsv(map, txt);
      } catch (e) {
        console.error("❌ Facility reload failed:", e);
      }
    };

    if (!map.isStyleLoaded()) {
      const handler = () => {
        run();
        map.off("style.load", handler);
      };
      map.on("style.load", handler);
      return;
    }

    run();
  }, [locationsUrl, layerVisibility.facilities, renderFacilitiesFromCsv]);

  /* ============================================================================
     12) FEED RELOAD ON TOGGLE CHANGE
     ============================================================================ */
  useEffect(() => {
    fetchGDACS();
  }, [fetchGDACS]);

  useEffect(() => {
    fetchUSGSEarthquakes();
  }, [fetchUSGSEarthquakes]);

  useEffect(() => {
    fetchLiveIncidents();
  }, [fetchLiveIncidents]);

  useEffect(() => {
    fetchNOAAAlerts();
  }, [fetchNOAAAlerts]);

  /* ============================================================================
     13) PERIODIC REFRESH
     ============================================================================ */
  useEffect(() => {
    const tick = async () => {
      await fetchGDACS();
      await fetchUSGSEarthquakes();
      await fetchLiveIncidents();
      await fetchNOAAAlerts();
      setLastUpdated(new Date().toLocaleTimeString());
    };

    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [fetchGDACS, fetchUSGSEarthquakes, fetchLiveIncidents, fetchNOAAAlerts]);

  const toggle = (key) => {
    setLayerVisibility((v) => ({ ...v, [key]: !v[key] }));
  };

  const recenter = () => {
    const map = mapRef.current;
    if (!map) return;

    if (facilityBoundsRef.current) {
      fitToBoundsSafe(map, facilityBoundsRef.current, 80);
      return;
    }
    recenterToGlobe();
  };

  /* ============================================================================
     14) RENDER
     ============================================================================ */
  return (
    <div className="w-full">
      {/* Control strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="text-xs text-gray-600">
          <span className="font-semibold text-[#1D625B]">Map Feeds:</span>{" "}
          Facilities, USGS Earthquakes, NOAA, GDACS, Live Incidents{" "}
          {lastUpdated ? (
            <span className="text-gray-400">• Updated {lastUpdated}</span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => toggle("facilities")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              layerVisibility.facilities
                ? "bg-[#1D625B] text-white border-[#1D625B]"
                : "bg-white text-[#1D625B] border-[#D8E5DD]"
            }`}
          >
            🏭 Facilities
          </button>

          <button
            onClick={() => toggle("usgs")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              layerVisibility.usgs
                ? "bg-[#1D625B] text-white border-[#1D625B]"
                : "bg-white text-[#1D625B] border-[#D8E5DD]"
            }`}
          >
            🌐 USGS Quakes
          </button>

          <button
            onClick={() => toggle("noaa")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              layerVisibility.noaa
                ? "bg-[#1D625B] text-white border-[#1D625B]"
                : "bg-white text-[#1D625B] border-[#D8E5DD]"
            }`}
          >
            ⚠️ NOAA
          </button>

          <button
            onClick={() => toggle("gdacs")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              layerVisibility.gdacs
                ? "bg-[#1D625B] text-white border-[#1D625B]"
                : "bg-white text-[#1D625B] border-[#D8E5DD]"
            }`}
          >
            🌍 GDACS
          </button>

          <button
            onClick={() => toggle("live")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              layerVisibility.live
                ? "bg-[#1D625B] text-white border-[#1D625B]"
                : "bg-white text-[#1D625B] border-[#D8E5DD]"
            }`}
          >
            🔥 Live Incidents
          </button>

          <button
            onClick={recenter}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border bg-white text-[#1D625B] border-[#D8E5DD] hover:bg-[#F4F8F6]"
            title="Re-center: fits to facilities if available, otherwise returns to full globe"
          >
            🎯 Re-center
          </button>
        </div>
      </div>

      {/* ✅ Map container MUST have explicit height */}
      <div
        ref={mapContainerRef}
        className="w-full rounded-2xl overflow-hidden border border-[#D8E5DD] shadow-sm"
        style={{ height }}
      />
    </div>
  );
}
