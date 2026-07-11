import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

const schema = z.object({
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: "Passwords do not match", path: ["confirm"] });

interface ChangePasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePasswordModal({ open, onOpenChange }: ChangePasswordModalProps) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const parsed = schema.safeParse({
      password: (form.elements.namedItem("password") as HTMLInputElement).value,
      confirm: (form.elements.namedItem("confirm") as HTMLInputElement).value,
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated successfully.");
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Change password</DialogTitle>
          <DialogDescription>
            Enter and confirm your new password below.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cp-password">New password</Label>
            <Input id="cp-password" name="password" type="password" autoComplete="new-password" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp-confirm">Confirm new password</Label>
            <Input id="cp-confirm" name="confirm" type="password" autoComplete="new-password" required />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : "Update password"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
