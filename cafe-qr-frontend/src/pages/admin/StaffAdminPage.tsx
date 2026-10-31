// /admin/equipe (owner uniquement) : employés, invitations, activation.
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { UserPlus } from "lucide-react";
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
      <h1 className="text-2xl font-bold">{fr.admin.teamTitle}</h1>
      {error && <p role="alert" className="rounded-card bg-danger px-4 py-3 text-sm font-semibold text-danger-fg">{error}</p>}
      {info && <p role="status" className="rounded-card bg-surface-2 px-4 py-3 text-sm font-semibold">{info}</p>}

      <Card>
        <h2 className="text-lg font-semibold">{fr.admin.invite}</h2>
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
            <Button type="submit" className="w-full" disabled={busy || !email.trim() || !name.trim()}>
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              {fr.admin.inviteSubmit}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        {!members ? (
          <ListSkeleton rows={3} />
        ) : (
          <ul className="divide-y divide-line">
            {members.map((m) => {
              const self = m.id === me.id;
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {m.display_name} {self && <span className="text-sm font-normal text-muted">({fr.admin.you})</span>}
                    </p>
                    <p className="text-xs text-muted">{formatDateTime(m.created_at)}</p>
                  </div>
                  <Badge>{fr.admin.roles[m.role]}</Badge>
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
