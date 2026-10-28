"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "@/components/ui/AuthShell";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      setIsSubmitting(false);
      setError(signUpError.message);
      return;
    }

    if (!data.session) {
      // This project has email confirmation disabled for local
      // development (see docs/database.md §4a), so signing up normally
      // returns an active session immediately. If that setting ever
      // changes, this is the fallback that still makes sense: there's a
      // real account now, it just needs a confirmation step before it can
      // sign in.
      setIsSubmitting(false);
      setInfo("Account created — check your email to confirm it, then log in.");
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <AuthShell
      title="Create your NoteMap account"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="zt-link">
            Log in
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
          Password (8+ characters)
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="zt-field h-7 text-(--zt-text)"
          />
        </label>
        {error && <p role="alert" className="text-(--zt-danger)">{error}</p>}
        {info && <p className="text-(--zt-dim)">{info}</p>}
        <button type="submit" disabled={isSubmitting} className="zt-btn zt-btn-primary mt-1 h-7">
          {isSubmitting ? "Creating account…" : "Sign up"}
        </button>
      </form>
    </AuthShell>
  );
}
