import { Dices } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center h-10 w-10 rounded-md bg-card border border-white/20',
        className
      )}
    >
      <Dices className="h-6 w-6 text-foreground" strokeWidth={1.5} />
    </div>
  );
}
