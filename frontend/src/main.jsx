import React from "react";
import ReactDOM from "react-dom/client";
import "./lib/axiosSetup.js";
// Self-hosted: the site CSP (font-src 'self') blocks Google Fonts, so Inter must ship in the bundle.
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);