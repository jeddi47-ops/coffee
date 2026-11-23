import { useEffect, useRef, useState } from "react";
import { enablePush } from "../lib/webpush";
import type QrScanner from "qr-scanner";
import { supabase } from "../lib/supabase";
import { qrSvg, svgDataUrl } from "../lib/qr";
import { publicAssetUrl } from "../lib/env";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input, Textarea } from "../components/ui/input";
import { Field } from "../components/ui/label";
import { ListSkeleton } from "../components/Skeletons";
import { useStaffProfile, uploadImage } from "./admin/adminData";

async function rpc<T>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error)
    throw Object.assign(
      new Error(
        (/^PT/.test(error.code) ? error.details : null) ||
          "Impossible de terminer cette action. Réessayez.",
      ),
      { code: error.message },
    );
  return data as T;
}
type LoyaltyCard = {
  id: string;
  name: string;
  customer_name: string;
  stamps: number;
  target: number;
  reward: string;
  rule: string;
  color: string;
  logo_path: string | null;
  enabled: boolean;
};
type Program = {
  cafe_id: string;
  enabled: boolean;
  rule: string;
  reward: string;
  color: string;
  logo_path: string | null;
  target: number | "";
  cooldown_minutes: number | "";
  reminder_days: number | "";
};
type Event = {
  kind: string;
  delta: number;
  balance: number;
  note: string;
  actor_name: string;
  created_at: string;
};
type OwnerCard = LoyaltyCard & {
  last_visit_at: string | null;
  events: Event[];
};
const message = (e: unknown) =>
  e instanceof Error ? e.message : "Une erreur est survenue.";
