import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { getPublicPlans } from "@/lib/billing.functions";
import { AuthModal } from "@/components/AuthModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FolderCheck,
  Users,
  ShieldCheck,
  CalendarRange,
  FileStack,
  History,
  Check,
  ArrowRight,
  Upload,
  Clock,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { auth?: "1" } => ({
    ...(search.auth === "1" ? { auth: "1" as const } : {}),
  }),
  head: () => ({
    meta: [
      { title: "CADesk — Client Document Collection for CA Firms" },
      {
        name: "description",
        content:
          "Collect, review and approve client documents by financial year. Multi-tenant practice management built for Chartered Accountant firms in India.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: FolderCheck,
    title: "Document collection, done right",
    text: "Send checklists, track uploads, approve or request re-uploads — with full version history.",
    color: "bg-blue-50 text-blue-600",
    border: "border-blue-100",
  },
  {
    icon: FileStack,
    title: "Your templates, not ours",
    text: "Build reusable checklists for ITR, GST, Tax Audit or anything else. Rename, reorder, categorize freely.",
    color: "bg-amber-50 text-amber-600",
    border: "border-amber-100",
  },
  {
    icon: CalendarRange,
    title: "Organized by financial year",
    text: "Every client keeps clean, separate records for FY 2023-24, 2024-25 and beyond. Nothing ever mixes.",
    color: "bg-emerald-50 text-emerald-600",
    border: "border-emerald-100",
  },
  {
    icon: Users,
    title: "Client portal included",
    text: "Clients log in, see exactly what's pending, upload from any device, and track approval status.",
    color: "bg-purple-50 text-purple-600",
    border: "border-purple-100",
  },
  {
    icon: ShieldCheck,
    title: "Roles & permissions",
    text: "Create custom roles for managers and staff. Team members only see the clients assigned to them.",
    color: "bg-rose-50 text-rose-600",
    border: "border-rose-100",
  },
  {
    icon: History,
    title: "Complete audit trail",
    text: "Every upload, approval, download and change is logged with who, what and when.",
    color: "bg-orange-50 text-orange-600",
    border: "border-orange-100",
  },
];

const STATS = [
  { value: "2,400+", label: "Documents collected", color: "text-amber-400" },
  { value: "98%", label: "Client satisfaction", color: "text-emerald-400" },
  { value: "3×", label: "Faster than email", color: "text-sky-400" },
  { value: "100%", label: "Secure & encrypted", color: "text-violet-400" },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    icon: FileStack,
    title: "Create a checklist",
    text: "Build a document template for ITR, GST, or any filing. Add items, set categories, mark what's mandatory.",
    bg: "bg-blue-500",
    stepColor: "text-blue-100",
  },
  {
    step: "02",
    icon: Upload,
    title: "Client uploads",
    text: "Share a secure link. Clients log in, see exactly what's needed, and upload from phone or laptop.",
    bg: "bg-amber-500",
    stepColor: "text-amber-100",
  },
  {
    step: "03",
    icon: Clock,
    title: "Review & approve",
    text: "Your team reviews every document, leaves comments, approves or requests a re-upload — all tracked.",
    bg: "bg-emerald-500",
    stepColor: "text-emerald-100",
  },
];

function formatINR(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

function DashboardIllustration() {
  return (
    <div className="relative mx-auto w-full max-w-2xl">
      <div className="absolute -inset-6 rounded-3xl bg-white/10 blur-3xl" />
      <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur-sm">
        <div className="flex h-64 sm:h-80">
          {/* Sidebar */}
          <div className="hidden w-44 flex-col gap-1 border-r border-white/10 bg-white/5 p-3 sm:flex">
            <div className="mb-2 flex items-center gap-2 px-2 py-1">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-amber-400">
                <FolderCheck className="h-3.5 w-3.5 text-white" />
              </span>
              <span className="text-xs font-semibold text-white">CADesk</span>
            </div>
            {["Dashboard", "Clients", "Requests", "Templates", "Team", "Billing"].map((item, i) => (
              <div
                key={item}
                className={`rounded-md px-2 py-1.5 text-xs ${
                  i === 0
                    ? "bg-white/20 font-medium text-white"
                    : "text-white/50"
                }`}
              >
                {item}
              </div>
            ))}
          </div>
          {/* Content */}
          <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
            <div className="text-sm font-semibold text-white">Good morning, Rajesh 👋</div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Clients", value: "47", color: "text-sky-300" },
                { label: "Pending", value: "12", color: "text-amber-300" },
                { label: "Done", value: "35", color: "text-emerald-300" },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-white/10 bg-white/10 p-2">
                  <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-[10px] text-white/50">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-1.5">
              {[
                { name: "Sharma & Co.", doc: "ITR FY 2024-25", status: "pending", pill: "bg-amber-400/20 text-amber-300" },
                { name: "Mehta Enterprises", doc: "GST Returns", status: "uploaded", pill: "bg-emerald-400/20 text-emerald-300" },
                { name: "Patel Trading", doc: "Tax Audit", status: "approved", pill: "bg-sky-400/20 text-sky-300" },
              ].map((r) => (
                <div
                  key={r.name}
                  className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-1.5"
                >
                  <div>
                    <div className="text-xs font-medium text-white">{r.name}</div>
                    <div className="text-[10px] text-white/40">{r.doc}</div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${r.pill}`}>
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Landing() {
  const fetchPlans = useServerFn(getPublicPlans);
  const { data: plans } = useQuery({
    queryKey: ["public-plans"],
    queryFn: () => fetchPlans(),
  });

  const { auth } = Route.useSearch();
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "signup">("login");

  // Auto-open modal when redirected from /auth (e.g. after email confirmation)
  useEffect(() => {
    if (auth === "1") setAuthOpen(true);
  }, [auth]);

  function openLogin() { setAuthTab("login"); setAuthOpen(true); }
  function openSignup() { setAuthTab("signup"); setAuthOpen(true); }

  return (
    <div className="min-h-screen bg-background font-body">
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} defaultTab={authTab} />

      {/* ── HEADER ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 lg:px-8">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-400">
              <FolderCheck className="h-5 w-5 text-slate-900" />
            </span>
            <span className="font-display text-xl font-semibold text-white">CADesk</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10" onClick={openLogin}>
              Sign in
            </Button>
            <Button size="sm" className="bg-amber-400 text-slate-900 hover:bg-amber-300 font-semibold" onClick={openSignup}>
              Start free trial
            </Button>
          </div>
        </div>
      </header>

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 40%, #1a3a4a 70%, #0f2030 100%)",
        }}
      >
        {/* Decorative circles */}
        <div className="pointer-events-none absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-3xl" />
        <div className="pointer-events-none absolute top-1/2 -left-24 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-1/4 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />

        {/* Dot grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative mx-auto max-w-6xl px-4 py-20 lg:px-8 lg:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-sm font-medium text-amber-300">
                <Zap className="h-3.5 w-3.5" /> Built for Chartered Accountant firms
              </span>
              <h1 className="mt-5 font-display text-4xl font-semibold leading-tight text-white md:text-5xl lg:text-6xl">
                Stop chasing<br className="hidden sm:block" />
                <span className="text-amber-400"> clients</span> for<br className="hidden sm:block" /> documents.
              </h1>
              <p className="mt-5 max-w-lg text-lg text-blue-100/70">
                CADesk gives your firm a secure portal where clients upload exactly what you
                need — organized by financial year, reviewed by your team, tracked to the last version.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" className="bg-amber-400 text-slate-900 hover:bg-amber-300 font-semibold gap-2" onClick={openSignup}>
                  Register your firm — 7 days free <ArrowRight className="h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" className="border-white/40 text-white bg-white/10 hover:bg-white/20 hover:text-white" onClick={openLogin}>
                  Client login
                </Button>
              </div>
              <div className="mt-8 flex flex-wrap gap-5 text-sm text-blue-200/60">
                {["No credit card required", "Set up in 5 minutes", "Cancel anytime"].map((t) => (
                  <span key={t} className="flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-emerald-400" /> {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="lg:pl-4">
              <DashboardIllustration />
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ────────────────────────────────────────────── */}
      <section className="border-y border-white/10 bg-slate-800">
        <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <div className={`font-display text-3xl font-bold ${s.color}`}>{s.value}</div>
                <div className="mt-1 text-sm font-medium text-slate-400">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
      <section className="bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-16 lg:px-8">
          <div className="text-center">
            <span className="inline-block rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-400 mb-3">How it works</span>
            <h2 className="font-display text-3xl font-semibold text-white">Three steps to a paperless practice</h2>
            <p className="mt-3 text-slate-400">Simple enough to set up today, powerful enough to run your entire firm.</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-8">
                <div className="absolute right-5 top-4 font-display text-7xl font-bold text-white/5 select-none">
                  {item.step}
                </div>
                <span className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl ${item.bg}`}>
                  <item.icon className="h-6 w-6 text-white" />
                </span>
                <h3 className="font-display text-xl font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────── */}
      <section className="bg-slate-950">
        <div className="mx-auto max-w-6xl px-4 py-16 lg:px-8">
          <div className="text-center">
            <span className="inline-block rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-400 mb-3">Features</span>
            <h2 className="font-display text-3xl font-semibold text-white">Everything a modern practice needs</h2>
            <p className="mt-3 text-slate-400">Purpose-built for CA firms — not a generic tool adapted to fit.</p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-white/10 bg-white/5 p-6 transition-all hover:-translate-y-1 hover:bg-white/10"
              >
                <span className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${f.color}`}>
                  <f.icon className="h-6 w-6" />
                </span>
                <h3 className="font-display text-lg font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────────── */}
      <section className="bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-16 lg:px-8">
          <div className="text-center">
            <span className="inline-block rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-400 mb-3">Pricing</span>
            <h2 className="font-display text-3xl font-semibold text-white">Simple, honest pricing</h2>
            <p className="mt-3 text-slate-400">Every plan starts with a 7-day free trial. No credit card required.</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {(plans ?? []).map((plan, i) => (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border p-6 transition-all hover:-translate-y-1 ${
                  i === 1
                    ? "border-amber-400 bg-amber-400/5 shadow-lg shadow-amber-900/20"
                    : "border-white/10 bg-white/5"
                }`}
              >
                {i === 1 && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-amber-400 px-4 py-1 text-xs font-bold text-slate-900 shadow">
                      MOST POPULAR
                    </span>
                  </div>
                )}
                <div className={`mb-4 rounded-xl px-3 py-2 ${i === 0 ? "bg-blue-500/10" : i === 1 ? "bg-amber-400/10" : "bg-emerald-500/10"}`}>
                  <p className={`font-display text-lg font-semibold ${i === 0 ? "text-blue-300" : i === 1 ? "text-amber-300" : "text-emerald-300"}`}>{plan.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{plan.description}</p>
                </div>
                <div className="mb-5">
                  <p className="font-display text-4xl font-semibold text-white">
                    {formatINR(plan.price_monthly)}
                    <span className="text-base font-normal text-slate-400"> /month</span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    or {formatINR(plan.price_yearly)}/year · save ~17%
                  </p>
                </div>
                <ul className="flex-1 space-y-2.5 text-sm">
                  <li className="flex items-center gap-2 text-slate-300">
                    <Check className="h-4 w-4 shrink-0 text-emerald-400" /> Up to {plan.max_clients} clients
                  </li>
                  <li className="flex items-center gap-2 text-slate-300">
                    <Check className="h-4 w-4 shrink-0 text-emerald-400" /> {plan.max_staff} team members
                  </li>
                  <li className="flex items-center gap-2 text-slate-300">
                    <Check className="h-4 w-4 shrink-0 text-emerald-400" /> {plan.storage_gb} GB secure storage
                  </li>
                  <li className="flex items-center gap-2 text-slate-300">
                    <Check className="h-4 w-4 shrink-0 text-emerald-400" />{" "}
                    {plan.max_templates >= 999 ? "Unlimited" : plan.max_templates} templates
                  </li>
                  {Object.entries(plan.features ?? {}).map(([k, v]) =>
                    v ? (
                      <li key={k} className="flex items-center gap-2 capitalize text-slate-300">
                        <Check className="h-4 w-4 shrink-0 text-emerald-400" />{" "}
                        {k.replaceAll("_", " ")}
                      </li>
                    ) : null,
                  )}
                </ul>
                <Button
                  className={`mt-6 w-full font-semibold ${
                    i === 1
                      ? "bg-amber-400 text-slate-900 hover:bg-amber-300"
                      : "border-white/20 bg-white/10 text-white hover:bg-white/20"
                  }`}
                  variant="outline"
                  onClick={openSignup}
                >
                  Start free trial
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ───────────────────────────────────────────── */}
      <section
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f2030 100%)",
        }}
      >
        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute -top-20 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-amber-400/10 blur-3xl" />
          <div className="mx-auto max-w-4xl px-4 py-20 text-center lg:px-8">
            <h2 className="font-display text-3xl font-semibold text-white md:text-4xl">
              Ready to run a{" "}
              <span className="text-amber-400">paperless</span> practice?
            </h2>
            <p className="mt-4 text-lg text-blue-100/70">
              Join hundreds of CA firms already collecting documents the smart way.
            </p>
            <Button
              size="lg"
              className="mt-8 gap-2 bg-amber-400 text-slate-900 hover:bg-amber-300 font-semibold"
              onClick={openSignup}
            >
              Get started free <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-slate-900 py-8 text-center text-sm text-white/40">
        © {new Date().getFullYear()} CADesk. Secure document collection for CA firms.
      </footer>
    </div>
  );
}
