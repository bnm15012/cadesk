import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Landmark,
  FolderCheck,
  Users,
  ShieldCheck,
  CalendarRange,
  FileStack,
  History,
  Check,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PracticeVault — Client Document Collection for CA Firms" },
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
  },
  {
    icon: FileStack,
    title: "Your templates, not ours",
    text: "Build reusable checklists for ITR, GST, Tax Audit or anything else. Rename, reorder, categorize freely.",
  },
  {
    icon: CalendarRange,
    title: "Organized by financial year",
    text: "Every client keeps clean, separate records for FY 2023-24, 2024-25 and beyond. Nothing ever mixes.",
  },
  {
    icon: Users,
    title: "Client portal included",
    text: "Clients log in, see exactly what's pending, upload from any device, and track approval status.",
  },
  {
    icon: ShieldCheck,
    title: "Roles & permissions",
    text: "Create custom roles for managers and staff. Team members only see the clients assigned to them.",
  },
  {
    icon: History,
    title: "Complete audit trail",
    text: "Every upload, approval, download and change is logged with who, what and when.",
  },
];

function formatINR(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

function Landing() {
  const { data: plans } = useQuery({
    queryKey: ["public-plans"],
    queryFn: async () => {
      const { data } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 lg:px-8">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Landmark className="h-5 w-5" />
            </span>
            <span className="font-display text-xl font-semibold">PracticeVault</span>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild>
              <Link to="/auth">Start free trial</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 py-20 text-center lg:py-28">
        <Badge variant="secondary" className="mb-6">
          Built for Chartered Accountant firms
        </Badge>
        <h1 className="font-display text-4xl font-semibold leading-tight md:text-6xl">
          Stop chasing clients for documents.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          PracticeVault gives your firm a secure portal where clients upload exactly what you need
          — organized by financial year, reviewed by your team, and tracked to the last version.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Register your firm — 14 days free</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth">Client login</Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-16 lg:px-8">
          <h2 className="text-center font-display text-3xl font-semibold">
            Everything a modern practice needs
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-lg border border-border bg-background p-6">
                <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-primary">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-6xl px-4 py-16 lg:px-8">
        <h2 className="text-center font-display text-3xl font-semibold">Simple, honest pricing</h2>
        <p className="mt-3 text-center text-muted-foreground">
          Every plan starts with a 14-day free trial. No credit card required.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {(plans ?? []).map((plan, i) => (
            <Card key={plan.id} className={i === 1 ? "border-accent shadow-md" : ""}>
              <CardHeader>
                {i === 1 && <Badge className="mb-2 w-fit bg-accent text-accent-foreground">Most popular</Badge>}
                <CardTitle className="font-display">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="font-display text-3xl font-semibold">
                  {formatINR(plan.price_monthly)}
                  <span className="text-sm font-normal text-muted-foreground"> /month</span>
                </p>
                <ul className="mt-5 space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-success" /> Up to {plan.max_clients} clients
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-success" /> {plan.max_staff} team members
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-success" /> {plan.storage_gb} GB secure storage
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-success" />{" "}
                    {plan.max_templates >= 999 ? "Unlimited" : plan.max_templates} templates
                  </li>
                </ul>
                <Button asChild className="mt-6 w-full" variant={i === 1 ? "default" : "outline"}>
                  <Link to="/auth">Start free trial</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} PracticeVault. Secure document collection for CA firms.
      </footer>
    </div>
  );
}
