import { Route, Routes } from "react-router-dom";
import { MenuPage } from "./pages/customer/MenuPage";
import { DesabonnementPage } from "./pages/DesabonnementPage";
import { NotFoundPage } from "./pages/NotFoundPage";

// Routes livrées dans ce lot : zone client et désabonnement.
// À venir : /login, /auth/*, /staff, /admin/* (lots suivants).
export default function App() {
  return (
    <Routes>
      <Route path="/m/:token" element={<MenuPage />} />
      <Route path="/desabonnement" element={<DesabonnementPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
