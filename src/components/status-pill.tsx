type StatusPillProps = {
  status: "draft" | "confirmed" | "failed" | "running" | "completed" | "incomplete";
};

const styles: Record<StatusPillProps["status"], string> = {
  draft: "border-[color:var(--line-subtle)] bg-[var(--bg-soft)] text-[var(--text-muted)]",
  confirmed: "border-transparent bg-[var(--success-tint)] text-[var(--success-ink)]",
  failed: "border-transparent bg-[var(--danger-tint)] text-[var(--danger-ink)]",
  running: "border-transparent bg-[var(--accent-tint)] text-[var(--accent-primary-strong)]",
  completed: "border-transparent bg-[var(--success-tint)] text-[var(--success-ink)]",
  incomplete: "border-[color:var(--line-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)]",
};

const labels: Record<StatusPillProps["status"], string> = {
  draft: "草稿",
  confirmed: "已确认",
  failed: "失败",
  running: "进行中",
  completed: "已完成",
  incomplete: "未完成",
};

export function StatusPill(props: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium tracking-[0.08em] ${styles[props.status]}`}
    >
      {labels[props.status]}
    </span>
  );
}
