import { useState } from "react";
import type { CafeTableRow, TableSessionRow } from "../../types/api";
import { Button } from "../../components/ui/button";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { formatMoney } from "../../lib/money";
import { fr } from "../../i18n/fr";
import { cn } from "../../lib/utils";

export function TablesView({
  tables,
  sessionsByTable,
  sessionTotals,
  callTables,
  currency,
  staleHours,
  onSettle,
}: {
  tables: CafeTableRow[];
  sessionsByTable: Record<string, TableSessionRow>;
  sessionTotals: Record<string, number>;
  callTables: Set<string>;
  currency: string;
  staleHours: number;
  onSettle: (session: TableSessionRow) => Promise<void>;
}) {
  const [toSettle, setToSettle] = useState<{ session: TableSessionRow; label: string } | null>(null);
  const active = tables.filter((t) => t.is_active);

  return (
    <>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {active.map((t) => {
          const session = sessionsByTable[t.id];
          const calling = callTables.has(t.id);
          const stale =
            session && Date.now() - new Date(session.last_activity_at).getTime() > staleHours * 3600 * 1000;
          return (
            <li
              key={t.id}
              className={cn("rounded-card border-2 bg-surface p-4", calling ? "border-danger" : session ? "border-accent" : "border-line")}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-2xl font-black">{fr.staff.tableName(t.label)}</p>
                <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold">
                  {calling ? fr.staff.tableCall : session ? fr.staff.tableBusy : fr.staff.tableFree}
                </span>
              </div>
              {session && (
                <>
                  <p className="mt-2 text-xl font-bold">{formatMoney(sessionTotals[session.id] ?? 0, currency)}</p>
                  {stale && <p className="text-xs font-semibold text-warn">{fr.staff.tableStale}</p>}
                  <Button variant="secondary" size="lg" className="mt-3 w-full" onClick={() => setToSettle({ session, label: t.label })}>
                    {fr.staff.settle}
                  </Button>
                </>
              )}
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={Boolean(toSettle)}
        title={fr.staff.settle}
        message={toSettle ? fr.staff.settleConfirm(toSettle.label) : ""}
        confirmLabel={fr.staff.settle}
        onClose={() => setToSettle(null)}
        onConfirm={() => (toSettle ? onSettle(toSettle.session) : undefined)}
      />
    </>
  );
}
