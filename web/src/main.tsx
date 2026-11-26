import "@fontsource/alegreya-sans/400.css";
import "@fontsource/alegreya-sans/400-italic.css";
import "@fontsource/alegreya-sans/500.css";
import "@fontsource/alegreya-sans/700.css";
import "@fontsource/cinzel/500.css";
import "@fontsource/cinzel/700.css";
import "@fontsource/cinzel-decorative/700.css";
import "@fontsource/cinzel-decorative/900.css";
import "./styles/theme.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("Element #root fehlt in index.html");

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
