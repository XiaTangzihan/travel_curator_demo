import Link from "next/link";
import type { ReactNode } from "react";

type SiteShellProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  activeHref?: "/" | "/workspace" | "/runs";
};

const links = [
  { href: "/" as const, label: "个人主页" },
  { href: "/workspace" as const, label: "工作台" },
  { href: "/runs" as const, label: "测试追踪页" },
];

export function SiteShell(props: SiteShellProps) {
  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-strong)]">
      <div className="mx-auto max-w-[1500px] px-5 pb-10 pt-8 sm:px-8 xl:px-10">
        <header className="mb-10 flex flex-col gap-6 border-b border-[color:var(--line-subtle)] pb-6 lg:flex-row lg:items-center lg:justify-between">
          <Link href="/" className="text-[28px] font-semibold tracking-[-0.04em] text-[var(--text-strong)]">
            旅行策展人
          </Link>

          <nav className="flex flex-wrap items-center gap-2 rounded-full border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-1 shadow-[var(--shadow-soft)]">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  props.activeHref === link.href
                    ? "bg-[var(--bg-soft)] text-[var(--text-strong)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--bg-soft)]/75 hover:text-[var(--text-strong)]"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </header>

        <section className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            {props.eyebrow ? (
              <p className="mb-3 text-xs font-medium tracking-[0.18em] text-[var(--text-muted)]">
                {props.eyebrow}
              </p>
            ) : null}
            <h1 className="text-[34px] font-semibold tracking-[-0.04em] text-[var(--text-strong)] sm:text-[42px]">
              {props.title}
            </h1>
            {props.description ? (
              <p className="mt-3 max-w-[760px] text-sm leading-7 text-[var(--text-muted)] sm:text-[15px]">
                {props.description}
              </p>
            ) : null}
          </div>
          {props.actions ? (
            <div className="flex flex-wrap items-center gap-3">{props.actions}</div>
          ) : null}
        </section>

        <main>{props.children}</main>
      </div>
    </div>
  );
}
