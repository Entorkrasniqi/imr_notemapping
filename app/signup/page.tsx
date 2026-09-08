"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

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
    <div className="blueprint-grid flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950 blueprint:bg-background">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-lg font-semibold text-zinc-900 dark:text-white blueprint:font-mono blueprint:text-white">
          Create your NoteMap account
        </h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-white/15 dark:bg-white/5 dark:text-white dark:focus:border-white/40 blueprint:border-white/30 blueprint:bg-white/10 blueprint:text-white blueprint:placeholder:text-white/50 blueprint:focus:border-white"
          />
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="Password (6+ characters)"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-white/15 dark:bg-white/5 dark:text-white dark:focus:border-white/40 blueprint:border-white/30 blueprint:bg-white/10 blueprint:text-white blueprint:placeholder:text-white/50 blueprint:focus:border-white"
          />
          {error && <p className="text-sm text-red-600 dark:text-red-400 blueprint:text-red-200">{error}</p>}
          {info && <p className="text-sm text-zinc-600 dark:text-white/60 blueprint:text-white/80">{info}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-1 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 blueprint:border blueprint:border-white/40 blueprint:bg-transparent blueprint:hover:bg-white/10"
          >
            {isSubmitting ? "Creating account…" : "Sign up"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-zinc-500 dark:text-white/50 blueprint:text-white/70">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-zinc-900 underline dark:text-white blueprint:text-white">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
