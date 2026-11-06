"use client";

import Link from "next/link";

interface EmptyStateProps {
  emoji: string;
  title: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
  onCtaClick?: () => void;
}

export default function EmptyState({ emoji, title, description, ctaLabel, ctaHref, onCtaClick }: EmptyStateProps) {
  return (
    <div className="empty-state" role="status">
      <div className="emoji" aria-hidden="true">{emoji}</div>
      <h3 style={{ margin: "0 0 8px", color: "var(--text)" }}>{title}</h3>
      {description ? <p style={{ margin: "0 auto 20px", maxWidth: 420, fontSize: 14 }}>{description}</p> : null}
      {ctaLabel && ctaHref ? (
        <Link href={ctaHref} className="btn btn-primary">{ctaLabel}</Link>
      ) : ctaLabel && onCtaClick ? (
        <button type="button" className="btn btn-primary" onClick={onCtaClick}>{ctaLabel}</button>
      ) : null}
    </div>
  );
}
