

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { GlassVariantProvider } from "./context/GlassVariantContext";
import { AppleEditProvider } from "./context/AppleEditContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <GlassVariantProvider>
          <AppleEditProvider>
            <App />
          </AppleEditProvider>
        </GlassVariantProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);