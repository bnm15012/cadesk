import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapNewUser, getUserRoles } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FolderCheck, Loader2, ArrowLeft } from "lucide-react";

// ── Schemas ──────────────────────────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().trim().email({ message: "Enter a valid email" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().trim().min(2, { message: "Enter your name" }).max(100),
  firmName: z.string().trim().min(2, { message: "Enter your firm name" }).max(120),
});

const emailSchema = z.object({
  email: z.string().trim().email({ message: "Enter a valid email" }),
});

const otpSchema = z.object({
  otp: z.string().trim().length(6, { message: "OTP must be 6 digits" }),
});

const newPasswordSchema = z.object({
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: "Passwords do not match", path: ["confirm"] });

// ── Types ─────────────────────────────────────────────────────────────────────
type ForgotStep = "email" | "otp" | "newPassword";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "login" | "signup";
}

// ── Forgot password sub-flow ──────────────────────────────────────────────────
function ForgotPassword({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<ForgotStep>("email");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse({ email: (e.currentTarget.elements.namedItem("email") as HTMLInputElement).value });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setEmail(parsed.data.email);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: { shouldCreateUser: false },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message.includes("not found") ? "No account found with this email." : error.message);
      return;
    }
    toast.success("OTP sent! Check your email.");
    setStep("otp");
  };

  const handleVerifyOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsed = otpSchema.safeParse({ otp: (e.currentTarget.elements.namedItem("otp") as HTMLInputElement).value });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: parsed.data.otp,
      type: "email",
    });
    setLoading(false);
    if (error) {
      toast.error("Invalid or expired OTP. Please try again.");
      return;
    }
    setStep("newPassword");
  };

  const handleSetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const parsed = newPasswordSchema.safeParse({
      password: (form.elements.namedItem("password") as HTMLInputElement).value,
      confirm: (form.elements.namedItem("confirm") as HTMLInputElement).value,
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    // Sign out so user logs in fresh with new password
    await supabase.auth.signOut();
    toast.success("Password updated! Please sign in with your new password.");
    onBack();
  };

  const handleResend = async () => {
    setLoading(true);
    await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    setLoading(false);
    toast.success("New OTP sent.");
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
      </button>

      {step === "email" && (
        <>
          <div>
            <p className="font-semibold text-foreground">Forgot your password?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your registered email and we'll send you a 6-digit OTP.
            </p>
          </div>
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Email</Label>
              <Input id="forgot-email" name="email" type="email" autoComplete="email" required />
            </div>
            <Button type="submit" className="w-full bg-amber-400 text-slate-900 hover:bg-amber-300 font-semibold" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending OTP…</> : "Send OTP"}
            </Button>
          </form>
        </>
      )}

      {step === "otp" && (
        <>
          <div>
            <p className="font-semibold text-foreground">Enter the OTP</p>
            <p className="mt-1 text-sm text-muted-foreground">
              We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>.
            </p>
          </div>
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp">6-digit OTP</Label>
              <Input
                id="otp"
                name="otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                className="tracking-[0.4em] text-center text-lg font-mono"
                required
              />
            </div>
            <Button type="submit" className="w-full bg-amber-400 text-slate-900 hover:bg-amber-300 font-semibold" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…</> : "Verify OTP"}
            </Button>
          </form>
          <button
            type="button"
            onClick={handleResend}
            disabled={loading}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            Didn't receive it? Resend OTP
          </button>
        </>
      )}

      {step === "newPassword" && (
        <>
          <div>
            <p className="font-semibold text-foreground">Set a new password</p>
            <p className="mt-1 text-sm text-muted-foreground">Choose a strong password for your account.</p>
          </div>
          <form onSubmit={handleSetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input id="new-password" name="password" type="password" autoComplete="new-password" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input id="confirm-password" name="confirm" type="password" autoComplete="new-password" required />
            </div>
            <Button type="submit" className="w-full bg-amber-400 text-slate-900 hover:bg-amber-300 font-semibold" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : "Save new password"}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export function AuthModal({ open, onOpenChange, defaultTab = "login" }: AuthModalProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  // Reset forgot state whenever modal closes
  const handleOpenChange = (val: boolean) => {
    if (!val) setShowForgot(false);
    onOpenChange(val);
  };

  async function redirectAfterLogin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const roles = await getUserRoles({ data: { userId: user.id } });
    handleOpenChange(false);
    navigate({ to: roles.includes("client") ? "/portal" : "/dashboard" });
  }

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "Incorrect email or password" : error.message);
      return;
    }
    await redirectAfterLogin();
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
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        data: { full_name: parsed.data.fullName, firm_name: parsed.data.firmName },
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
      try {
        await bootstrapNewUser({
          data: {
            userId: data.user.id,
            email: data.user.email ?? parsed.data.email,
            fullName: parsed.data.fullName,
            firmName: parsed.data.firmName,
          },
        });
      } catch (err) {
        console.error("Failed to bootstrap new user in MySQL:", err);
        toast.error("Account created but workspace setup failed. Please contact support.");
        return;
      }
      toast.success("Welcome! Your firm workspace is ready.");
      handleOpenChange(false);
      navigate({ to: "/dashboard" });
    } else {
      toast.success("Check your email to confirm your account, then sign in.");
      handleOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400">
              <FolderCheck className="h-4 w-4 text-slate-900" />
            </span>
            <span className="font-display text-lg font-semibold">CADesk</span>
          </div>
          {!showForgot && (
            <>
              <DialogTitle className="font-display text-xl">Welcome</DialogTitle>
              <DialogDescription>
                Sign in to your workspace, or register your CA firm for a 7-day free trial.
              </DialogDescription>
            </>
          )}
          {showForgot && (
            <DialogTitle className="font-display text-xl sr-only">Reset password</DialogTitle>
          )}
        </DialogHeader>

        {showForgot ? (
          <ForgotPassword onBack={() => setShowForgot(false)} />
        ) : (
          <>
            <Tabs defaultValue={defaultTab}>
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
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-password">Password</Label>
                      <button
                        type="button"
                        onClick={() => setShowForgot(true)}
                        className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <Input id="login-password" name="password" type="password" autoComplete="current-password" required />
                  </div>
                  <Button type="submit" className="w-full bg-amber-400 text-slate-900 hover:bg-amber-300 font-semibold" disabled={loading}>
                    {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…</> : "Sign in"}
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
                    <Input id="signup-password" name="password" type="password" autoComplete="new-password" required />
                  </div>
                  <Button type="submit" className="w-full bg-amber-400 text-slate-900 hover:bg-amber-300 font-semibold" disabled={loading}>
                    {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating workspace…</> : "Create firm workspace"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <p className="text-center text-xs text-muted-foreground">
              Team members and clients: use the login your firm shared with you.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
