// /admin : menu (catégories, produits, photos, promotions, ordre) + aperçu client.
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { publicAssetUrl } from "../../lib/env";
import { formatMoney } from "../../lib/money";
import { ApiError, errorMessage } from "../../lib/errors";
import { buildTheme } from "../../lib/theme";
import { fr } from "../../i18n/fr";
import type { CategoryRow, ProductRow } from "../../types/api";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge, Card } from "../../components/ui/card";
import { Dialog } from "../../components/ui/dialog";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ListSkeleton } from "../../components/Skeletons";
import { MenuView } from "../../components/MenuView";
import { ThemeScope } from "../../components/ThemeScope";
import { ProductForm } from "./ProductForm";
import { assertWritten, buildPreviewMenu, loadCatalog, reorder, useStaffProfile } from "./adminData";

type Confirm = { title: string; message: string; run: () => Promise<void> } | null;

export default function MenuAdminPage() {
  const { cafe } = useStaffProfile();
  const [categories, setCategories] = useState<CategoryRow[] | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [editingCat, setEditingCat] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState<{ product: ProductRow | null; categoryId?: string } | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [preview, setPreview] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await loadCatalog();
      setCategories(data.categories);
      setProducts(data.products);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (fn: () => Promise<void>, onDependency?: string) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError && e.code === "has_dependencies" && onDependency ? onDependency : errorMessage(e));
    } finally {
      await load();
    }
  };

  const addCategory = (e: FormEvent) => {
    e.preventDefault();
    const name = newCategory.trim();
    if (!name || !categories) return;
    void act(async () => {
      const { data, error: insError } = await supabase
        .from("categories")
        .insert({ cafe_id: cafe.id, name, position: categories.length + 1 })
        .select();
      assertWritten(data, insError);
      setNewCategory("");
    });
  };

  const updateCategory = (id: string, values: Partial<CategoryRow>) =>
    act(async () => {
      const { data, error: updError } = await supabase.from("categories").update(values).eq("id", id).select();
      assertWritten(data, updError);
    });

  const moveCategory = (id: string, delta: -1 | 1) =>
    act(async () => {
      for (const u of reorder(categories ?? [], id, delta)) {
        const { data, error: updError } = await supabase.from("categories").update({ position: u.position }).eq("id", u.id).select();
        assertWritten(data, updError);
      }
    });

  const moveProduct = (p: ProductRow, delta: -1 | 1) =>
    act(async () => {
      const siblings = products.filter((x) => x.category_id === p.category_id);
      for (const u of reorder(siblings, p.id, delta)) {
        const { data, error: updError } = await supabase.from("products").update({ position: u.position }).eq("id", u.id).select();
        assertWritten(data, updError);
      }
    });

  const previewMenu = useMemo(
    () => (categories ? buildPreviewMenu(cafe, categories, products) : null),
    [cafe, categories, products],
  );
  const previewTheme = useMemo(() => buildTheme(cafe.theme_accent, cafe.theme_mode), [cafe]);

  if (!categories) return error ? <p role="alert" className="text-danger">{error}</p> : <ListSkeleton rows={5} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{fr.admin.menuTitle}</h1>
        <Button variant="secondary" onClick={() => setPreview(true)}>
          <Eye className="h-4 w-4" aria-hidden="true" />
          {fr.admin.preview}
        </Button>
      </div>
      <p className="rounded-card bg-surface-2 px-4 py-3 text-sm text-muted">{fr.admin.cacheNotice}</p>
      {error && <p role="alert" className="rounded-card bg-danger px-4 py-3 text-sm font-semibold text-danger-fg">{error}</p>}

      <Card>
        <h2 className="text-lg font-semibold">{fr.admin.categories}</h2>
        <form onSubmit={addCategory} className="mt-3 flex gap-2">
          <label htmlFor="new-cat" className="sr-only">{fr.admin.categoryName}</label>
          <Input id="new-cat" placeholder={fr.admin.newCategory} maxLength={80} value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
          <Button type="submit" disabled={!newCategory.trim()}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {fr.common.add}
          </Button>
        </form>
        {categories.length === 0 && <p className="mt-3 text-sm text-muted">{fr.admin.noCategories}</p>}
        <ul className="mt-3 divide-y divide-line">
          {[...categories].sort((a, b) => a.position - b.position).map((c, idx, arr) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 py-2">
              {editingCat?.id === c.id ? (
                <form
                  className="flex flex-1 gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const name = editingCat.name.trim();
                    if (name) void updateCategory(c.id, { name });
                    setEditingCat(null);
                  }}
                >
                  <label htmlFor={`cat-${c.id}`} className="sr-only">{fr.admin.categoryName}</label>
                  <Input id={`cat-${c.id}`} autoFocus maxLength={80} value={editingCat.name} onChange={(e) => setEditingCat({ id: c.id, name: e.target.value })} />
                  <Button type="submit" size="sm">{fr.common.save}</Button>
                </form>
              ) : (
                <span className="min-w-0 flex-1 font-medium">
                  {c.name} {!c.is_visible && <Badge className="ml-2">{fr.admin.hidden}</Badge>}
                </span>
              )}
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" aria-label={`${fr.common.moveUp} ${c.name}`} disabled={idx === 0} onClick={() => void moveCategory(c.id, -1)}>
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button variant="ghost" size="icon" aria-label={`${fr.common.moveDown} ${c.name}`} disabled={idx === arr.length - 1} onClick={() => void moveCategory(c.id, 1)}>
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button variant="ghost" size="icon" aria-label={`${c.is_visible ? fr.admin.hideCategory : fr.admin.showCategory} ${c.name}`} onClick={() => void updateCategory(c.id, { is_visible: !c.is_visible })}>
                  {c.is_visible ? <Eye className="h-4 w-4" aria-hidden="true" /> : <EyeOff className="h-4 w-4" aria-hidden="true" />}
                </Button>
                <Button variant="ghost" size="icon" aria-label={`${fr.common.edit} ${c.name}`} onClick={() => setEditingCat({ id: c.id, name: c.name })}>
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`${fr.common.delete} ${c.name}`}
                  onClick={() =>
                    setConfirm({
                      title: fr.common.delete,
                      message: fr.admin.deleteCategoryConfirm(c.name),
                      run: () =>
                        act(async () => {
                          const { data, error: delError } = await supabase.from("categories").delete().eq("id", c.id).select();
                          assertWritten(data, delError);
                        }, fr.admin.categoryNotEmpty),
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">{fr.admin.products}</h2>
        <Button onClick={() => setForm({ product: null })} disabled={categories.length === 0}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {fr.admin.newProduct}
        </Button>
      </div>

      {[...categories].sort((a, b) => a.position - b.position).map((c) => {
        const items = products.filter((p) => p.category_id === c.id).sort((a, b) => a.position - b.position);
        return (
          <Card key={c.id}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">{c.name}</h3>
              <Button variant="ghost" size="sm" onClick={() => setForm({ product: null, categoryId: c.id })}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                {fr.common.add}
              </Button>
            </div>
            {items.length === 0 && <p className="mt-2 text-sm text-muted">{fr.admin.emptyCategory}</p>}
            <ul className="mt-2 divide-y divide-line">
              {items.map((p, idx) => {
                const img = publicAssetUrl(p.image_path);
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 py-2">
                    {img ? (
                      <img src={img} alt="" className="aspect-[4/3] w-16 rounded-card object-cover" loading="lazy" />
                    ) : (
                      <span aria-hidden="true" className="flex h-12 w-16 items-center justify-center rounded-card bg-surface-2 font-bold text-muted">
                        {p.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-sm text-muted">
                        {formatMoney(p.price_cents, cafe.currency)}
                        {!p.is_available && <Badge className="ml-2">{fr.menu.unavailable}</Badge>}
                        {p.is_promoted && <Badge className="ml-2">{p.promo_label || fr.menu.featured}</Badge>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" aria-label={`${fr.common.moveUp} ${p.name}`} disabled={idx === 0} onClick={() => void moveProduct(p, -1)}>
                        <ArrowUp className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={`${fr.common.moveDown} ${p.name}`} disabled={idx === items.length - 1} onClick={() => void moveProduct(p, 1)}>
                        <ArrowDown className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={`${fr.common.edit} ${p.name}`} onClick={() => setForm({ product: p })}>
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`${fr.common.delete} ${p.name}`}
                        onClick={() =>
                          setConfirm({
                            title: fr.common.delete,
                            message: fr.admin.deleteProductConfirm(p.name),
                            run: () =>
                              act(async () => {
                                const { data, error: delError } = await supabase.from("products").delete().eq("id", p.id).select();
                                assertWritten(data, delError);
                              }),
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}

      <ProductForm
        open={Boolean(form)}
        onClose={() => setForm(null)}
        onSaved={() => void load()}
        cafeId={cafe.id}
        categories={[...categories].sort((a, b) => a.position - b.position)}
        product={form?.product ?? null}
        defaultCategoryId={form?.categoryId}
        nextPosition={
          products.filter((p) => p.category_id === (form?.product?.category_id ?? form?.categoryId ?? categories[0]?.id)).length + 1
        }
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        confirmLabel={fr.common.delete}
        danger
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm?.run()}
      />

      <Dialog open={preview} onClose={() => setPreview(false)} title={fr.admin.previewTitle} className="max-w-md">
        {previewMenu && (
          <div className="-m-4 max-h-[75vh] overflow-y-auto">
            <ThemeScope theme={previewTheme} className="pb-8">
              <MenuView menu={previewMenu} showTable />
            </ThemeScope>
          </div>
        )}
      </Dialog>
    </div>
  );
}
