import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Global styles
import "./index.css";

// ✅ REQUIRED: Mapbox GL JS styles
import "mapbox-gl/dist/mapbox-gl.css";

import App from "./App.jsx";
import AboutUs from "./pages/AboutUs.jsx";
import AuthPage from "./pages/AuthPage.jsx";

const rootElement = document.getElementById("root");

createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Route EVERYTHING through App */}
        <Route path="/" element={<App />} />
        <Route path="/control-tower" element={<App />} />
        <Route path="/simulation" element={<App />} />

        {/* Standalone routes */}
        <Route path="/about" element={<AboutUs />} />
        <Route path="/signup" element={<AuthPage onLogin={() => {}} />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
