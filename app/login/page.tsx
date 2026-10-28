"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "@/components/ui/AuthShell";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setIsSubmitting(false);
      setError(signInError.message);
      return;
    }

    // `refresh()` re-runs Server Components with the now-signed-in
    // session; `push` alone would leave anything server-rendered on the
    // next page looking at the stale, signed-out state for a moment.
    router.push("/");
    router.refresh();
  };

  return (
    <AuthShell
      title="Log in to NoteMap"
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="zt-link">
            Sign up
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-[12px] text-(--zt-dim)">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="zt-field h-7 text-(--zt-text)"
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-(--zt-dim)">
          Password
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="zt-field h-7 text-(--zt-text)"
          />
        </label>
        {error && <p role="alert" className="text-(--zt-danger)">{error}</p>}
        <button type="submit" disabled={isSubmitting} className="zt-btn zt-btn-primary mt-1 h-7">
          {isSubmitting ? "Logging in…" : "Log in"}
        </button>
      </form>
    </AuthShell>
  );
}
