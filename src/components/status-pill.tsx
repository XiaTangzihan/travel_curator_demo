type StatusPillProps = {
  status: "draft" | "confirmed" | "failed" | "running" | "completed" | "incomplete";
};

const styles: Record<StatusPillProps["status"], string> = {
  draft: "bg-[rgba(23,63,122,0.12)] text-[var(--blue)]",
  confirmed: "bg-[rgba(28,166,96,0.14)] text-[#1a7a4f]",
  failed: "bg-[rgba(180,56,56,0.14)] text-[#9f1d1d]",
  running: "bg-[rgba(255,122,69,0.14)] text-[var(--orange)]",
  completed: "bg-[rgba(28,166,96,0.14)] text-[#1a7a4f]",
  incomplete: "bg-[rgba(116,215,247,0.18)] text-[var(--blue)]",
};

export function StatusPill(props: StatusPillProps) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${styles[props.status]}`}
    >
      {props.status}
    </span>
  );
}
