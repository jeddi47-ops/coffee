import type { WaiterCallRow } from "../../types/api";
import { Button } from "../../components/ui/button";
import { minutesSince } from "../../lib/time";
import { fr } from "../../i18n/fr";

export function CallsPanel({
  calls,
  tableLabel,
  now,
  busyId,
  onHandle,
}: {
  calls: WaiterCallRow[];
  tableLabel: (tableId: string) => string;
  now: number;
  busyId: string | null;
  onHandle: (call: WaiterCallRow) => void;
}) {
  if (calls.length === 0) return <p className="py-10 text-center text-muted">{fr.staff.noCalls}</p>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {calls.map((c) => (
        <li key={c.id} className="flex items-center justify-between gap-3 rounded-card border-2 border-danger bg-surface p-4">
          <div>
            <p className="text-2xl font-black">{fr.staff.tableName(tableLabel(c.table_id))}</p>
            <p className="text-sm text-muted">{fr.staff.waitingFor(minutesSince(c.created_at, now))}</p>
          </div>
          <Button size="lg" disabled={busyId === c.id} onClick={() => onHandle(c)}>{fr.staff.handle}</Button>
        </li>
      ))}
    </ul>
  );
}
