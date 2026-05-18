import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
  /** If true, auto-fill with the current user's email when value is empty. Default: true. */
  autofillFromUser?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isReplyToValid(value: string): boolean {
  if (!value) return true; // empty = use default (no reply-to)
  return EMAIL_RE.test(value.trim());
}

export default function ReplyToField({
  value,
  onChange,
  disabled,
  label = "Responder para",
  className,
  autofillFromUser = true,
}: Props) {
  const [autoFilled, setAutoFilled] = useState(false);

  useEffect(() => {
    if (!autofillFromUser || autoFilled || value) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const email = data?.user?.email;
      if (email) {
        onChange(email);
        setAutoFilled(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autofillFromUser]);

  const invalid = value.length > 0 && !EMAIL_RE.test(value.trim());

  return (
    <div className={`space-y-1 ${className || ""}`}>
      <Label htmlFor="reply-to" className="text-xs">{label}</Label>
      <Input
        id="reply-to"
        type="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="seu@email.com"
        aria-invalid={invalid}
      />
      <p className="text-[11px] text-muted-foreground">
        Quando o destinatário responder, a resposta vai para este endereço.
      </p>
      {invalid && (
        <p className="text-[11px] text-destructive">E-mail inválido.</p>
      )}
    </div>
  );
}
