/**
 * /auth is kept as a route so Supabase email-confirmation links still work
 * (they redirect back to /auth after the user clicks the confirmation email).
 *
 * If the user already has a valid session (email confirmed), send them to
 * their dashboard. Otherwise redirect to the homepage with ?auth=1 so the
 * AuthModal opens automatically.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getUserRoles } from "@/lib/auth.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — CADesk" },
      { name: "description", content: "Sign in to your CA firm workspace or register a new firm." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        // Already logged in — redirect to the right dashboard
        const roles = await getUserRoles({ data: { userId: session.user.id } });
        navigate({ to: roles.includes("client") ? "/portal" : "/dashboard" });
      } else {
        // Not logged in — go to homepage and auto-open the modal
        navigate({ to: "/", search: { auth: "1" } });
      }
    });
  }, [navigate]);

  return null;
}
