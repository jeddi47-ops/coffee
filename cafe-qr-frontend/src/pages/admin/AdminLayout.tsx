// /admin : barre latérale (menu burger sur mobile). Équipe et Réglages : owner uniquement.
import { Suspense, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ChefHat, LayoutList, LogOut, Megaphone, Menu as MenuIcon, MonitorSmartphone, QrCode, Settings, Users, X } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { useStaffProfile } from "./adminData";
import { fr } from "../../i18n/fr";
import { AdminContentSkeleton } from "../../components/Skeletons";
import { cn } from "../../lib/utils";
import { Button } from "../../components/ui/button";

export default function AdminLayout() {
  const { staff, cafe } = useStaffProfile();
  const signOut = useAuthStore((s) => s.signOut);
  const location = useLocation();
  const isAdminArea = location.pathname.startsWith("/admin");
  const [open, setOpen] = useState(false);
  const isOwner = staff.role === "owner";

  const links = [
    { to: "/admin", label: fr.admin.nav.menu, icon: LayoutList, end: true, show: true },
    { to: "/admin/tables", label: fr.admin.nav.tables, icon: QrCode, show: true },
    { to: "/admin/equipe", label: fr.admin.nav.team, icon: Users, show: isOwner },
    { to: "/admin/nouveautes", label: fr.admin.nav.news, icon: Megaphone, show: true },
    { to: "/admin/reglages", label: fr.admin.nav.settings, icon: Settings, show: isOwner },
  ].filter((l) => l.show);

  const nav = (
    <nav className={`flex h-full flex-col gap-1 p-3 ${isAdminArea ? "text-white" : ""}`} aria-label={fr.admin.nav.menu}>
      {isAdminArea ? <div className="mb-4 flex items-center gap-3 px-2 py-2">
        <ChefHat className="h-8 w-8 shrink-0 text-[#d4a84f]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold">{cafe.name}</p>
          <p className="truncate text-xs text-white/65">{staff.display_name} · {fr.admin.roles[staff.role]}</p>
        </div>
      </div> : <div className="mb-4 px-2"><p className="truncate text-lg font-bold">{cafe.name}</p><p className="truncate text-xs text-muted">{staff.display_name} · {fr.admin.roles[staff.role]}</p></div>}
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-card px-3 text-sm font-semibold transition-colors",
              isAdminArea ? "min-h-[48px]" : "min-h-[44px]",
              isAdminArea
                ? isActive ? "bg-gradient-to-r from-[#e2bd6f] to-[#b5822e] text-[#17130b] shadow-sm" : "text-white/85 hover:bg-white/10"
                : isActive ? "bg-accent text-accent-fg" : "text-ink hover:bg-surface-2",
            )
          }
        >
          <l.icon className="h-5 w-5" aria-hidden="true" />
          {l.label}
        </NavLink>
      ))}
      <div className={`mt-auto space-y-1 border-t pt-3 ${isAdminArea ? "border-white/15" : "border-line"}`}>
        <Link to="/staff" className={`flex min-h-[44px] items-center gap-3 rounded-card px-3 text-sm font-semibold ${isAdminArea ? "text-white/85 hover:bg-white/10" : "hover:bg-surface-2"}`}>
          <MonitorSmartphone className="h-5 w-5" aria-hidden="true" />
          {fr.admin.nav.service}
        </Link>
        <button type="button" onClick={() => void signOut(null)} className={`flex min-h-[44px] w-full items-center gap-3 rounded-card px-3 text-sm font-semibold ${isAdminArea ? "text-white/85 hover:bg-white/10" : "hover:bg-surface-2"}`}>
          <LogOut className="h-5 w-5" aria-hidden="true" />
          {fr.common.logout}
        </button>
      </div>
    </nav>
  );

  return (
    <div className={`min-h-screen bg-bg text-ink lg:flex ${isAdminArea ? "admin-menu-shell" : ""}`}>
      <aside className={`hidden w-64 shrink-0 lg:block ${isAdminArea ? "border-r border-white/10 bg-[#111110]" : "border-r border-line bg-surface"}`}>
        <div className="sticky top-0 h-screen">{nav}</div>
      </aside>

      <header className={`sticky top-0 z-30 flex items-center gap-2 border-b px-3 py-3 lg:hidden ${isAdminArea ? "border-white/10 bg-[#111110] text-white" : "border-line bg-surface"}`}>
        {!isAdminArea && <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label={fr.common.menuOpen} aria-expanded={open}>
          <MenuIcon className="h-5 w-5" aria-hidden="true" />
        </Button>}
        {isAdminArea && <ChefHat className="h-7 w-7 text-[#d4a84f]" aria-hidden="true" />}
          {!isAdminArea && <p className="truncate font-bold">{cafe.name}</p>}
          {isAdminArea && <div className="min-w-0"><p className="truncate font-bold">{cafe.name}</p><p className="truncate text-xs text-white/65">{staff.display_name} · {fr.admin.roles[staff.role]}</p></div>}
      </header>

      {open && !isAdminArea && (
        <div className="fixed inset-0 z-40 bg-overlay lg:hidden" onClick={() => setOpen(false)}>
          <div className="h-full w-72 bg-surface" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end p-2">
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label={fr.common.close}>
                <X className="h-5 w-5" aria-hidden="true" />
              </Button>
            </div>
            {nav}
          </div>
        </div>
      )}

      <main className={`min-w-0 flex-1 p-4 lg:p-8 ${isAdminArea ? "pb-24 lg:pb-8" : ""}`}>
        <div className={`mx-auto ${isAdminArea ? "max-w-[1500px]" : "max-w-4xl"}`}>
          <Suspense fallback={<AdminContentSkeleton />}><Outlet /></Suspense>
        </div>
      </main>
      {isAdminArea && <nav style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }} className="safe-bottom fixed inset-x-0 bottom-0 z-30 grid border-t border-white/10 bg-[#111110] px-1 pt-2 text-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] lg:hidden" aria-label={fr.admin.nav.menu}>
        {links.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => cn("flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold", isActive ? "bg-gradient-to-b from-[#e2bd6f] to-[#b5822e] text-[#17130b]" : "text-white/80")}>
          <l.icon className="h-5 w-5" aria-hidden="true" />
          <span className="max-w-full truncate">{l.label}</span>
        </NavLink>)}
      </nav>}
    </div>
  );
}

