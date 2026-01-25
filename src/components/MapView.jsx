// src/components/MapView.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";

/* ============================================================================
   0) MAPBOX TOKEN — SET ONCE AT MODULE LOAD
   ============================================================================ */
console.log("🧭 MapView.jsx MOUNTED");

const MAPBOX_TOKEN =
  import.meta?.env?.VITE_MAPBOX_TOKEN ||
  import.meta?.env?.VITE_MAPBOX_ACCESS_TOKEN ||
  "";

if (!MAPBOX_TOKEN) {
  console.error("❌ Mapbox token missing (VITE_MAPBOX_TOKEN). Map cannot load.");
} else {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

console.log("🧭 MapView env check:", {
  MODE: import.meta.env.MODE,
  HAS_VITE_MAPBOX_TOKEN: Boolean(import.meta.env.VITE_MAPBOX_TOKEN),
  TOKEN_LEN: (import.meta.env.VITE_MAPBOX_TOKEN || "").length,
});

/* ============================================================================
   1) SAFE JSON HELPER
   ============================================================================ */
function safeJson(res) {
  return res
    .json()
    .catch(async () => ({ _raw: await res.text().catch(() => "") }));
}

/* ============================================================================
   2) MAPVIEW
   ============================================================================ */
export default function MapView({
  locationsUrl,
  onFacilitySelect,
  height = "560px", // ✅ explicit default height so map can render
}) {
  // Keep API_BASE stable (does not control map init)
  const API_BASE = useMemo(
    () =>
      (import.meta?.env?.VITE_API_BASE || "http://127.0.0.1:5000").replace(
        /\/$/,
        ""
      ),
    []
  );

  const apiUrl = useCallback(
    (path) => `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`,
    [API_BASE]
  );

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  // Marker refs (so we can clear without re-mounting map)
  const facilityMarkersRef = useRef([]);
  const gdacsMarkersRef = useRef([]);
  const liveMarkersRef = useRef([]);
  const noaaMarkersRef = useRef([]);

  // Store facility bounds so user can re-center later
  const facilityBoundsRef = useRef(null);

  const [layerVisibility, setLayerVisibility] = useState({
    facilities: true,
    noaa: true,
    gdacs: true,
    live: true,
  });

  const [lastUpdated, setLastUpdated] = useState(null);

  /* ============================================================================
     3) EMOJI HELPERS
     ============================================================================ */
  const getEmojiForGDACS = (props = {}) => {
    const t = String(props.type || props.eventtype || "").toLowerCase();
    if (t.includes("earthquake")) return "🌍";
    if (t.includes("flood")) return "🌊";
    if (t.includes("cyclone") || t.includes("storm") || t.includes("hurricane"))
      return "🌀";
    if (t.includes("wildfire") || t.includes("fire")) return "🔥";
    if (t.includes("volcano")) return "🌋";
    return "⚠️";
  };

  const getEmojiForNOAA = (props = {}) => {
    const e = String(props.event || "").toLowerCase();
    if (e.includes("tornado")) return "🌪️";
    if (e.includes("flood")) return "🌊";
    if (e.includes("winter") || e.includes("snow") || e.includes("blizzard"))
      return "❄️";
    if (e.includes("hurricane") || e.includes("tropical")) return "🌀";
    if (e.includes("fire")) return "🔥";
    if (e.includes("heat")) return "🥵";
    return "⚠️";
  };

  const getEmojiForLiveIncident = (props = {}) => {
    const t = String(props.type || "").toLowerCase();
    if (t.includes("fire")) return "🔥";
    if (t.includes("cyber")) return "🧑‍💻";
    if (t.includes("strike")) return "✊";
    if (t.includes("port")) return "⚓";
    return "⚠️";
  };

  /* ============================================================================
     4) MARKER UTILITIES
     ============================================================================ */
  const clearMarkers = (arrRef) => {
    arrRef.current.forEach((m) => {
      try {
        m.remove();
      } catch {}
    });
    arrRef.current = [];
  };

  const fitToBoundsSafe = useCallback((map, bounds, padding = 80) => {
    try {
      if (!map || !bounds) return;
      map.fitBounds(bounds, {
        padding,
        duration: 900,
        maxZoom: 5.5,
      });
    } catch (e) {
      console.warn("fitBounds failed:", e);
    }
  }, []);

  const recenterToGlobe = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({
      center: [0, 28],
      zoom: 0.72,
      pitch: 0,
      bearing: 0,
      duration: 800,
    });
  }, []);

  /* ============================================================================
     5) FACILITIES CSV RENDERING
     Enhancement:
     - Keeps facility bounds stored (for optional recenter)
     - DOES NOT auto-fit on load (so you keep full globe view by default)
     ============================================================================ */
  const renderFacilitiesFromCsv = useCallback(
    (map, csvText) => {
      clearMarkers(facilityMarkersRef);

      const lines = String(csvText || "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      if (lines.length < 2) return;

      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const idxLat = headers.findIndex((h) => h === "latitude" || h === "lat");
      const idxLng = headers.findIndex(
        (h) => h === "longitude" || h === "lng" || h === "lon"
      );
      const idxFacility = headers.findIndex(
        (h) => h === "facility" || h === "name"
      );

      let bounds = new mapboxgl.LngLatBounds();
      let count = 0;

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim());

        const lat = Number(cols[idxLat]);
        const lng = Number(cols[idxLng]);
        const facility = cols[idxFacility] || `Facility ${i}`;

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

        const el = document.createElement("div");
        el.style.width = "14px";
        el.style.height = "14px";
        el.style.borderRadius = "999px";
        el.style.background = "#1D625B";
        el.style.border = "2px solid white";
        el.style.boxShadow = "0 2px 10px rgba(0,0,0,0.25)";
        el.style.cursor = "pointer";

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([lng, lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 16 }).setHTML(
              `<div style="font-weight:700;color:#1D625B;">🏭 ${facility}</div>`
            )
          )
          .addTo(map);

        el.addEventListener("click", () => {
          if (typeof onFacilitySelect === "function") onFacilitySelect(facility);
        });

        facilityMarkersRef.current.push(marker);
        bounds.extend([lng, lat]);
        count++;
      }

      if (count > 0) {
        facilityBoundsRef.current = bounds;
        // ✅ Do NOT auto-fit; keep globe view by default.
        // If you want to fit, use the 🎯 Re-center button below.
      }
    },
    [onFacilitySelect]
  );

  /* ============================================================================
     6) GENERIC GEOJSON MARKER RENDERER
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
     7) FETCHERS — ALWAYS USE mapRef.current (no re-init)
     ============================================================================ */
  const fetchNOAAAlerts = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;

    if (!layerVisibility.noaa) {
      clearMarkers(noaaMarkersRef);
      return;
    }

    try {
      const res = await fetch("https://api.weather.gov/alerts/active", {
        headers: { Accept: "application/geo+json" },
      });
      const data = await safeJson(res);
      const feats = data?.features || [];

      renderPointMarkersFromGeoJSON(
        map,
        feats,
        noaaMarkersRef,
        (p) => getEmojiForNOAA(p),
        (p) => `NOAA Alert • ${p.event || "Alert"}`
      );
    } catch (e) {
      console.error("❌ NOAA fetch failed:", e);
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
        (p) => `GDACS • ${p.name || p.type || "Event"}`
      );
    } catch (e) {
      console.error("❌ GDACS refresh failed:", e);
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

  /* ============================================================================
     8) MAP INIT — RUNS EXACTLY ONCE
     Enhancement:
     - Full globe view by default
     - Satellite-forward color (satellite-streets)
     - Globe projection + fog
     ============================================================================ */
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapboxgl.accessToken) {
      console.error("❌ Mapbox token missing (VITE_MAPBOX_TOKEN). Map cannot load.");
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

      // 🌍 Entire globe centered
      center: [0, 20],
      zoom: 0.85,
      pitch: 0,
      bearing: 0,
    });

    mapRef.current = map;

    // Debug hook (optional)
    window.__FORC_MAP__ = map;

    map.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: true }),
      "top-right"
    );

    const onLoad = async () => {
      // 🌍 Globe + atmosphere
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
      } catch {}

      // initial pulls
      await fetchGDACS();
      await fetchLiveIncidents();
      await fetchNOAAAlerts();
      setLastUpdated(new Date().toLocaleTimeString());

      // facilities (markers only; no auto-fit so globe remains in view)
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
    // ✅ DO NOT ADD DEPENDENCIES HERE (must run once)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ============================================================================
     9) FACILITIES RELOAD ON URL/TOGGLE CHANGE (NO MAP RE-INIT)
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
     10) FEED RELOAD ON TOGGLE CHANGE (NO MAP RE-INIT)
     ============================================================================ */
  useEffect(() => {
    fetchGDACS();
  }, [fetchGDACS]);

  useEffect(() => {
    fetchLiveIncidents();
  }, [fetchLiveIncidents]);

  useEffect(() => {
    fetchNOAAAlerts();
  }, [fetchNOAAAlerts]);

  /* ============================================================================
     11) PERIODIC REFRESH (LIGHTWEIGHT)
     ============================================================================ */
  useEffect(() => {
    const tick = async () => {
      await fetchGDACS();
      await fetchLiveIncidents();
      await fetchNOAAAlerts();
      setLastUpdated(new Date().toLocaleTimeString());
    };

    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [fetchGDACS, fetchLiveIncidents, fetchNOAAAlerts]);

  const toggle = (key) => {
    setLayerVisibility((v) => ({ ...v, [key]: !v[key] }));
  };

  // 🎯 Re-center: if facilities exist, fit to them; else return to globe view
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
     12) RENDER
     ============================================================================ */
  return (
    <div className="w-full">
      {/* Control strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="text-xs text-gray-600">
          <span className="font-semibold text-[#1D625B]">Map Feeds:</span>{" "}
          Facilities, NOAA, GDACS, Live Incidents{" "}
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
