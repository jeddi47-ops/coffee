// /admin : barre latérale (menu burger sur mobile). Équipe et Réglages : owner uniquement.
import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { LayoutList, LogOut, Megaphone, Menu as MenuIcon, MonitorSmartphone, QrCode, Settings, Users, X } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { useStaffProfile } from "./adminData";
import { fr } from "../../i18n/fr";
import { cn } from "../../lib/utils";
import { Button } from "../../components/ui/button";

export default function AdminLayout() {
  const { staff, cafe } = useStaffProfile();
  const signOut = useAuthStore((s) => s.signOut);
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
    <nav className="flex h-full flex-col gap-1 p-3" aria-label={fr.admin.nav.menu}>
      <div className="mb-4 px-2">
        <p className="truncate text-lg font-bold">{cafe.name}</p>
        <p className="truncate text-xs text-muted">{staff.display_name} · {fr.admin.roles[staff.role]}</p>
      </div>
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            cn("flex min-h-[44px] items-center gap-3 rounded-card px-3 text-sm font-semibold", isActive ? "bg-accent text-accent-fg" : "text-ink hover:bg-surface-2")
          }
        >
          <l.icon className="h-5 w-5" aria-hidden="true" />
          {l.label}
        </NavLink>
      ))}
      <div className="mt-auto space-y-1 border-t border-line pt-3">
        <Link to="/staff" className="flex min-h-[44px] items-center gap-3 rounded-card px-3 text-sm font-semibold hover:bg-surface-2">
          <MonitorSmartphone className="h-5 w-5" aria-hidden="true" />
          {fr.admin.nav.service}
        </Link>
        <button type="button" onClick={() => void signOut(null)} className="flex min-h-[44px] w-full items-center gap-3 rounded-card px-3 text-sm font-semibold hover:bg-surface-2">
          <LogOut className="h-5 w-5" aria-hidden="true" />
          {fr.common.logout}
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-bg text-ink lg:flex">
      <aside className="hidden w-64 shrink-0 border-r border-line bg-surface lg:block">
        <div className="sticky top-0 h-screen">{nav}</div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-surface px-3 py-2 lg:hidden">
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label={fr.common.menuOpen} aria-expanded={open}>
          <MenuIcon className="h-5 w-5" aria-hidden="true" />
        </Button>
        <p className="truncate font-bold">{cafe.name}</p>
      </header>

      {open && (
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

      <main className="min-w-0 flex-1 p-4 lg:p-8">
        <div className="mx-auto max-w-4xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
