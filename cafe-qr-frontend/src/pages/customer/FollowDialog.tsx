// « Recevoir les nouveautés du café » : lien magique, consentement explicite (case non cochée).
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabase";
import { SITE_URL } from "../../lib/env";
import { customerRpc } from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import { Dialog } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Field } from "../../components/ui/label";
import { fr } from "../../i18n/fr";
import { PENDING_FOLLOW_KEY } from "../auth/AuthCallbackPage";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function FollowDialog({
  open,
  onClose,
  cafeName,
  cafeSlug,
}: {
  open: boolean;
  onClose: () => void;
  cafeName: string;
  cafeSlug: string;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [loggedCustomer, setLoggedCustomer] = useState(false);

  useEffect(() => {
    // Client déjà connecté : un simple appel follow_cafe suffit.
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const { data: c } = await supabase.from("customers").select("id").eq("id", data.session.user.id).maybeSingle();
      setLoggedCustomer(Boolean(c));
    });
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!consent) return setError(fr.follow.consentRequired);
    setBusy(true);
    setError(null);
    try {
      if (loggedCustomer) {
        await customerRpc.followCafe(cafeSlug);
        setDone(fr.follow.alreadyFollowing);
        return;
      }
      if (!EMAIL_RE.test(email.trim())) {
        setError(fr.follow.invalidEmail);
        return;
      }
      localStorage.setItem(PENDING_FOLLOW_KEY, cafeSlug);
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${SITE_URL}/auth/callback`,
          data: {
            signup_type: "customer",
            cafe_slug: cafeSlug,
            display_name: name.trim() || undefined,
            newsletter_opt_in: true, // case cochée explicitement (obligatoire pour envoyer)
          },
        },
      });
      if (otpError) {
        setError(otpError.status === 429 ? fr.errors.rateLimited() : fr.errors.generic);
        return;
      }
      setDone(fr.follow.checkMail);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={fr.follow.title} side="bottom" className="mx-auto max-w-2xl">
      {done ? (
        <div role="status" className="py-4">
          <p className="text-ink">{done}</p>
          <Button className="mt-6 w-full" onClick={onClose}>{fr.common.close}</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <p className="text-sm text-muted">{fr.follow.intro(cafeName)}</p>
          {!loggedCustomer && (
            <>
              <Field label={fr.follow.email} htmlFor="follow-email">
                <Input id="follow-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label={`${fr.follow.name} (${fr.common.optional})`} htmlFor="follow-name">
                <Input id="follow-name" autoComplete="given-name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
            </>
          )}
          <label className="flex min-h-[44px] items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]"
            />
            <span>{fr.follow.consent(cafeName)}</span>
          </label>
          {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={busy || !consent}>
            {busy ? fr.follow.sending : fr.follow.submit}
          </Button>
        </form>
      )}
    </Dialog>
  );
}
