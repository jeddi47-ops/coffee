import { useState } from "react";
import type { OrderStatus, StaffOrder } from "../../types/api";
import { Button } from "../../components/ui/button";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { formatMoney } from "../../lib/money";
import { formatTime, minutesSince } from "../../lib/time";
import { fr } from "../../i18n/fr";
import { cn } from "../../lib/utils";

const LATE_MINUTES = 2;

/** Seule l'étape suivante est proposée : pending → accepted → preparing → served. */
const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  pending: { to: "accepted", label: fr.staff.accept },
  accepted: { to: "preparing", label: fr.staff.toPreparing },
  preparing: { to: "served", label: fr.staff.toServed },
};

export function OrderCard({
  order,
  currency,
  now,
  busy,
  onTransition,
}: {
  order: StaffOrder;
  currency: string;
  now: number;
  busy: boolean;
  onTransition: (order: StaffOrder, to: OrderStatus) => Promise<void>;
}) {
  const [confirmRefuse, setConfirmRefuse] = useState(false);
  const waited = minutesSince(order.created_at, now);
  const late = order.status === "pending" && waited >= LATE_MINUTES;
  const next = NEXT[order.status];

  return (
    <article
      className={cn(
        "rounded-card border-2 bg-surface p-4",
        late ? "border-warn bg-warn-soft" : "border-line",
      )}
      aria-label={`${fr.staff.tableName(order.table_label)}, ${fr.staff.orderTitle(order.order_number)}`}
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="text-2xl font-black leading-none">{fr.staff.tableName(order.table_label)}</p>
          <p className="mt-1 text-sm text-muted">
            {fr.staff.orderTitle(order.order_number)} · {formatTime(order.created_at)}
          </p>
        </div>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", late ? "bg-warn text-bg" : "bg-surface-2 text-ink")}>
          {fr.staff.waitingFor(waited)}
        </span>
      </header>

      <ul className="mt-3 space-y-1.5">
        {order.items.map((it, i) => (
          <li key={it.id ?? i} className="text-base">
            <span className="font-bold">{it.quantity} ×</span> {it.name}
            {it.note && <p className="ml-6 text-sm font-semibold text-warn">{it.note}</p>}
          </li>
        ))}
      </ul>
      {order.note && (
        <p className="mt-3 rounded-card bg-surface-2 p-2 text-sm">
          <span className="font-bold">{fr.staff.note} : </span>
          {order.note}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between text-sm text-muted">
        <span>{fr.table.status[order.status]}</span>
        <span className="font-semibold text-ink">{formatMoney(order.total_cents, currency)}</span>
      </div>

      <div className="mt-4 flex gap-2">
        {order.status === "pending" && (
          <Button variant="secondary" size="lg" className="flex-1" disabled={busy} onClick={() => setConfirmRefuse(true)}>
            {fr.staff.refuse}
          </Button>
        )}
        {next && (
          <Button size="lg" className="flex-[2]" disabled={busy} onClick={() => void onTransition(order, next.to)}>
            {next.label}
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmRefuse}
        title={fr.staff.refuse}
        message={fr.staff.refuseConfirm(order.order_number)}
        confirmLabel={fr.staff.refuse}
        danger
        onClose={() => setConfirmRefuse(false)}
        onConfirm={() => onTransition(order, "cancelled")}
      />
    </article>
  );
}
