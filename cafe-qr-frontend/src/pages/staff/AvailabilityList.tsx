import type { CategoryRow, ProductRow } from "../../types/api";
import { Switch } from "../../components/ui/switch";
import { fr } from "../../i18n/fr";

export function AvailabilityList({
  categories,
  products,
  busyId,
  onToggle,
}: {
  categories: CategoryRow[];
  products: ProductRow[];
  busyId: string | null;
  onToggle: (product: ProductRow, outOfStock: boolean) => void;
}) {
  return (
    <div className="space-y-6">
      {categories.map((c) => {
        const items = products.filter((p) => p.category_id === c.id).sort((a, b) => a.position - b.position);
        if (items.length === 0) return null;
        return (
          <section key={c.id}>
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">{c.name}</h3>
            <ul className="divide-y divide-line rounded-card border border-line bg-surface px-4">
              {items.map((p) => (
                <li key={p.id} className="py-1">
                  <Switch
                    checked={!p.is_available}
                    disabled={busyId === p.id}
                    onChange={(out) => onToggle(p, out)}
                    label={p.name}
                    description={fr.staff.outOfStock}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
