import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/lib/theme/theme-context";

// Only the monospace face is loaded (for code in notes); the interface uses
// the system font — see `--font-sans` in globals.css.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NoteMap",
  description: "Infinite canvas mind-mapping and rich-text notes.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Set by proxy.ts for this request — the inline theme script below has to
  // carry it, or the Content-Security-Policy blocks it (see
  // lib/security/headers.ts). Reading request headers also makes every
  // page render per request, which a per-request nonce requires anyway.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      className={`${geistMono.variable} h-full antialiased`}
      // The theme-init script below sets `data-theme` on this element
      // before React hydrates, from localStorage the server has no way
      // to see — server and client HTML for this one attribute are
      // *expected* to differ, so this tells React not to treat that
      // specific, known mismatch as a bug. It doesn't suppress hydration
      // warnings anywhere else in the tree.
      suppressHydrationWarning
    >
      <head>
        {/* Runs before paint, before React hydrates — sets `data-theme`
            from localStorage immediately so a returning dark/blueprint
            user never sees a flash of the light theme first. See
            THEME_INIT_SCRIPT's own comment in theme-context.tsx. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="h-full">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
