import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { fr } from "../i18n/fr";

function Loading({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div role="status" className={className}>
      <span className="sr-only">{fr.common.loading}</span>
      <div aria-hidden="true" className="motion-safe:animate-pulse">{children}</div>
    </div>
  );
}

function Block({ size }: { size: string }) {
  return <div className={`rounded-lg bg-surface-2 ${size}`} />;
}

const card = "min-w-0 space-y-3 rounded-2xl border border-line bg-surface p-4";

function Rows({ count }: { count: number }) {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <Block size="h-11 w-11 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Block size="h-3 w-1/2 max-w-48" />
            <Block size="h-2 w-1/3 max-w-28" />
          </div>
          <Block size="h-5 w-12 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return <Loading><Rows count={rows} /></Loading>;
}

export function MenuSkeleton() {
  return (
    <Loading className="mx-auto max-w-2xl overflow-hidden px-4 pt-4">
      <Block size="mx-auto h-16 w-16 rounded-full" />
      <Block size="mx-auto mt-3 h-6 w-40" />
      <Block size="mx-auto mt-2 h-5 w-20 rounded-full" />
      <Block size="mt-5 h-12 w-full rounded-full" />
      {[0, 1].map(section => (
        <div key={section} className="mt-6">
          <Block size="mb-3 h-5 w-28" />
          <div className="flex gap-3 overflow-hidden">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="w-[40vw] max-w-44 shrink-0 space-y-2">
                <Block size="aspect-[4/3] rounded-xl" />
                <Block size="h-3 w-3/4" /><Block size="h-3 w-1/3" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </Loading>
  );
}

function Metrics() {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    {[0, 1, 2, 3].map(i => <div key={i} className={card}>
      <Block size="h-3 w-2/3" /><Block size="h-8 w-1/3" /><Block size="h-2 w-1/2" />
    </div>)}
  </div>;
}

export function MetricsSkeleton() {
  return <Loading><Metrics /></Loading>;
}

export function AdminContentSkeleton() {
  const { pathname } = useLocation();
  const tables = pathname.replace(/\/+$/, "") === "/admin/tables";
  return <Loading>
    <Block size="h-9 w-40" /><Block size="mt-3 h-3 w-3/5 max-w-md" />
    <div className={`mt-6 ${card}`}>
      <Block size="h-5 w-36" /><Block size="h-11 w-full" />
      {!tables && <Rows count={3} />}
    </div>
    {tables && <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map(i => <div key={i} className={card}>
        <Block size="h-5 w-24" /><Block size="mx-auto h-44 w-44 max-w-full" /><Block size="h-10 w-2/3" />
      </div>)}
    </div>}
  </Loading>;
}

export function FullPageLoader() {
  const path = useLocation().pathname;
  if (path.startsWith("/m/")) return <MenuSkeleton />;
  if (/^\/admin(?:\/|$)/.test(path)) {
    return <div className="min-h-screen lg:flex">
      <div aria-hidden="true" className="h-16 bg-[#111110] lg:min-h-screen lg:w-64" />
      <div className="flex-1 p-4 lg:p-8"><AdminContentSkeleton /></div>
    </div>;
  }
  if (path === "/platform-admin" || path === "/staff" || path === "/compte") {
    return <Loading className="mx-auto min-h-screen max-w-6xl p-4 sm:p-8">
      <Block size="mb-6 h-8 w-44" />
      {path === "/platform-admin" ? <Metrics /> : <div className={card}><Rows count={4} /></div>}
    </Loading>;
  }
  return <Loading className="mx-auto grid min-h-screen max-w-sm content-center px-4">
    <div className="space-y-4 rounded-card border border-line bg-surface p-6">
      <Block size="mx-auto h-12 w-12 rounded-full" /><Block size="mx-auto h-5 w-32" />
      <Block size="h-11 w-full" /><Block size="h-11 w-full" /><Block size="h-11 w-full" />
    </div>
  </Loading>;
}