function Balance({ card }: { card: LoyaltyCard }) {
  const progress = Math.min(card.stamps, card.target);
  return (
    <>
      <p className="text-3xl font-bold">
        {card.stamps}{" "}
        <span className="text-base font-normal text-muted">
          / {card.target} tampons
        </span>
      </p>
      <div className="my-3 flex flex-wrap gap-2" aria-hidden="true">
        {Array.from({ length: card.target }, (_, i) => (
          <span
            key={i}
            className={
              i < progress
                ? "flex h-8 w-8 items-center justify-center rounded-full bg-ink text-surface"
                : "h-8 w-8 rounded-full border border-line"
            }
          >
            {i < progress ? "✓" : ""}
          </span>
        ))}
      </div>
      <progress
        className="my-3 h-3 w-full"
        value={progress}
        max={card.target}
        aria-label="Progression de fidélité"
      />
      <p className="font-semibold">{card.reward}</p>
      <p className="mt-2 text-sm text-muted">{card.rule}</p>
      {card.stamps >= card.target && (
        <p className="mt-3 font-semibold">
          Récompense disponible · Présentez votre QR au serveur.
        </p>
      )}
    </>
  );
}
export function CustomerLoyalty() {
  const [push, setPush] = useState("");
  const [data, setData] = useState<{
      token: string;
      cards: LoyaltyCard[];
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const load = () =>
      rpc<{ token: string; cards: LoyaltyCard[] }>("loyalty_account")
        .then((v) => {
          if (active) {
            setData(v);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(message(e));
        });
    void load();
    window.addEventListener("focus", load);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, []);
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold">Mes cartes de fidélité</h2>
      <Button
        variant="secondary"
        onClick={() =>
          void enablePush(true)
            .then((s) =>
              setPush(
                s === "granted"
                  ? "Rappels activés sur cet appareil."
                  : s === "needs-install"
                    ? "Ajoutez Café QR à l’écran d’accueil pour activer les notifications."
                    : s === "not-configured"
                      ? "Les notifications ne sont pas encore configurées."
                      : "Autorisez les notifications dans les réglages du navigateur.",
              ),
            )
            .catch((e) => setError(message(e)))
        }
      >
        Activer les rappels de fidélité
      </Button>
      <Button
        variant="secondary"
        onClick={() =>
          void navigator.serviceWorker
            ?.getRegistration()
            .then((r) => r?.pushManager.getSubscription())
            .then(async (s) => {
              if (s) {
                await rpc("loyalty_unregister_push", {
                  p_endpoint: s.endpoint,
                });
                setPush("Rappels désactivés sur cet appareil.");
              }
            })
            .catch((e) => setError(message(e)))
        }
      >
        Désactiver les rappels
      </Button>
      {push && (
        <p role="status" className="text-sm">
          {push}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {!data && !error && <ListSkeleton rows={2} />}
      {data && (
        <>
          <Card>
            <h3 className="font-bold">Mon QR personnel</h3>
            <p className="mt-1 text-sm text-muted">
              Un seul QR pour vos cartes. Présentez-le au serveur lors de votre
              visite.
            </p>
            <img
              className="mx-auto w-56"
              src={svgDataUrl(qrSvg("CAFEQR:" + data.token, "Mon compte"))}
              alt="Mon QR de fidélité"
            />
          </Card>
          {data.cards.length === 0 && (
            <p className="text-muted">
              Votre première carte apparaîtra après un scan dans un café
              participant.
            </p>
          )}
          {data.cards.map((c) => (
            <Card key={c.id}>
              <div
                className="mb-4 flex items-center gap-3 border-b pb-3"
                style={{ borderColor: c.color }}
              >
                {publicAssetUrl(c.logo_path) && (
                  <img
                    src={publicAssetUrl(c.logo_path)!}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover"
                  />
                )}
                <h3 className="text-lg font-bold">{c.name}</h3>
              </div>
              <Balance card={c} />
              {!c.enabled && (
                <p className="mt-2 text-sm">
                  Programme momentanément suspendu.
                </p>
              )}
            </Card>
          ))}
        </>
      )}
    </section>
  );
}
export function StaffLoyalty() {
  const video = useRef<HTMLVideoElement>(null),
    scanner = useRef<QrScanner | null>(null),
    pending = useRef(false);
  const [running, setRunning] = useState(false),
    [error, setError] = useState(""),
    [card, setCard] = useState<LoyaltyCard | null>(null),
    [token, setToken] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(
    () => () => {
      scanner.current?.destroy();
    },
    [],
  );
  const request = useRef<{ kind: string; token: string; id: string } | null>(
    null,
  );
  async function action(kind: "scan" | "reward", value: string) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    scanner.current?.stop();
    setRunning(false);
    try {
      const result = await rpc<LoyaltyCard>("loyalty_action", {
        p_action: kind,
        p_request_id: (request.current?.kind === kind &&
        request.current.token === value
          ? request.current
          : (request.current = { kind, token: value, id: crypto.randomUUID() })
        ).id,
        p_token: value,
      });
      request.current = null;
      setCard(result);
      setToken(value);
    } catch (e) {
      setError(message(e));
      if (
        kind === "scan" &&
        (e as { code?: string }).code === "loyalty_cooldown"
      ) {
        try {
          setCard(await rpc<LoyaltyCard>("loyalty_lookup", { p_token: value }));
          setToken(value);
        } catch {
          /* Original refusal remains visible. */
        }
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function start() {
    setError("");
    setCard(null);
    setToken("");
    if (!video.current || busy) return;
    setBusy(true);
    try {
      scanner.current?.destroy();
      const { default: Scanner } = await import("qr-scanner");
      scanner.current = new Scanner(
        video.current,
        (r) => {
          const match = /^CAFEQR:([0-9a-f]{36})$/.exec(r.data);
          if (match) void action("scan", match[1]);
          else {
            scanner.current?.stop();
            setRunning(false);
            setError(
              "Présentez le QR personnel disponible dans le compte client.",
            );
          }
        },
        {
          preferredCamera: "environment",
          highlightScanRegion: true,
          maxScansPerSecond: 3,
        },
      );
      // Show the video before requesting playback; display:none prevents some mobile browsers
      // from attaching camera frames even though getUserMedia reports an open camera.
      setRunning(true);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      await scanner.current.start();
    } catch {
      scanner.current?.destroy();
      setRunning(false);
      setError(
        "Caméra inaccessible. Autorisez la caméra dans votre navigateur puis réessayez.",
      );
    } finally {
      setBusy(pending.current);
    }
  }
  return (
    <section className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">Fidélité</h1>
      <p className="text-muted">
        Scannez le QR du client pour lui attribuer un tampon dans votre café.
      </p>
      <video
        ref={video}
        className={
          running || busy
            ? "block min-h-64 w-full rounded-2xl bg-black object-cover"
            : "hidden"
        }
        muted
        playsInline
      />
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <Button disabled={busy} onClick={() => void start()}>
        {running ? "Recommencer le scan" : "Scanner un client"}
      </Button>
      {busy && !running && <p role="status">Activation de la caméra…</p>}
      {running && (
        <Button
          variant="secondary"
          onClick={() => {
            scanner.current?.stop();
            setRunning(false);
          }}
        >
          Arrêter la caméra
        </Button>
      )}
      {busy && <p role="status">Enregistrement…</p>}
      {card && (
        <Card>
          <h2 className="mb-3 font-bold">{card.customer_name}</h2>
          <Balance card={card} />
          {card.stamps >= card.target && (
            <Button
              disabled={busy}
              className="mt-4"
              onClick={() => void action("reward", token)}
            >
              Récompense donnée
            </Button>
          )}
        </Card>
      )}
    </section>
  );
}
export default function LoyaltyAdmin() {
  const { cafe } = useStaffProfile();
  const [program, setProgram] = useState<Program>({
    cafe_id: cafe.id,
    enabled: false,
    rule: "",
    reward: "",
    color: "#b9842d",
    logo_path: null,
    target: 10,
    cooldown_minutes: 60,
    reminder_days: 14,
  });
  const [cards, setCards] = useState<OwnerCard[]>([]),
    [selected, setSelected] = useState<string | null>(null),
    [note, setNote] = useState(""),
    [delta, setDelta] = useState(1),
    [error, setError] = useState(""),
    [info, setInfo] = useState(""),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  const loadCards = async () =>
    setCards(await rpc<OwnerCard[]>("loyalty_owner_cards"));
  useEffect(() => {
    void (async () => {
      try {
        const r = await supabase
          .from("loyalty_programs")
          .select("*")
          .eq("cafe_id", cafe.id)
          .maybeSingle();
        if (r.error) throw new Error("Impossible de charger le programme.");
        if (r.data) setProgram(r.data as Program);
        await loadCards();
        setLoaded(true);
      } catch (e) {
        setError(message(e));
      }
    })();
  }, [cafe.id]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setInfo("");
    try {
      await fn();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const current = cards.find((c) => c.id === selected);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold">Fidélité</h1>
        <p className="mt-2 text-muted">
          Personnalisez vos cartes et retrouvez les visites de vos clients.
        </p>
      </header>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      {info && <p role="status">{info}</p>}
      {!loaded ? (
        <ListSkeleton rows={3} />
      ) : (
        <>
          <Card>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const numericValues = [
                    program.target,
                    program.cooldown_minutes,
                    program.reminder_days,
                  ];
                  if (numericValues.some((value) => value === "")) {
                    throw new Error("Renseignez tous les champs numériques.");
                  }
                  const payload = {
                    ...program,
                    target: Number(program.target),
                    cooldown_minutes: Number(program.cooldown_minutes),
                    reminder_days: Number(program.reminder_days),
                  };
                  const r = await supabase
                    .from("loyalty_programs")
                    .upsert(payload)
                    .select()
                    .single();
                  if (r.error)
                    throw new Error(r.error.message || "Vérifiez les réglages du programme.");
                  setProgram(r.data as Program);
                  setInfo("Programme enregistré.");
                });
              }}
            >
              <label className="flex gap-3">
                <input
                  type="checkbox"
                  checked={program.enabled}
                  onChange={(e) =>
                    setProgram({ ...program, enabled: e.target.checked })
                  }
                />
                Activer la fidélité
              </label>
              <Field label="Votre règle" htmlFor="loyalty-rule">
                <Textarea
                  id="loyalty-rule"
                  required
                  maxLength={1000}
                  placeholder="1 matcha = 1 tampon"
                  value={program.rule}
                  onChange={(e) =>
                    setProgram({ ...program, rule: e.target.value })
                  }
                />
              </Field>
              <Field label="Récompense" htmlFor="loyalty-reward">
                <Input
                  id="loyalty-reward"
                  required
                  maxLength={200}
                  value={program.reward}
                  onChange={(e) =>
                    setProgram({ ...program, reward: e.target.value })
                  }
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                {(
                  [
                    {
                      key: "target",
                      label: "Tampons par récompense",
                      min: 2,
                      max: 100,
                    },
                    {
                      key: "cooldown_minutes",
                      label: "Délai entre tampons (minutes)",
                      min: 1,
                      max: 10080,
                    },
                    {
                      key: "reminder_days",
                      label: "Rappel après (jours)",
                      min: 1,
                      max: 365,
                    },
                  ] as const
                ).map((f) => (
                  <Field
                    key={f.key}
                    label={f.label}
                    htmlFor={"loyalty-" + f.key}
                  >
                    <Input
                      id={"loyalty-" + f.key}
                      type="number"
                      min={f.min}
                      max={f.max}
                      required
                      value={program[f.key]}
                      onChange={(e) =>
                        setProgram({
                          ...program,
                          [f.key]: e.target.value === "" ? "" : Number(e.target.value),
                        })
                      }
                    />
                  </Field>
                ))}
              </div>
              <Field label="Couleur de la carte" htmlFor="loyalty-color">
                <Input
                  id="loyalty-color"
                  type="color"
                  value={program.color}
                  onChange={(e) =>
                    setProgram({ ...program, color: e.target.value })
                  }
                />
              </Field>
              <Field
                label="Logo de la carte (facultatif)"
                htmlFor="loyalty-logo"
              >
                <Input
                  id="loyalty-logo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file)
                      void run(async () =>
                        setProgram({
                          ...program,
                          logo_path: await uploadImage(cafe.id, "logo", file),
                        }),
                      );
                  }}
                />
              </Field>
              <p className="text-sm text-muted">
                Le surplus est conservé après chaque récompense. Un seul rappel
                est envoyé par période d’absence, si le client accepte les
                notifications.
              </p>
              <Button type="submit" disabled={busy}>Enregistrer</Button>
            </form>
          </Card>
          <Card>
            <h2 className="text-xl font-bold">
              Cartes clients · {cards.length}
            </h2>
            {cards.length === 0 && (
              <p className="mt-3 text-muted">
                Les premiers clients apparaîtront après leur passage en caisse.
              </p>
            )}
            <ul className="divide-y divide-line">
              {cards.map((c) => (
                <li key={c.id}>
                  <button
                    className="flex w-full justify-between gap-4 py-4 text-left"
                    onClick={() => {
                      setSelected(c.id);
                      setNote("");
                    }}
                  >
                    <span>{c.customer_name}</span>
                    <strong>{c.stamps} tampons</strong>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          {current && (
            <Card>
              <h2 className="text-lg font-bold">{current.customer_name}</h2>
              <p className="my-3">Solde : {current.stamps} tampons</p>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    await rpc("loyalty_action", {
                      p_action: "adjust",
                      p_request_id: crypto.randomUUID(),
                      p_card_id: current.id,
                      p_delta: delta,
                      p_note: note,
                    });
                    await loadCards();
                    setNote("");
                    setInfo("Correction enregistrée dans l’historique.");
                  });
                }}
              >
                <Field
                  label="Correction (+ pour ajouter, − pour retirer)"
                  htmlFor="loyalty-delta"
                >
                  <Input
                    id="loyalty-delta"
                    type="number"
                    min={-100}
                    max={100}
                    required
                    value={delta}
                    onChange={(e) => setDelta(Number(e.target.value))}
                  />
                </Field>
                <Field label="Motif de correction" htmlFor="loyalty-note">
                  <Input
                    id="loyalty-note"
                    required
                    maxLength={300}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </Field>
                <Button disabled={busy || delta === 0}>
                  Appliquer la correction
                </Button>
              </form>
              <h3 className="mt-6 font-bold">Dernières opérations</h3>
              <ul className="divide-y divide-line">
                {current.events.map((e, i) => (
                  <li className="py-3 text-sm" key={i}>
                    <strong>
                      {e.delta > 0 ? "+" : ""}
                      {e.delta} tampons
                    </strong>{" "}
                    · {e.actor_name}
                    <p className="text-muted">
                      {new Date(e.created_at).toLocaleString("fr-FR")} ·{" "}
                      {e.kind === "reward"
                        ? "Récompense donnée"
                        : e.kind === "scan"
                          ? "Scan"
                          : "Correction"}{" "}
                      · solde {e.balance}
                    </p>
                    {e.note && <p>{e.note}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
