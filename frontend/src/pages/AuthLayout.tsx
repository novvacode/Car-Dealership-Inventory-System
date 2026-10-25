import type { ReactNode } from "react";
import { Logo } from "../components/Layout";

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-ink-900 p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(249,115,22,0.25),transparent_55%)]" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full border border-white/5" />
        <div className="pointer-events-none absolute -bottom-40 -left-40 h-[36rem] w-[36rem] rounded-full border border-white/5" />
        <div className="relative">
          <Logo light />
        </div>
        <div className="relative max-w-md">
          <p className="text-sm font-semibold tracking-[0.2em] text-accent-500 uppercase">Dealer Inventory</p>
          <h1 className="mt-4 text-4xl leading-tight font-extrabold text-white">
            Every vehicle on the lot, accounted for in real time.
          </h1>
          <p className="mt-4 text-base text-white/60">
            Search stock, close sales and restock models from one dashboard — with inventory that never oversells.
          </p>
        </div>
        <p className="relative text-xs text-white/40">© {new Date().getFullYear()} Apex Motors</p>
      </aside>

      <section className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h2 className="text-2xl font-extrabold text-ink-900">{title}</h2>
          <p className="mt-1 mb-8 text-sm text-stone-500">{subtitle}</p>
          {children}
        </div>
      </section>
    </div>
  );
}
