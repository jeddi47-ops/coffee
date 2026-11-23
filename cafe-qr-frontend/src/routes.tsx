// Carte des routes. /m/:token est chargé directement (page du QR) ;
// tout le reste est chargé à la demande (code splitting).
import { lazy } from "react";
import { Navigate, type RouteObject } from "react-router-dom";
import { MenuPage } from "./pages/customer/MenuPage";
import { RequireStaff } from "./components/RequireAuth";

const DesabonnementPage = lazy(() => import("./pages/DesabonnementPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const AccountPage = lazy(() => import("./pages/customer/AccountPage"));
const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("./pages/auth/RegisterPage"));
const RenewPage = lazy(() => import("./pages/auth/RenewPage"));
const AuthCallbackPage = lazy(() => import("./pages/auth/AuthCallbackPage"));
const SetPasswordPage = lazy(() => import("./pages/auth/SetPasswordPage"));
const StaffPage = lazy(() => import("./pages/staff/StaffPage"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const MenuAdminPage = lazy(() => import("./pages/admin/MenuAdminPage"));
const TablesAdminPage = lazy(() => import("./pages/admin/TablesAdminPage"));
const StaffAdminPage = lazy(() => import("./pages/admin/StaffAdminPage"));
const AnnouncementsPage = lazy(() => import("./pages/admin/AnnouncementsPage"));
const LoyaltyAdmin = lazy(() => import("./pages/Loyalty"));
const SettingsPage = lazy(() => import("./pages/admin/SettingsPage"));
const PlatformAdminPage = lazy(() => import("./pages/admin/PlatformAdminPage"));

export const routes: RouteObject[] = [
  { path: "/m/:token", element: <MenuPage /> },
  { path: "/desabonnement", element: <DesabonnementPage /> },
  { path: "/compte", element: <AccountPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/inscription", element: <RegisterPage /> },
  { path: "/renouvellement", element: <RenewPage /> },
  { path: "/platform-admin", element: <PlatformAdminPage /> },
  { path: "/auth/callback", element: <AuthCallbackPage /> },
  { path: "/auth/mot-de-passe", element: <SetPasswordPage /> },
  {
    path: "/staff",
    element: (
      <RequireStaff roles={["owner", "manager", "waiter"]}>
        <StaffPage />
      </RequireStaff>
    ),
  },
  {
    path: "/admin",
    element: (
      <RequireStaff roles={["owner", "manager"]}>
        <AdminLayout />
      </RequireStaff>
    ),
    children: [
      { index: true, element: <MenuAdminPage /> },
      { path: "tables", element: <TablesAdminPage /> },
      {
        path: "equipe",
        element: (
          <RequireStaff roles={["owner"]}>
            <StaffAdminPage />
          </RequireStaff>
        ),
      },
      { path: "nouveautes", element: <AnnouncementsPage /> },
      { path: "fidelite", element: <RequireStaff roles={["owner"]}><LoyaltyAdmin /></RequireStaff> },
      {
        path: "reglages",
        element: (
          <RequireStaff roles={["owner"]}>
            <SettingsPage />
          </RequireStaff>
        ),
      },
      { path: "*", element: <Navigate to="/admin" replace /> },
    ],
  },
  { path: "/", element: <LandingPage /> },
  { path: "*", element: <NotFoundPage /> },
];
