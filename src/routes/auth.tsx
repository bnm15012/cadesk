import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapNewUser } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Landmark } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — PracticeVault" },
      { name: "description", content: "Sign in to your CA firm workspace or register a new firm." },
    ],
  }),
  component: AuthPage,
});

const loginSchema = z.object({
  email: z.string().trim().email({ message: "Enter a valid email" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().trim().min(2, { message: "Enter your name" }).max(100),
  firmName: z.string().trim().min(2, { message: "Enter your firm name" }).max(120),
});

async function redirectAfterLogin(navigate: ReturnType<typeof useNavigate>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  // Role check via server function (MySQL) instead of direct Supabase DB query
  const { getUserRoles } = await import("@/lib/auth.functions");
  const roles = await getUserRoles({ data: { userId: user.id } });
  if (roles.includes("client")) {
    navigate({ to: "/portal" });
  } else {
    navigate({ to: "/dashboard" });
  }
}

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = loginSchema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "Incorrect email or password" : error.message);
      return;
    }
    await redirectAfterLogin(navigate);
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = signupSchema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
      fullName: form.get("fullName"),
      firmName: form.get("firmName"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        data: {
          full_name: parsed.data.fullName,
          firm_name: parsed.data.firmName,
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(
        error.message.includes("already registered")
          ? "This email is already registered. Try signing in instead."
          : error.message,
      );
      return;
    }
    if (data.session && data.user) {
      // Bootstrap tenant, profile, role, and trial subscription in MySQL
      try {
        await bootstrapNewUser({
          data: {
            userId: data.user.id,
            email: data.user.email ?? parsed.data.email,
            fullName: parsed.data.fullName,
            firmName: parsed.data.firmName,
          },
        });
      } catch (bootstrapErr) {
        console.error("Failed to bootstrap new user in MySQL:", bootstrapErr);
        toast.error("Account created but workspace setup failed. Please contact support.");
        return;
      }
      toast.success("Welcome! Your firm workspace is ready.");
      navigate({ to: "/dashboard" });
    } else {
      toast.success("Check your email to confirm your account, then sign in.");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <Link to="/" className="mb-8 flex items-center gap-2 text-foreground">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Landmark className="h-5 w-5" />
        </span>
        <span className="font-display text-2xl font-semibold">PracticeVault</span>
      </Link>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-display text-xl">Welcome</CardTitle>
          <CardDescription>
            Sign in to your workspace, or register your CA firm to get started with a 14-day free
            trial.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="mb-4 grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Register firm</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input id="login-email" name="email" type="email" autoComplete="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Your full name</Label>
                  <Input id="signup-name" name="fullName" autoComplete="name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-firm">Firm name</Label>
                  <Input id="signup-firm" name="firmName" placeholder="e.g. Sharma & Associates" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input id="signup-email" name="email" type="email" autoComplete="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating workspace…" : "Create firm workspace"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <p className="mt-6 text-sm text-muted-foreground">
        Team members and clients: use the login your firm shared with you.
      </p>
    </div>
  );
}
