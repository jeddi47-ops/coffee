import { useEffect, useState, type FormEvent } from "react";
import { ImagePlus, Trash2, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { publicAssetUrl } from "../../lib/env";
import { centsToInput, parseMoneyInput } from "../../lib/money";
import { errorMessage } from "../../lib/errors";
import { ACCEPTED_IMAGE_TYPES } from "../../lib/image";
import { Dialog } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input, Select, Textarea } from "../../components/ui/input";
import { Field } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import { fr } from "../../i18n/fr";
import type { CategoryRow, ProductRow } from "../../types/api";
import { assertWritten, imageErrorMessage, removeImage, uploadImage } from "./adminData";

const MAX_EXTRA_PHOTOS = 3;

export function ProductForm({
  open,
  onClose,
  onSaved,
  cafeId,
  categories,
  product,
  defaultCategoryId,
  nextPosition,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  cafeId: string;
  categories: CategoryRow[];
  product: ProductRow | null;
  defaultCategoryId?: string;
  nextPosition: number;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [available, setAvailable] = useState(true);
  const [promoted, setPromoted] = useState(false);
  const [promoLabel, setPromoLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [extraKept, setExtraKept] = useState<string[]>([]);
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  const [extraPreviews, setExtraPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(product?.name ?? "");
    setDescription(product?.description ?? "");
    setPrice(product ? centsToInput(product.price_cents) : "");
    setCategoryId(product?.category_id ?? defaultCategoryId ?? categories[0]?.id ?? "");
    setAvailable(product?.is_available ?? true);
    setPromoted(product?.is_promoted ?? false);
    setPromoLabel(product?.promo_label ?? "");
    setFile(null);
    setFilePreview(null);
    setRemovePhoto(false);
    setExtraKept(product?.extra_image_paths ?? []);
    setExtraFiles([]);
    setError(null);
    setPriceError(null);
  }, [open, product, defaultCategoryId, categories]);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const urls = extraFiles.map((f) => URL.createObjectURL(f));
    setExtraPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [extraFiles]);

  const canAddExtra = extraKept.length + extraFiles.length < MAX_EXTRA_PHOTOS;
  const currentImage = filePreview ?? (!removePhoto ? publicAssetUrl(product?.image_path) : null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cents = parseMoneyInput(price);
    if (cents === null) {
      setPriceError(fr.admin.priceInvalid);
      return;
    }
    setPriceError(null);
    setBusy(true);
    setError(null);
    let imagePath = removePhoto ? null : product?.image_path ?? null;
    const uploaded: string[] = []; // fichiers envoyés pendant cet enregistrement (supprimés si ça échoue)
    try {
      try {
        if (file) {
          imagePath = await uploadImage(cafeId, "products", file);
          uploaded.push(imagePath);
        }
        for (const f of extraFiles) uploaded.push(await uploadImage(cafeId, "products", f));
      } catch (err) {
        await Promise.all(uploaded.map((p) => removeImage(p)));
        setError(imageErrorMessage(err));
        return;
      }
      const newExtra = file ? uploaded.slice(1) : uploaded;
      const extraPaths = [...extraKept, ...newExtra];
      const values = {
        name: name.trim(),
        description: description.trim() || null,
        price_cents: cents,
        category_id: categoryId,
        is_available: available,
        is_promoted: promoted,
        promo_label: promoted ? promoLabel.trim() || null : null,
        image_path: imagePath,
        extra_image_paths: extraPaths,
      };
      if (product) {
        const { data, error: updError } = await supabase.from("products").update(values).eq("id", product.id).select();
        assertWritten(data, updError);
        if (product.image_path && product.image_path !== imagePath) void removeImage(product.image_path);
        for (const old of product.extra_image_paths ?? []) if (!extraPaths.includes(old)) void removeImage(old);
      } else {
        const { data, error: insError } = await supabase
          .from("products")
          .insert({ ...values, cafe_id: cafeId, position: nextPosition })
          .select();
        assertWritten(data, insError);
      }
      onSaved();
      onClose();
    } catch (err) {
      await Promise.all(uploaded.map((p) => removeImage(p)));
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={product ? fr.admin.editProduct : fr.admin.newProduct}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label={fr.admin.productName} htmlFor="p-name" counter={fr.common.chars(name.length, 120)}>
          <Input id="p-name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={`${fr.admin.description} (${fr.common.optional})`} htmlFor="p-desc" counter={fr.common.chars(description.length, 1000)}>
          <Textarea id="p-desc" rows={3} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={fr.admin.price} htmlFor="p-price" hint={fr.admin.priceHint} error={priceError}>
            <Input id="p-price" inputMode="decimal" required value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
          <Field label={fr.admin.category} htmlFor="p-cat">
            <Select id="p-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        </div>
        <Switch checked={available} onChange={setAvailable} label={fr.admin.available} />
        <Switch checked={promoted} onChange={setPromoted} label={fr.admin.promoted} />
        {promoted && (
          <Field label={fr.admin.promoLabel} htmlFor="p-promo" counter={fr.common.chars(promoLabel.length, 60)}>
            <Input id="p-promo" maxLength={60} placeholder={fr.admin.promoLabelPlaceholder} value={promoLabel} onChange={(e) => setPromoLabel(e.target.value)} />
          </Field>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium">{fr.admin.photo}</p>
          {currentImage && (
            <img src={currentImage} alt="" className="aspect-[4/3] w-48 rounded-card border border-line object-cover" />
          )}
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-card border border-line bg-surface px-4 text-sm font-semibold hover:bg-surface-2">
              <ImagePlus className="h-4 w-4" aria-hidden="true" />
              {fr.admin.photoChoose}
              <input
                type="file"
                accept={ACCEPTED_IMAGE_TYPES.join(",")}
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  setRemovePhoto(false);
                }}
              />
            </label>
            {currentImage && (
              <Button variant="ghost" onClick={() => { setFile(null); setFilePreview(null); setRemovePhoto(true); }}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {fr.admin.photoRemove}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted">{fr.admin.photoHint}</p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">{fr.admin.photosExtra}</p>
          {(extraKept.length > 0 || extraFiles.length > 0) && (
            <ul className="flex flex-wrap gap-3">
              {extraKept.map((path) => (
                <li key={path} className="relative">
                  <img src={publicAssetUrl(path) ?? ""} alt="" className="aspect-[4/3] w-24 rounded-card border border-line object-cover" />
                  <button
                    type="button"
                    onClick={() => setExtraKept(extraKept.filter((p) => p !== path))}
                    aria-label={fr.admin.photoRemoveOne}
                    className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface shadow"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
              {extraFiles.map((f, i) => (
                <li key={`${f.name}-${i}`} className="relative">
                  <img src={extraPreviews[i]} alt="" className="aspect-[4/3] w-24 rounded-card border border-line object-cover" />
                  <button
                    type="button"
                    onClick={() => setExtraFiles(extraFiles.filter((_, j) => j !== i))}
                    aria-label={fr.admin.photoRemoveOne}
                    className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface shadow"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {canAddExtra ? (
            <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-card border border-line bg-surface px-4 text-sm font-semibold hover:bg-surface-2">
              <ImagePlus className="h-4 w-4" aria-hidden="true" />
              {fr.admin.photoAdd}
              <input
                type="file"
                accept={ACCEPTED_IMAGE_TYPES.join(",")}
                multiple
                className="sr-only"
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  setExtraFiles([...extraFiles, ...picked].slice(0, MAX_EXTRA_PHOTOS - extraKept.length));
                }}
              />
            </label>
          ) : (
            <p className="text-xs text-muted">{fr.admin.photosMax}</p>
          )}
          <p className="text-xs text-muted">{fr.admin.photosExtraHint}</p>
        </div>

        {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>{fr.common.cancel}</Button>
          <Button type="submit" disabled={busy || !name.trim() || !categoryId}>
            {busy ? (file || extraFiles.length > 0 ? fr.admin.photoUploading : fr.common.saving) : fr.common.save}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
