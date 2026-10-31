import { fr } from "../i18n/fr";

export default function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center p-6 text-center">
      <p className="text-5xl font-bold text-muted" aria-hidden="true">404</p>
      <h1 className="mt-4 text-xl font-semibold">{fr.notFound.title}</h1>
      <p className="mt-2 text-muted">{fr.notFound.text}</p>
    </main>
  );
}
