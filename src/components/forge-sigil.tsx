import { cn } from '@/lib/utils';

/**
 * The app's mark. Same polygon and circle as before — the path is deliberately
 * unchanged — restroked from the old teal into oxblood.
 */
export function ForgeSigil({ className }: { className?: string }) {
  return (
    <svg
      className={cn('shrink-0', className)}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <polygon
        points="16,2 20,12 30,12 22,19 25,30 16,23 7,30 10,19 2,12 12,12"
        fill="none"
        stroke="hsl(var(--oxblood-bright))"
        strokeWidth="1.2"
        opacity="0.9"
      />
      <circle
        cx="16"
        cy="16"
        r="3.2"
        fill="hsl(var(--oxblood) / 0.25)"
        stroke="hsl(var(--oxblood-bright))"
        strokeWidth="0.8"
      />
    </svg>
  );
}
