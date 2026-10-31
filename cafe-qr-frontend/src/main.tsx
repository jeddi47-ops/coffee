import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// Liens d'invitation, de réinitialisation ou magiques : le jeton arrive dans le fragment de l'URL.
// Quelle que soit la page d'arrivée, on passe par /auth/callback en conservant le fragment.
const hash = window.location.hash;
if (/(access_token|error_code|error_description)=/.test(hash) && window.location.pathname !== "/auth/callback") {
  window.history.replaceState(null, "", `/auth/callback${window.location.search}${hash}`);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
