import { useState } from "react";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { fr } from "../i18n/fr";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = fr.common.confirm,
  danger = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      onClose();
    }
  };
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <p className="text-ink">{message}</p>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose} disabled={busy}>{fr.common.cancel}</Button>
        <Button variant={danger ? "danger" : "primary"} onClick={confirm} disabled={busy}>{confirmLabel}</Button>
      </div>
    </Dialog>
  );
}
