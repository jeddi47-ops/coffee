// Sons générés avec Web Audio (aucun fichier audio). Déverrouillés par « Démarrer le service ».
type AudioCtor = typeof AudioContext;
let ctx: AudioContext | null = null;

export async function unlockAudio(): Promise<boolean> {
  const Ctor: AudioCtor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
  if (!Ctor) return false;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") await ctx.resume();
  // Bip silencieux pour finaliser le déverrouillage sur iOS.
  tone(440, 0, 0.01, 0.0001);
  return ctx.state === "running";
}

function tone(freq: number, start: number, duration: number, volume = 0.25, type: OscillatorType = "sine") {
  if (!ctx) return;
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

/** Nouvelle commande : deux notes montantes, douces. */
export function playOrderSound(): void {
  tone(660, 0, 0.18);
  tone(880, 0.2, 0.28);
}

/** Appel serveur : trois impulsions rapides, plus aiguës et plus sèches. */
export function playCallSound(): void {
  tone(1175, 0, 0.1, 0.3, "triangle");
  tone(1175, 0.16, 0.1, 0.3, "triangle");
  tone(1175, 0.32, 0.1, 0.3, "triangle");
}

const SOUND_KEY = "cafeqr-sound";
export const loadSoundPref = (): boolean => localStorage.getItem(SOUND_KEY) !== "off";
export const saveSoundPref = (on: boolean): void => localStorage.setItem(SOUND_KEY, on ? "on" : "off");
