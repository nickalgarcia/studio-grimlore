import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Buttons are display type: Big Shoulders, uppercase, hard 1.5px edges.
 * `default` is the spot-filled primary CTA, so keep it to one per region.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap border-[1.5px] font-headline font-extrabold uppercase tracking-[0.1em] text-[16px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-spot text-spot-on border-spot hover:bg-ink hover:text-bg hover:border-ink",
        destructive: "bg-spot text-spot-on border-spot hover:bg-ink hover:text-bg hover:border-ink",
        outline: "border-ink bg-transparent text-ink hover:bg-panel",
        secondary: "border-line2 bg-panel text-ink hover:border-ink",
        ghost: "border-transparent text-ink hover:bg-panel",
        link: "border-transparent text-spot underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-9 px-3 text-[14px]",
        lg: "h-12 px-6 text-[19px]",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
