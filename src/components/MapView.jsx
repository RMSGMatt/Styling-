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
   1b) NOTE ON CACHE-BUSTING — DO NOT APPEND QUERY PARAMS TO locationsUrl
   - locationsUrl is an S3 presigned URL. AWS SigV4 validates its signature
     by recomputing it over whatever query parameters are actually present
     in the request. Appending ANY extra param (e.g. "&v=..."), however
     cleanly formatted, changes that query string and invalidates the
     signature — this produces a 403 regardless of the URL otherwise being
     well-formed. (An earlier version of this file tried to fix a related
     double-"?" malformation by stripping-and-re-appending "&v=..."; that
     cleaned up the malformation but the underlying signature break — and
     the 403s — persisted either way, since ANY appended param breaks it.)
   - To force a fresh network fetch of the same URL on repeated polls
     without touching the URL itself, pass `{ cache: "no-store" }` to
     fetch() instead — see the two facilities-fetch call sites below.
   ============================================================================ */

/* ============================================================================
   2) MAPVIEW
   ============================================================================ */
export default function MapView({
  locationsUrl,
  onFacilitySelect,
  height = "560px", // ✅ explicit default height so map can render
}) {
  // --------------------------------------------------------------------------
  // API base (canonical, NO localhost fallback)
  // --------------------------------------------------------------------------
  const API_BASE = useMemo(() => getApiBase(), []);

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
  const usgsMarkersRef = useRef([]);

  // 🚨 Crisis-tier tracking (separate from standard emoji markers)
  // Keyed by source ("USGS" | "GDACS" | "NOAA") so each feed's polling cycle
  // only clears/rebuilds its own crisis markers — otherwise duplicates stack
  // up every refresh since the feeds poll independently.
  const facilityCoordsRef = useRef([]); // [{ facility, lat, lng }]
  const crisisMarkersRef = useRef({}); // { [source]: mapboxgl.Marker[] }
  const crisisSourceIdsRef = useRef({}); // { [source]: string[] } — mapbox source/layer ids

  // NWS zone-based alerts (e.g. Hurricane Warning) ship with geometry: null
  // and only a link to their zone boundary. Zone boundaries are static, so
  // resolved centroids are cached for the life of the session instead of
  // re-fetched every 60s poll.
  const zoneCentroidCacheRef = useRef(new Map()); // zoneUrl -> {lat,lng} | null

  // Store facility bounds so user can re-center later
  const facilityBoundsRef = useRef(null);

  const [layerVisibility, setLayerVisibility] = useState({
    facilities: true,
    usgs: true,
    noaa: true,
    gdacs: true,
    live: false,
  });

  // 🩺 Feed health — tracks whether each live feed's last fetch actually
  // succeeded, since a failed fetch previously only logged to console and
  // looked identical in the UI to "there's just nothing to show right now."
  const [feedStatus, setFeedStatus] = useState({
    facilities: { ok: true, message: null },
    usgs: { ok: true, message: null },
    gdacs: { ok: true, message: null },
    noaa: { ok: true, message: null },
    live: { ok: true, message: null },
  });

  const markFeedOk = useCallback((key) => {
    setFeedStatus((prev) => ({ ...prev, [key]: { ok: true, message: null } }));
  }, []);

  const markFeedError = useCallback((key, message) => {
    setFeedStatus((prev) => ({ ...prev, [key]: { ok: false, message } }));
  }, []);



  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedAlert, setSelectedAlert] = useState(null);

  // 🚨 Crisis banner state — extreme/active events surfaced above the map
  const [activeCrises, setActiveCrises] = useState([]); // [{id, title, lng, lat, magnitude, source, facilities}]
  const [dismissedCrisisIds, setDismissedCrisisIds] = useState(() => new Set());

  /* ============================================================================
     3) EMOJI HELPERS
     ============================================================================ */
  const getEmojiForGDACS = (props = {}) => {
    const t = String(props.type || props.eventtype || "").toLowerCase();
    if (t === "eq" || t.includes("earthquake")) return "🌍";
    if (t === "fl" || t.includes("flood")) return "🌊";
    if (t === "tc" || t.includes("cyclone") || t.includes("storm") || t.includes("hurricane")) return "🌀";
    if (t === "wf" || t.includes("wildfire") || t.includes("fire")) return "🔥";
    if (t === "vo" || t.includes("volcano")) return "🌋";
    if (t === "dr" || t.includes("drought")) return "🏜️";
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
    if (t === "chokepoint") return "⚓";
    if (t === "shipping_lane") return "🚢";
    if (t === "port") return "🏗️";
    if (t.includes("fire")) return "🔥";
    if (t.includes("cyber")) return "🧑‍💻";
    if (t.includes("strike")) return "✊";
    return "⚠️";
  };

    // 🌐 USGS Earthquakes — emoji by magnitude
  const getEmojiForUSGSQuake = (props = {}) => {
    const mag = Number(props.mag ?? props.magnitude ?? 0);
    if (mag >= 7) return "🔴";
    if (mag >= 6) return "🟠";
    if (mag >= 5) return "🟡";
    return "🟢";
  };

  const getTitleForUSGSQuake = (props = {}) => {
    const mag = Number(props.mag ?? props.magnitude ?? 0);
    const place = String(props.place || props.title || "Earthquake");
    return `USGS • M${Number.isFinite(mag) ? mag.toFixed(1) : "?"} • ${place}`;
  };

  /* ============================================================================
     4b) CRISIS-TIER LOGIC
     - Extreme/active events get a distinct pulsing marker + impact radius +
       top banner, instead of blending into the standard emoji layer.
     - Thresholds are intentionally conservative so the crisis tier stays rare
       and meaningful. Tune CRISIS_QUAKE_MIN_MAGNITUDE per your risk appetite.
     ============================================================================ */
  const CRISIS_QUAKE_MIN_MAGNITUDE = 6.5;
  const CRISIS_QUAKE_MAX_AGE_HOURS = 48; // pulsing/banner window; older events fall back to standard marker
  const CRISIS_FACILITY_CHECK_RADIUS_KM = 250; // "facilities within range" check, independent of the visual radius circle

  // Radius circle drawn on the map scales loosely with magnitude — not a
  // scientific shake-intensity model, just a visual "this is the affected
  // neighborhood" cue. Swap in a real isoseismal/ShakeMap radius later if needed.
  const crisisVisualRadiusKm = (magnitude) => {
    const m = Number(magnitude) || CRISIS_QUAKE_MIN_MAGNITUDE;
    if (m >= 8) return 400;
    if (m >= 7.5) return 300;
    if (m >= 7) return 220;
    return 150; // 6.5–6.9
  };

  const isGdacsRedAlert = (props = {}) => {
    const level = String(
      props.alertlevel || props.episodealertlevel || props.severity || ""
    ).toLowerCase();
    return level === "red";
  };

  // Haversine distance in km — no turf dependency, kept intentionally minimal.
  const haversineKm = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // Builds a GeoJSON polygon approximating a circle — used for the impact
  // radius fill layer. No turf dependency; ~64 points is plenty smooth at
  // globe zoom levels.
  const circleGeoJSON = (lng, lat, radiusKm, points = 64) => {
    const coords = [];
    const distanceX = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
    const distanceY = radiusKm / 110.574;
    for (let i = 0; i <= points; i++) {
      const theta = (i / points) * (2 * Math.PI);
      coords.push([lng + distanceX * Math.cos(theta), lat + distanceY * Math.sin(theta)]);
    }
    return {
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [coords] },
      properties: {},
    };
  };

  const findFacilitiesWithinKm = useCallback((lat, lng, radiusKm) => {
    return facilityCoordsRef.current
      .map((f) => ({ ...f, distanceKm: haversineKm(lat, lng, f.lat, f.lng) }))
      .filter((f) => f.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, []);

  // Bounding-box center of a Polygon/MultiPolygon — used to place a marker
  // for NWS zone-based alerts that have no point geometry of their own.
  // Deliberately simple (not a true area centroid): good enough to drop a
  // marker inside the zone, not precise enough for anything beyond that.
  const bboxCenterOfGeometry = (geometry) => {
    if (!geometry) return null;
    let rings = [];
    if (geometry.type === "Polygon") rings = geometry.coordinates || [];
    else if (geometry.type === "MultiPolygon") rings = (geometry.coordinates || []).flat();
    else return null;

    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    rings.forEach((ring) => {
      (ring || []).forEach(([lng, lat]) => {
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      });
    });
    if (!Number.isFinite(minLng) || !Number.isFinite(minLat)) return null;
    return { lng: (minLng + maxLng) / 2, lat: (minLat + maxLat) / 2 };
  };

  // Resolves a NWS zone URL (from properties.affectedZones) to a lat/lng by
  // fetching the zone's own boundary geometry. Cached for the session since
  // zone boundaries don't move. Returns null on failure so the caller can
  // skip that alert rather than crash the batch.
  const resolveZoneCentroid = useCallback(async (zoneUrl) => {
    if (!zoneUrl) return null;
    if (zoneCentroidCacheRef.current.has(zoneUrl)) {
      return zoneCentroidCacheRef.current.get(zoneUrl);
    }
    try {
      const res = await fetch(zoneUrl, { headers: { Accept: "application/geo+json" } });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(`Zone fetch HTTP ${res.status}`);
      const center = bboxCenterOfGeometry(data?.geometry);
      zoneCentroidCacheRef.current.set(zoneUrl, center);
      return center;
    } catch (e) {
      console.warn("⚠️ NWS zone centroid resolution failed:", zoneUrl, e);
      // Not cached on failure — allow retry on the next poll cycle in case
      // it was a transient network issue rather than a bad zone id.
      return null;
    }
  }, []);


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
      center: [0, 35],
      zoom: 0.45,
      pitch: 0,
      bearing: 0,
      duration: 800,
    });
  }, []);

  /* ============================================================================
     5) FACILITIES CSV RENDERING
     - Adds facility markers
     - Stores bounds for recenter button
     - DOES NOT auto-fit (keeps full globe view by default)
     ============================================================================ */
  const renderFacilitiesFromCsv = useCallback(
    (map, csvText) => {
      clearMarkers(facilityMarkersRef);
      facilityCoordsRef.current = [];

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
        el.style.background = "#9FD63A";
        el.style.border = "2px solid white";
        el.style.boxShadow = "0 2px 10px rgba(0,0,0,0.25)";
        el.style.cursor = "pointer";

        const marker = new mapboxgl.Marker({ element: el })
  .setLngLat([lng, lat])
  .addTo(map);

        el.addEventListener("click", () => {
          if (typeof onFacilitySelect === "function") onFacilitySelect(facility);
        });

        facilityMarkersRef.current.push(marker);
        facilityCoordsRef.current.push({ facility, lat, lng });
        bounds.extend([lng, lat]);
        count++;
      }

      if (count > 0) {
        facilityBoundsRef.current = bounds;
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
        // Guard: map may be unmounted/recreated while async fetch resolves
        if (!map || typeof map.getCanvasContainer !== "function" || !map.getCanvasContainer()) return;
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

          // Guard: map may be unmounted/recreated while async data loads
          if (!map || typeof map.getCanvasContainer !== "function" || !map.getCanvasContainer()) {
            return;
          }

          const el = document.createElement("div");
          el.style.fontSize = "20px";
          el.style.cursor = "pointer";
          el.textContent = emojiFn(props);

          const title = titleFn(props);
          const description = props.description || props.headline || props.areaDesc || "";

          el.addEventListener("click", (e) => {
            e.stopPropagation();
            setSelectedAlert({ title, description });
          });

          const marker = new mapboxgl.Marker({ element: el })
            .setLngLat([lng, lat])
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
     6b) CRISIS MARKER + RADIUS RENDERING
     ============================================================================ */
  const clearCrisisLayers = useCallback((map, source) => {
    const markers = crisisMarkersRef.current[source] || [];
    markers.forEach((m) => {
      try {
        m.remove();
      } catch {}
    });
    crisisMarkersRef.current[source] = [];

    const sourceIds = crisisSourceIdsRef.current[source] || [];
    if (map) {
      sourceIds.forEach((id) => {
        try {
          if (map.getLayer(`${id}-fill`)) map.removeLayer(`${id}-fill`);
          if (map.getLayer(`${id}-outline`)) map.removeLayer(`${id}-outline`);
          if (map.getSource(id)) map.removeSource(id);
        } catch {}
      });
    }
    crisisSourceIdsRef.current[source] = [];
  }, []);

  const renderCrisisEvent = useCallback(
    (map, { id, lng, lat, title, description, magnitude, source }) => {
      if (!map || typeof map.getCanvasContainer !== "function" || !map.getCanvasContainer()) {
        return;
      }

      // Impact radius — filled circle + outline, sits below markers
      const radiusKm = crisisVisualRadiusKm(magnitude);
      const sourceId = `forc-crisis-${source.toLowerCase()}-${id}`;
      try {
        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, { type: "geojson", data: circleGeoJSON(lng, lat, radiusKm) });
          map.addLayer({
            id: `${sourceId}-fill`,
            type: "fill",
            source: sourceId,
            paint: { "fill-color": "#ef4444", "fill-opacity": 0.08 },
          });
          map.addLayer({
            id: `${sourceId}-outline`,
            type: "line",
            source: sourceId,
            paint: { "line-color": "#ef4444", "line-width": 1.5, "line-opacity": 0.5 },
          });
          if (!crisisSourceIdsRef.current[source]) crisisSourceIdsRef.current[source] = [];
          crisisSourceIdsRef.current[source].push(sourceId);
        }
      } catch (e) {
        console.warn("Crisis radius layer failed:", e);
      }

      // Pulsing epicenter marker
      const el = document.createElement("div");
      el.className = "forc-crisis-marker";
      el.innerHTML = `
        <div class="forc-crisis-ring"></div>
        <div class="forc-crisis-ring forc-crisis-ring-delay"></div>
        <div class="forc-crisis-core">🔴</div>
      `;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelectedAlert({ title, description });
      });

      const marker = new mapboxgl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
      if (!crisisMarkersRef.current[source]) crisisMarkersRef.current[source] = [];
      crisisMarkersRef.current[source].push(marker);
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
      clearCrisisLayers(map, "NOAA");
      setActiveCrises((prev) => prev.filter((c) => c.source !== "NOAA"));
      markFeedOk("noaa");
      return;
    }

    try {
      const res = await fetch("https://api.weather.gov/alerts/active", {
        headers: { Accept: "application/geo+json" },
      });
      const data = await safeJson(res);

      if (!res.ok) {
        console.error("❌ NOAA HTTP", res.status, data);
        markFeedError("noaa", `HTTP ${res.status}`);
        return;
      }

      markFeedOk("noaa");

      const feats = data?.features || [];

      renderPointMarkersFromGeoJSON(
        map,
        feats,
        noaaMarkersRef,
        (p) => getEmojiForNOAA(p),
        (p) => `NOAA Alert • ${p.event || "Alert"}`
      );

      // 🚨 Crisis tier — NWS "Extreme" severity (its own highest tier). Most
      // small-scale warnings (Tornado, Flash Flood, Severe Thunderstorm) ship
      // with their own polygon. Large-scale zone-based products — notably
      // Hurricane Warning — do not; for those we resolve a centroid from the
      // zone's own boundary via properties.affectedZones as a fallback.
      const extremeFeats = feats.filter(
        (f) => String(f?.properties?.severity || "").toLowerCase() === "extreme"
      );

      clearCrisisLayers(map, "NOAA");

      const nextNoaaCrisesRaw = await Promise.all(
        extremeFeats.map(async (f) => {
          const geom = f?.geometry;
          const p = f.properties || {};

          let lng = null;
          let lat = null;

          if (geom) {
            let coords = null;
            if (geom.type === "Point") coords = geom.coordinates;
            else if (geom.type === "Polygon") coords = geom.coordinates?.[0]?.[0];
            else if (geom.type === "MultiPolygon") coords = geom.coordinates?.[0]?.[0]?.[0];
            if (coords && coords.length >= 2) {
              [lng, lat] = coords.map(Number);
            }
          }

          // Fallback: no point/polygon on the alert itself — resolve via
          // its first affected zone's boundary instead of skipping it.
          if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && p.affectedZones?.length) {
            const center = await resolveZoneCentroid(p.affectedZones[0]);
            if (center) {
              lng = center.lng;
              lat = center.lat;
            }
          }

          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            console.warn("⚠️ NOAA Extreme alert could not be located — skipped:", p.event, p.areaDesc);
            return null;
          }

          const title = `NOAA EXTREME • ${p.event || "Alert"}`;
          const facilities = findFacilitiesWithinKm(lat, lng, CRISIS_FACILITY_CHECK_RADIUS_KM);
          const description = [
            p.headline || p.areaDesc || "",
            facilities.length
              ? `${facilities.length} facility(ies) within ${CRISIS_FACILITY_CHECK_RADIUS_KM}km: ${facilities
                  .map((fac) => `${fac.facility} (${Math.round(fac.distanceKm)}km)`)
                  .join(", ")}`
              : `No known facilities within ${CRISIS_FACILITY_CHECK_RADIUS_KM}km`,
          ]
            .filter(Boolean)
            .join("\n");
          const id = String(p.id || `noaa-${lat}-${lng}-${p.event}`);

          return { id, lng, lat, title, description, source: "NOAA", facilities };
        })
      );

      const nextNoaaCrises = nextNoaaCrisesRaw.filter(Boolean);

      // Guard: map may have unmounted while zone fetches were in flight.
      if (map && typeof map.getCanvasContainer === "function" && map.getCanvasContainer()) {
        nextNoaaCrises.forEach(({ id, lng, lat, title, description }) => {
          renderCrisisEvent(map, {
            id,
            lng,
            lat,
            title,
            description,
            magnitude: null, // NOAA radius uses the default (non-magnitude) tier
            source: "NOAA",
          });
        });
      }

      setActiveCrises((prev) => {
        const nonNoaa = prev.filter((c) => c.source !== "NOAA");
        return [...nonNoaa, ...nextNoaaCrises];
      });
    } catch (e) {
      console.error("❌ NOAA fetch failed:", e);
      markFeedError("noaa", e?.message || "Fetch failed");
    }
  }, [
    layerVisibility.noaa,
    renderPointMarkersFromGeoJSON,
    clearCrisisLayers,
    renderCrisisEvent,
    findFacilitiesWithinKm,
    resolveZoneCentroid,
    markFeedOk,
    markFeedError,
  ]);

  const fetchGDACS = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;

    if (!layerVisibility.gdacs) {
      clearMarkers(gdacsMarkersRef);
      clearCrisisLayers(map, "GDACS");
      setActiveCrises((prev) => prev.filter((c) => c.source !== "GDACS"));
      markFeedOk("gdacs"); // don't show a stale error badge on a disabled layer
      return;
    }

    try {
      const res = await fetch(apiUrl("/api/gdacs-feed"));
      const data = await safeJson(res);

      if (!res.ok) {
        console.error("❌ GDACS HTTP", res.status, data);
        markFeedError("gdacs", `HTTP ${res.status}`);
        return;
      }

      markFeedOk("gdacs");

      const feats = data?.features || [];
      renderPointMarkersFromGeoJSON(
        map,
        feats,
        gdacsMarkersRef,
        (p) => getEmojiForGDACS(p),
        (p) => `GDACS • ${p.name || p.type || "Event"}`
      );

      // 🚨 Crisis tier — GDACS "Red" alert level events (the agency's own
      // highest severity tier) get the same pulsing/radius/banner treatment.
      const redFeats = feats.filter((f) => isGdacsRedAlert(f?.properties));

      clearCrisisLayers(map, "GDACS");

      const nextGdacsCrises = redFeats
        .map((f) => {
          const coords = f?.geometry?.coordinates;
          if (!coords || coords.length < 2) return null;
          const [lng, lat] = coords;
          const p = f.properties || {};
          const title = `GDACS RED • ${p.name || p.type || "Event"}`;
          const facilities = findFacilitiesWithinKm(lat, lng, CRISIS_FACILITY_CHECK_RADIUS_KM);
          const description = [
            p.description || p.name || "",
            facilities.length
              ? `${facilities.length} facility(ies) within ${CRISIS_FACILITY_CHECK_RADIUS_KM}km: ${facilities
                  .map((fac) => `${fac.facility} (${Math.round(fac.distanceKm)}km)`)
                  .join(", ")}`
              : `No known facilities within ${CRISIS_FACILITY_CHECK_RADIUS_KM}km`,
          ]
            .filter(Boolean)
            .join("\n");
          const id = String(p.eventid || `gdacs-${lat}-${lng}`);

          renderCrisisEvent(map, {
            id,
            lng,
            lat,
            title,
            description,
            magnitude: null, // GDACS radius uses the default tier since it isn't magnitude-based
            source: "GDACS",
          });

          return { id, title, lng, lat, magnitude: null, source: "GDACS", facilities };
        })
        .filter(Boolean);

      setActiveCrises((prev) => {
        const nonGdacs = prev.filter((c) => c.source !== "GDACS");
        return [...nonGdacs, ...nextGdacsCrises];
      });
    } catch (e) {
      console.error("❌ GDACS refresh failed:", e);
      markFeedError("gdacs", e?.message || "Fetch failed");
    }
  }, [
    apiUrl,
    layerVisibility.gdacs,
    renderPointMarkersFromGeoJSON,
    renderCrisisEvent,
    clearCrisisLayers,
    findFacilitiesWithinKm,
    markFeedOk,
    markFeedError,
  ]);

  const fetchLiveIncidents = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;

    if (!layerVisibility.live) {
      clearMarkers(liveMarkersRef);
      markFeedOk("live");
      return;
    }

    try {
      const res = await fetch(apiUrl("/api/live-incidents"));
      const data = await safeJson(res);

      if (!res.ok) {
        console.error("❌ Live incidents HTTP", res.status, data);
        markFeedError("live", `HTTP ${res.status}`);
        return;
      }

      markFeedOk("live");

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
      markFeedError("live", e?.message || "Fetch failed");
    }
  }, [apiUrl, layerVisibility.live, renderPointMarkersFromGeoJSON, markFeedOk, markFeedError]);

    // 🌐 USGS Earthquakes (GeoJSON feed) — independent of backend
  const fetchUSGSEarthquakes = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;

    if (!layerVisibility.usgs) {
      clearMarkers(usgsMarkersRef);
      clearCrisisLayers(map, "USGS");
      setActiveCrises((prev) => prev.filter((c) => c.source !== "USGS"));
      markFeedOk("usgs");
      return;
    }

    try {
      const res = await fetch(
        "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson"
      );
      const data = await safeJson(res);

      if (!res.ok) {
        console.error("❌ USGS earthquakes HTTP", res.status, data);
        markFeedError("usgs", `HTTP ${res.status}`);
        return;
      }

      markFeedOk("usgs");

      const feats = data?.features || [];

      // Filter by magnitude — only show 5.0+ for supply chain relevance
      const MIN_MAGNITUDE = 5.0;
      const filteredFeats = feats.filter((f) => {
        const mag = Number(f?.properties?.mag ?? f?.properties?.magnitude ?? 0);
        return mag >= MIN_MAGNITUDE;
      });

      console.log(`🌍 USGS: ${feats.length} total quakes, ${filteredFeats.length} above M${MIN_MAGNITUDE}`);

      // USGS puts mag/place/time under properties
      renderPointMarkersFromGeoJSON(
        map,
        filteredFeats,
        usgsMarkersRef,
        (p) => getEmojiForUSGSQuake(p),
        (p) => getTitleForUSGSQuake(p)
      );

      // 🚨 Crisis tier — M6.5+ within the last 48h gets a pulsing marker,
      // impact radius, and a banner entry above the map.
      const nowMs = Date.now();
      const crisisFeats = feats.filter((f) => {
        const p = f?.properties || {};
        const mag = Number(p.mag ?? p.magnitude ?? 0);
        const ageHours = (nowMs - Number(p.time || 0)) / 3_600_000;
        return mag >= CRISIS_QUAKE_MIN_MAGNITUDE && ageHours <= CRISIS_QUAKE_MAX_AGE_HOURS;
      });

      clearCrisisLayers(map, "USGS");

      const nextCrises = crisisFeats
        .map((f) => {
          const coords = f?.geometry?.coordinates;
          if (!coords || coords.length < 2) return null;
          const [lng, lat] = coords;
          const p = f.properties || {};
          const magnitude = Number(p.mag ?? p.magnitude ?? 0);
          const facilities = findFacilitiesWithinKm(lat, lng, CRISIS_FACILITY_CHECK_RADIUS_KM);
          const title = getTitleForUSGSQuake(p);
          const description = [
            p.place || "",
            magnitude ? `Magnitude ${magnitude.toFixed(1)}` : "",
            facilities.length
              ? `${facilities.length} facility(ies) within ${CRISIS_FACILITY_CHECK_RADIUS_KM}km: ${facilities
                  .map((fac) => `${fac.facility} (${Math.round(fac.distanceKm)}km)`)
                  .join(", ")}`
              : `No known facilities within ${CRISIS_FACILITY_CHECK_RADIUS_KM}km`,
          ]
            .filter(Boolean)
            .join("\n");

          const id = String(f.id || `${lat}-${lng}-${p.time}`);

          renderCrisisEvent(map, {
            id,
            lng,
            lat,
            title,
            description,
            magnitude,
            source: "USGS",
          });

          return {
            id,
            title,
            lng,
            lat,
            magnitude,
            source: "USGS",
            facilities,
          };
        })
        .filter(Boolean);

      setActiveCrises((prev) => {
        // preserve any non-USGS crises (e.g. GDACS) already in state
        const nonUsgs = prev.filter((c) => c.source !== "USGS");
        return [...nonUsgs, ...nextCrises];
      });
    } catch (e) {
      console.error("❌ USGS earthquakes fetch failed", e);
      markFeedError("usgs", e?.message || "Fetch failed");
    }
  }, [
    layerVisibility.usgs,
    renderPointMarkersFromGeoJSON,
    clearCrisisLayers,
    renderCrisisEvent,
    findFacilitiesWithinKm,
    markFeedOk,
    markFeedError,
  ]);


  /* ============================================================================
     8) MAP INIT — RUNS EXACTLY ONCE
     - Satellite-forward style
     - Full globe view
     - Aggressive padding + resize to prevent bottom clipping
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

    // Debug hook (optional)
    window.__FORC_MAP__ = map;

    map.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: true }),
      "top-right"
    );

    const onLoad = async () => {
      try {
        // 🌍 Globe + atmosphere
        map.setProjection("globe");
        map.setRenderWorldCopies(false);

        map.setFog({
          range: [0.6, 9],
          "horizon-blend": 0.35,
          color: "#050B14",
          "high-color": "#0F3A2E",
          "space-color": "#000000",
          "star-intensity": 0.25,
        });

        // 🎨 Recolor base style layers so the globe reads as a branded
        // "data surface" rather than default Mapbox dark-v11 gray.
        // Wrapped defensively since layer ids can shift between style versions.
        const tryPaint = (layerId, prop, value) => {
          try {
            if (map.getLayer(layerId)) map.setPaintProperty(layerId, prop, value);
          } catch (e) {
            /* layer/property not present in this style version — skip */
          }
        };
        tryPaint("background", "background-color", "#04060A");
        tryPaint("water", "fill-color", "#050B14");
        tryPaint("land", "background-color", "#101720");
        tryPaint("landcover", "fill-color", "#121B26");
        tryPaint("landuse", "fill-color", "#121B26");
        tryPaint("national-park", "fill-color", "#101720");
        tryPaint("admin-0-boundary", "line-color", "rgba(159,214,58,0.18)");
        tryPaint("admin-1-boundary", "line-color", "rgba(148,163,184,0.10)");

        // ⬆️ Push globe upward more to avoid bottom clipping
        map.setPadding({
          top: 10,
          bottom: 190,
          left: 10,
          right: 10,
        });

        // 🔒 Lock camera AFTER layout settles
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

      // facilities (markers only; no auto-fit so globe remains in view)
      if (locationsUrl && layerVisibility.facilities) {
        try {
          // Fetch the presigned URL as-is (no appended query params — see
          // note above) and force a fresh network request via cache option.
          const res = await fetch(locationsUrl, { cache: "no-store" });
          if (!res.ok) {
            console.error("❌ Facility CSV HTTP", res.status, locationsUrl);
            markFeedError("facilities", `HTTP ${res.status}`);
          } else {
            const txt = await res.text();
            renderFacilitiesFromCsv(map, txt);
            markFeedOk("facilities");
          }
        } catch (e) {
          console.error("❌ Facility CSV load failed:", e);
          markFeedError("facilities", e?.message || "Fetch failed");
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
        // Fetch the presigned URL as-is — see cache-busting note above.
        const res = await fetch(locationsUrl, { cache: "no-store" });
        if (!res.ok) {
          console.error("❌ Facility CSV HTTP", res.status, locationsUrl);
          markFeedError("facilities", `HTTP ${res.status}`);
          return;
        }
        const txt = await res.text();
        renderFacilitiesFromCsv(map, txt);
        markFeedOk("facilities");
      } catch (e) {
        console.error("❌ Facility reload failed:", e);
        markFeedError("facilities", e?.message || "Fetch failed");
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
  }, [locationsUrl, layerVisibility.facilities, renderFacilitiesFromCsv, markFeedOk, markFeedError]);

  /* ============================================================================
     10) FEED RELOAD ON TOGGLE CHANGE (NO MAP RE-INIT)
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
     11) PERIODIC REFRESH (LIGHTWEIGHT)
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

  // 🚨 Crisis banner interactions
  const flyToCrisis = (crisis) => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ center: [crisis.lng, crisis.lat], zoom: 4.5, duration: 1200 });
  };

  const dismissCrisis = (id) => {
    setDismissedCrisisIds((prev) => new Set(prev).add(id));
  };

  const visibleCrises = activeCrises.filter((c) => !dismissedCrisisIds.has(c.id));

  /* ============================================================================
     12) RENDER
     ============================================================================ */
  return (
    <div className="w-full">
      {/* 🚨 Crisis banner — active extreme events (M6.5+ quakes, GDACS Red) */}
      {visibleCrises.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          {visibleCrises.map((crisis) => (
            <div
              key={crisis.id}
              className="flex items-center justify-between gap-3 rounded-xl px-4 py-2.5"
              style={{
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.55)",
                boxShadow: "0 0 20px rgba(239,68,68,0.15)",
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "#ef4444", color: "#ffffff", letterSpacing: "0.04em" }}
                >
                  ACTIVE CRISIS
                </span>
                <button
                  onClick={() => flyToCrisis(crisis)}
                  className="text-sm font-semibold truncate text-left"
                  style={{ color: "#FCA5A5" }}
                  title="Click to fly to location"
                >
                  {crisis.title}
                </button>
                {crisis.facilities?.length > 0 && (
                  <span className="shrink-0 text-xs" style={{ color: "#F1F5F9" }}>
                    ⚠️ {crisis.facilities.length} facility
                    {crisis.facilities.length > 1 ? "ies" : "y"} within {CRISIS_FACILITY_CHECK_RADIUS_KM}km
                  </span>
                )}
              </div>
              <button
                onClick={() => dismissCrisis(crisis.id)}
                className="shrink-0"
                style={{ color: "#FCA5A5", fontSize: "14px", lineHeight: 1, background: "none", border: "none", cursor: "pointer" }}
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Control strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">


        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <button
              onClick={() => toggle("facilities")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                layerVisibility.facilities
                  ? "bg-[rgba(159,214,58,0.15)] text-[#9FD63A] border-[rgba(159,214,58,0.5)]"
                  : "bg-slate-900/50 text-slate-300 border-slate-700"
              }`}
            >
              🏭 Facilities
            </button>
            {!feedStatus.facilities.ok && (
              <span
                className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full"
                style={{ background: "#ef4444", border: "1.5px solid #0B0F13", boxShadow: "0 0 6px rgba(239,68,68,0.8)" }}
                title={`Facilities CSV error: ${feedStatus.facilities.message || "unknown"}`}
              />
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => toggle("usgs")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                layerVisibility.usgs
                  ? "bg-[rgba(159,214,58,0.15)] text-[#9FD63A] border-[rgba(159,214,58,0.5)]"
                  : "bg-slate-900/50 text-slate-300 border-slate-700"
              }`}
            >
              🌐 USGS Quakes
            </button>
            {!feedStatus.usgs.ok && (
              <span
                className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full"
                style={{ background: "#ef4444", border: "1.5px solid #0B0F13", boxShadow: "0 0 6px rgba(239,68,68,0.8)" }}
                title={`USGS feed error: ${feedStatus.usgs.message || "unknown"}`}
              />
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => toggle("noaa")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                layerVisibility.noaa
                  ? "bg-[rgba(159,214,58,0.15)] text-[#9FD63A] border-[rgba(159,214,58,0.5)]"
                  : "bg-slate-900/50 text-slate-300 border-slate-700"
              }`}
            >
              ⚠️ NOAA
            </button>
            {!feedStatus.noaa.ok && (
              <span
                className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full"
                style={{ background: "#ef4444", border: "1.5px solid #0B0F13", boxShadow: "0 0 6px rgba(239,68,68,0.8)" }}
                title={`NOAA feed error: ${feedStatus.noaa.message || "unknown"}`}
              />
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => toggle("gdacs")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                layerVisibility.gdacs
                  ? "bg-[rgba(159,214,58,0.15)] text-[#9FD63A] border-[rgba(159,214,58,0.5)]"
                  : "bg-slate-900/50 text-slate-300 border-slate-700"
              }`}
            >
              🌍 GDACS
            </button>
            {!feedStatus.gdacs.ok && (
              <span
                className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full"
                style={{ background: "#ef4444", border: "1.5px solid #0B0F13", boxShadow: "0 0 6px rgba(239,68,68,0.8)" }}
                title={`GDACS feed error: ${feedStatus.gdacs.message || "unknown"}`}
              />
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => toggle("live")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                layerVisibility.live
                  ? "bg-[rgba(159,214,58,0.15)] text-[#9FD63A] border-[rgba(159,214,58,0.5)]"
                  : "bg-slate-900/50 text-slate-300 border-slate-700"
              }`}
            >
              🔥 Live Incidents
            </button>
            {!feedStatus.live.ok && (
              <span
                className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full"
                style={{ background: "#ef4444", border: "1.5px solid #0B0F13", boxShadow: "0 0 6px rgba(239,68,68,0.8)" }}
                title={`Live incidents feed error: ${feedStatus.live.message || "unknown"}`}
              />
            )}
          </div>

          <button
            onClick={recenter}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border bg-slate-900/50 text-slate-300 border-slate-700 hover:border-lime-400/40 hover:bg-slate-800/60"
            title="Re-center: fits to facilities if available, otherwise returns to full globe"
          >
            🎯 Re-center
          </button>
        </div>
      </div>

      {/* ✅ Map container MUST have explicit height */}
      <div
        className="relative w-full rounded-2xl overflow-hidden"
        style={{
          boxShadow:
            "0 0 60px rgba(159,214,58,0.06), 0 0 0 1px rgba(30,39,51,1), inset 0 0 80px rgba(0,0,0,0.35)",
        }}
      >
        <div
          ref={mapContainerRef}
          className="w-full"
          style={{ height }}
        />

        {selectedAlert && (
          <div
            className="absolute top-0 right-0 h-full overflow-y-auto"
            style={{
              width: "320px",
              maxWidth: "90%",
              background: "rgba(11,15,19,0.97)",
              borderLeft: "1px solid rgba(148,163,184,0.15)",
              padding: "16px",
              zIndex: 10,
            }}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <p className="text-sm font-bold" style={{ color: "#F1F5F9" }}>{selectedAlert.title}</p>
              <button
                onClick={() => setSelectedAlert(null)}
                className="shrink-0"
                style={{ color: "#94A3B8", fontSize: "16px", lineHeight: 1, background: "none", border: "none", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "#C7D0D9", whiteSpace: "pre-wrap" }}>
              {selectedAlert.description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
