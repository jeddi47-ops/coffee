// /admin/equipe (owner uniquement) : employés, invitations, activation.
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { UserPlus, Users } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { staffFunctions, staffRpc } from "../../lib/api";
import { errorMessage, fromPostgrest } from "../../lib/errors";
import { formatDateTime } from "../../lib/time";
import { fr } from "../../i18n/fr";
import type { StaffMemberRow } from "../../types/api";
import { Button } from "../../components/ui/button";
import { Input, Select } from "../../components/ui/input";
import { Field } from "../../components/ui/label";
import { Badge, Card } from "../../components/ui/card";
import { Switch } from "../../components/ui/switch";
import { ListSkeleton } from "../../components/Skeletons";
import { useStaffProfile } from "./adminData";

export default function StaffAdminPage() {
  const { staff: me } = useStaffProfile();
  const [members, setMembers] = useState<StaffMemberRow[] | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"manager" | "waiter">("waiter");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from("staff_members")
      .select("id, cafe_id, role, display_name, is_active, created_at")
      .order("created_at");
    if (loadError) setError(errorMessage(fromPostgrest(loadError)));
    else setMembers((data ?? []) as StaffMemberRow[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const invite = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await staffFunctions.createStaff({ email: email.trim(), display_name: name.trim(), role });
      setInfo(fr.admin.inviteSent(res.staff_member.email));
      setEmail("");
      setName("");
    } catch (err) {
      setError(errorMessage(err)); // 409 email_already_registered -> message dédié
    } finally {
      setBusy(false);
      await load();
    }
  };

  const toggle = async (m: StaffMemberRow, active: boolean) => {
    setError(null);
    try {
      await staffRpc.setStaffActive(m.id, active);
    } catch (err) {
      setError(errorMessage(err)); // cannot_deactivate_self -> message dédié
    } finally {
      await load();
    }
  };

  return (
    <div className="space-y-6">
      <header><h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{fr.admin.teamTitle}</h1><p className="mt-2 text-base text-muted">Invitez vos employés et gérez leurs accès à l’espace du café.</p></header>
      {error && <p role="alert" className="rounded-card bg-danger px-4 py-3 text-sm font-semibold text-danger-fg">{error}</p>}
      {info && <p role="status" className="rounded-2xl border border-[#28764c]/20 bg-[#e7f3eb] px-4 py-3 text-sm font-semibold text-[#1f6b3e]">{info}</p>}

      <Card className="rounded-3xl border-black/[0.06] p-5 shadow-[0_12px_35px_rgba(27,24,19,0.06)] sm:p-7">
        <div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f5f2ed]"><UserPlus className="h-6 w-6" aria-hidden="true" /></span><div><h2 className="text-xl font-bold">{fr.admin.invite}</h2><p className="mt-1 text-sm text-muted">L’employé recevra un email pour rejoindre votre équipe.</p></div></div>
        <form onSubmit={invite} className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label={fr.auth.email} htmlFor="inv-email">
            <Input id="inv-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label={fr.admin.displayName} htmlFor="inv-name">
            <Input id="inv-name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={fr.admin.role} htmlFor="inv-role">
            <Select id="inv-role" value={role} onChange={(e) => setRole(e.target.value as "manager" | "waiter")}>
              <option value="waiter">{fr.admin.roles.waiter}</option>
              <option value="manager">{fr.admin.roles.manager}</option>
            </Select>
          </Field>
          <div className="flex items-end">
            <Button type="submit" className="w-full rounded-2xl bg-gradient-to-r from-[#dfb75e] to-[#b9842d] text-[#21180b] shadow-sm hover:opacity-90" disabled={busy || !email.trim() || !name.trim()}>
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              {fr.admin.inviteSubmit}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="rounded-3xl border-black/[0.06] p-5 shadow-[0_12px_35px_rgba(27,24,19,0.06)] sm:p-7">
        <div className="mb-3 flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f5f2ed]"><Users className="h-6 w-6" aria-hidden="true" /></span><div><h2 className="text-xl font-bold">Membres de l’équipe</h2><p className="mt-1 text-sm text-muted">Activez ou désactivez l’accès de chaque membre.</p></div></div>
        {!members ? (
          <ListSkeleton rows={3} />
        ) : (
          <ul className="divide-y divide-black/[0.07]">
            {members.map((m) => {
              const self = m.id === me.id;
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-3 py-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f5f2ed] text-sm font-bold text-[#806027]">{m.display_name.trim().slice(0, 1).toLocaleUpperCase("fr")}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {m.display_name} {self && <span className="text-sm font-normal text-muted">({fr.admin.you})</span>}
                    </p>
                    <p className="text-xs text-muted">{formatDateTime(m.created_at)}</p>
                  </div>
                  <Badge className="bg-[#f5f2ed] text-[#60481e]">{fr.admin.roles[m.role]}</Badge>
                  <div className="w-full sm:w-56">
                    <Switch
                      checked={m.is_active}
                      disabled={self}
                      label={m.is_active ? fr.admin.active : fr.admin.inactive}
                      description={self ? fr.admin.selfLocked : undefined}
                      onChange={(v) => void toggle(m, v)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

