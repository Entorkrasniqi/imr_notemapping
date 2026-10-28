import type { ReactNode } from "react";
import Logo from "@/components/brand/Logo";

/**
 * The centered panel every standalone screen uses (log in, sign up, 404,
 * error): the product name over a thin-bordered white panel on the grey
 * window background, like a native app's sign-in dialog.
 */
export default function AuthShell({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="zt flex min-h-screen flex-col items-center justify-center bg-(--zt-window) px-4 py-8">
      <div className="w-full max-w-[340px]">
        <div className="mb-4 flex justify-center">
          <Logo size={22} />
        </div>
        <div className="rounded-md border border-(--zt-border) bg-(--zt-list) p-5">
          <h1 className="mb-4 text-[15px] font-semibold">{title}</h1>
          {children}
        </div>
        {footer && <p className="mt-3 text-center text-(--zt-dim)">{footer}</p>}
      </div>
    </div>
  );
}
