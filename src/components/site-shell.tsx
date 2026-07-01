import Link from "next/link";
import { Compass, LayoutDashboard, MapPinned, Microscope } from "lucide-react";
import type { ReactNode } from "react";

type SiteShellProps = {
  title: string;
  eyebrow: string;
  description: string;
  children: ReactNode;
  actions?: ReactNode;
};

const links = [
  { href: "/", label: "个人主页", icon: Compass },
  { href: "/workspace", label: "工作台", icon: LayoutDashboard },
  { href: "/runs", label: "测试追踪页", icon: Microscope },
];

export function SiteShell(props: SiteShellProps) {
  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col px-6 py-6 lg:px-10">
        <header className="mb-8 rounded-[32px] border border-[color:var(--line)] bg-[var(--surface)]/90 px-6 py-5 shadow-[0_20px_50px_rgba(23,63,122,0.08)] backdrop-blur">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--blue)]/70">
                旅行策展人 Demo
              </p>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-[var(--blue)] p-2 text-white">
                  <MapPinned className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-3xl font-black tracking-tight text-[var(--blue)]">
                    {props.title}
                  </h1>
                  <p className="max-w-2xl text-sm text-[var(--ink)]/72">
                    {props.description}
                  </p>
                </div>
              </div>
            </div>

            <nav className="flex flex-wrap items-center gap-3">
              {links.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--blue)] transition hover:-translate-y-0.5 hover:border-[var(--cyan)] hover:shadow-md"
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>

        <section className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--orange)]">
              {props.eyebrow}
            </p>
            <div className="h-1.5 w-32 rounded-full bg-[linear-gradient(90deg,var(--orange),var(--cyan))]" />
          </div>
          {props.actions ? <div className="flex flex-wrap gap-3">{props.actions}</div> : null}
        </section>

        <main className="flex-1">{props.children}</main>
      </div>
    </div>
  );
}
