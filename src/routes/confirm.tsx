/**
 * /auth/confirm?token=<hex>
 * Handles email confirmation links sent on signup.
 * Validates the token, marks the user confirmed, auto-logs them in,
 * then redirects to the dashboard.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { confirmEmail } from "@/lib/auth";
import { Loader2, FolderCheck, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/confirm")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  head: () => ({
    meta: [{ title: "Confirm email — CA Vault" }],
  }),
  component: ConfirmPage,
});

function ConfirmPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const confirmFn = useServerFn(confirmEmail);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("No confirmation token found in the link.");
      return;
    }
    confirmFn({ data: { token } })
      .then(() => {
        setStatus("success");
        // Redirect to dashboard after a short delay
        setTimeout(() => navigate({ to: "/dashboard" }), 2000);
      })
      .catch((err: any) => {
        setStatus("error");
        setErrorMsg(err?.message ?? "Confirmation failed. Please try again.");
      });
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="flex justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-400">
            <FolderCheck className="h-6 w-6 text-slate-900" />
          </span>
        </div>

        {status === "loading" && (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Confirming your email…</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 className="mx-auto h-8 w-8 text-green-500" />
            <h1 className="text-xl font-semibold">Email confirmed!</h1>
            <p className="text-muted-foreground text-sm">Redirecting you to your dashboard…</p>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="mx-auto h-8 w-8 text-destructive" />
            <h1 className="text-xl font-semibold">Confirmation failed</h1>
            <p className="text-muted-foreground text-sm">{errorMsg}</p>
            <Button
              className="bg-amber-400 text-slate-900 hover:bg-amber-300 font-semibold"
              onClick={() => navigate({ to: "/" })}
            >
              Go home
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
