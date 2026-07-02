"use client";

import { useEffect } from "react";
import { AlertCircle, X } from "lucide-react";
import type { AiNotice } from "@/src/lib/ai-notice";

type EphemeralToastProps = {
  notice: AiNotice | null;
  onClose: () => void;
};

export function EphemeralToast(props: EphemeralToastProps) {
  const { notice, onClose } = props;

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => {
      onClose();
    }, 4800);

    return () => {
      window.clearTimeout(timer);
    };
  }, [notice, onClose]);

  if (!notice) {
    return null;
  }

  return (
    <div className="fixed right-6 top-6 z-50 w-[min(360px,calc(100vw-2rem))] rounded-[24px] border border-[color:var(--line-subtle)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-[var(--accent-tint)] p-2 text-[var(--accent-primary-strong)]">
          <AlertCircle className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--text-strong)]">{notice.title}</p>
          <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{notice.message}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 text-[var(--text-muted)] transition hover:bg-[var(--bg-soft)] hover:text-[var(--text-strong)]"
          aria-label="关闭提示"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
