// /admin/nouveautes : brouillons, envoi par email (via send-announcement), lecture seule après envoi.
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ImagePlus, Megaphone, Plus, Send, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { publicAssetUrl } from "../../lib/env";
import { staffFunctions, staffRpc } from "../../lib/api";
import { errorMessage, fromPostgrest } from "../../lib/errors";
import { formatDateTime } from "../../lib/time";
import { ACCEPTED_IMAGE_TYPES } from "../../lib/image";
import { fr } from "../../i18n/fr";
import type { AnnouncementRow } from "../../types/api";
import { Button } from "../../components/ui/button";
import { Input, Textarea } from "../../components/ui/input";
import { Field } from "../../components/ui/label";
import { Badge, Card } from "../../components/ui/card";
import { Dialog } from "../../components/ui/dialog";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ListSkeleton } from "../../components/Skeletons";
import { assertWritten, imageErrorMessage, removeImage, uploadImage, useStaffProfile } from "./adminData";

export default function AnnouncementsPage() {
  const { cafe } = useStaffProfile();
  const [items, setItems] = useState<AnnouncementRow[] | null>(null);
  const [editing, setEditing] = useState<AnnouncementRow | "new" | null>(null);
  const [viewing, setViewing] = useState<AnnouncementRow | null>(null);
  const [toSend, setToSend] = useState<{ ann: AnnouncementRow; subscribers: number } | null>(null);
  const [toDelete, setToDelete] = useState<AnnouncementRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from("announcements")
      .select("id, cafe_id, title, body, image_path, status, sent_count, sent_at, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (loadError) setError(errorMessage(fromPostgrest(loadError)));
    else setItems((data ?? []) as AnnouncementRow[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const askSend = async (ann: AnnouncementRow) => {
    setError(null);
    setInfo(null);
    try {
      const followers = await staffRpc.listFollowers(1);
      setToSend({ ann, subscribers: followers.active_subscribers });
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const send = async (ann: AnnouncementRow) => {
    try {
      const res = await staffFunctions.sendAnnouncement(ann.id);
      setInfo(fr.admin.sendResult(res.sent_count, res.failed_count));
    } catch (e) {
      setError(errorMessage(e)); // announcement_quota, announcement_already_sent, no_recipients, send_failed
    } finally {
      await load();
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{fr.admin.newsTitle}</h1>
          <p className="mt-2 text-base text-muted">Partagez les actualités de votre café avec vos clients. {fr.admin.quotaHint}</p>
        </div>
        <Button className="rounded-2xl bg-gradient-to-r from-[#dfb75e] to-[#b9842d] px-5 text-[#21180b] shadow-sm hover:opacity-90" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {fr.admin.newAnnouncement}
        </Button>
      </header>
      {error && <p role="alert" className="rounded-card bg-danger px-4 py-3 text-sm font-semibold text-danger-fg">{error}</p>}
      {info && <p role="status" className="rounded-2xl border border-[#28764c]/20 bg-[#e7f3eb] px-4 py-3 text-sm font-semibold text-[#1f6b3e]">{info}</p>}

      <Card className="rounded-3xl border-black/[0.06] p-5 shadow-[0_12px_35px_rgba(27,24,19,0.06)] sm:p-7">
        <div className="mb-4 flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f5f2ed]"><Megaphone className="h-6 w-6" aria-hidden="true" /></span><div><h2 className="text-xl font-bold">Vos annonces</h2><p className="mt-1 text-sm text-muted">Brouillons modifiables · annonces envoyées consultables.</p></div></div>
        {!items ? (
          <ListSkeleton rows={3} />
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line p-8 text-center"><p className="text-muted">{fr.admin.noAnnouncements}</p><Button className="mt-4 rounded-2xl bg-gradient-to-r from-[#dfb75e] to-[#b9842d] text-[#21180b]" onClick={() => setEditing("new")}><Plus className="h-4 w-4" aria-hidden="true" />{fr.admin.newAnnouncement}</Button></div>
        ) : (
          <ul className="space-y-3">
            {items.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-black/[0.06] bg-white px-3 py-3 sm:px-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f5f2ed] text-[#806027]"><Megaphone className="h-5 w-5" aria-hidden="true" /></span>
                <button
                  type="button"
                  className="min-h-[44px] min-w-0 flex-1 text-left"
                  onClick={() => (a.status === "draft" ? setEditing(a) : setViewing(a))}
                >
                  <p className="truncate font-semibold">{a.title}</p>
                  <p className="text-xs text-muted">
                    {formatDateTime(a.sent_at ?? a.created_at)}
                    {a.status === "sent" && ` · ${fr.admin.sentCount(a.sent_count)}`}
                  </p>
                </button>
                <Badge className={a.status === "sent" ? "bg-[#e7f3eb] text-[#1f6b3e]" : "bg-[#fff4db] text-[#805c17]"}>{fr.admin.statuses[a.status]}</Badge>
                {a.status === "draft" && (
                  <>
                    <Button size="sm" className="rounded-xl bg-gradient-to-r from-[#dfb75e] to-[#b9842d] text-[#21180b]" onClick={() => void askSend(a)}>
                      <Send className="h-4 w-4" aria-hidden="true" />
                      {fr.admin.send}
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`${fr.common.delete} ${a.title}`} onClick={() => setToDelete(a)}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <AnnouncementEditor
        open={editing !== null}
        announcement={editing === "new" ? null : editing}
        cafeId={cafe.id}
        onClose={() => setEditing(null)}
        onSaved={() => void load()}
      />

      <Dialog open={Boolean(viewing)} onClose={() => setViewing(null)} title={viewing?.title ?? ""}>
        {viewing && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-muted">{fr.admin.readOnly}</p>
            {viewing.image_path && (
              <img src={publicAssetUrl(viewing.image_path) ?? ""} alt="" className="w-full rounded-card object-cover" />
            )}
            <p className="whitespace-pre-line">{viewing.body}</p>
            <p className="text-sm text-muted">{fr.admin.sentCount(viewing.sent_count)}</p>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={Boolean(toSend)}
        title={fr.admin.send}
        message={toSend ? fr.admin.sendConfirm(toSend.subscribers) : ""}
        confirmLabel={fr.admin.send}
        onClose={() => setToSend(null)}
        onConfirm={() => (toSend ? send(toSend.ann) : undefined)}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={fr.common.delete}
        message={fr.admin.deleteDraftConfirm}
        confirmLabel={fr.common.delete}
        danger
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          const { data, error: delError } = await supabase.from("announcements").delete().eq("id", toDelete.id).select();
          try {
            assertWritten(data, delError);
            void removeImage(toDelete.image_path);
          } catch (e) {
            setError(errorMessage(e));
          }
          await load();
        }}
      />
    </div>
  );
}

function AnnouncementEditor({
  open,
  announcement,
  cafeId,
  onClose,
  onSaved,
}: {
  open: boolean;
  announcement: AnnouncementRow | null;
  cafeId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(announcement?.title ?? "");
    setBody(announcement?.body ?? "");
    setFile(null);
    setRemovePhoto(false);
    setError(null);
  }, [open, announcement]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let imagePath = removePhoto ? null : announcement?.image_path ?? null;
      if (file) {
        try {
          imagePath = await uploadImage(cafeId, "announcements", file);
        } catch (err) {
          setError(imageErrorMessage(err));
          return;
        }
      }
      const values = { title: title.trim(), body: body.trim(), image_path: imagePath };
      if (announcement) {
        // RLS : modifiable uniquement tant que l'annonce est en brouillon.
        const { data, error: updError } = await supabase.from("announcements").update(values).eq("id", announcement.id).select();
        assertWritten(data, updError);
        if (announcement.image_path && announcement.image_path !== imagePath) void removeImage(announcement.image_path);
      } else {
        const { data, error: insError } = await supabase.from("announcements").insert({ ...values, cafe_id: cafeId }).select();
        assertWritten(data, insError);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const currentImage = !removePhoto && !file ? publicAssetUrl(announcement?.image_path) : null;

  return (
    <Dialog open={open} onClose={onClose} title={announcement ? fr.common.edit : fr.admin.newAnnouncement}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label={fr.admin.title} htmlFor="a-title" counter={fr.common.chars(title.length, 150)}>
          <Input id="a-title" required maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label={fr.admin.body} htmlFor="a-body" counter={fr.common.chars(body.length, 5000)}>
          <Textarea id="a-body" required rows={6} maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <div className="space-y-2">
          <p className="text-sm font-medium">{fr.admin.photo} ({fr.common.optional})</p>
          {currentImage && <img src={currentImage} alt="" className="w-48 rounded-card border border-line object-cover" />}
          {file && <p className="text-sm text-muted">{file.name}</p>}
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-card border border-line bg-surface px-4 text-sm font-semibold hover:bg-surface-2">
              <ImagePlus className="h-4 w-4" aria-hidden="true" />
              {fr.admin.photoChoose}
              <input type="file" accept={ACCEPTED_IMAGE_TYPES.join(",")} className="sr-only" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setRemovePhoto(false); }} />
            </label>
            {(currentImage || file) && (
              <Button variant="ghost" onClick={() => { setFile(null); setRemovePhoto(true); }}>{fr.admin.photoRemove}</Button>
            )}
          </div>
        </div>
        {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>{fr.common.cancel}</Button>
          <Button type="submit" disabled={busy || !title.trim() || !body.trim()}>{busy ? fr.common.saving : fr.common.save}</Button>
        </div>
      </form>
    </Dialog>
  );
}

