/**
 * /auth handles post-login redirects and deep-links (e.g. email confirmation).
 *
 * If the user already has a valid session, send them to their dashboard.
 * Otherwise redirect to the homepage with ?auth=1 so the AuthModal opens.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getSession } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — CA Vault" },
      { name: "description", content: "Sign in to your CA firm workspace or register a new firm." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const fetchSession = useServerFn(getSession);

  useEffect(() => {
    fetchSession().then((session) => {
      if (session) {
        // Already logged in — redirect to the right dashboard
        navigate({ to: session.roles.includes("client") ? "/portal" : "/dashboard" });
      } else {
        // Not logged in — go to homepage and auto-open the modal
        navigate({ to: "/", search: { auth: "1" } });
      }
    });
  }, [navigate, fetchSession]);

  return null;
}
