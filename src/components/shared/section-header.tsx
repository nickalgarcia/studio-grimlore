import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * The section header pattern: `glyph LABEL`, a hairline that takes the rest
 * of the row, and right-aligned meta.
 */
export function SectionHeader({
  glyph, label, meta, className, as: Tag = 'h2',
}: {
  glyph?: string;
  label: string;
  meta?: React.ReactNode;
  className?: string;
  as?: 'h2' | 'h3';
}) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Tag className="flex-none font-mono font-bold text-[12px] tracking-[0.2em] uppercase">
        {glyph && <span aria-hidden="true" className="mr-2">{glyph}</span>}
        {label}
      </Tag>
      <span aria-hidden="true" className="flex-1 h-px bg-border/30" />
      {meta && (
        <span className="flex-none font-mono text-[11px] tracking-[0.14em] uppercase text-muted-foreground">
          {meta}
        </span>
      )}
    </div>
  );
}

/** The micro label: mono 700, 11px, tracked. */
export function MonoLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('font-mono font-bold text-[11px] tracking-[0.16em] uppercase', className)}>
      {children}
    </span>
  );
}
