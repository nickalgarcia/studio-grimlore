"use client"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

/**
 * Confirmations show for 2.6s, per the spec. Errors and anything with a
 * description or an action stay longer: they have to be read, or acted on.
 */
const CONFIRM_MS = 2600
const READ_MS = 7000

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider duration={CONFIRM_MS}>
      {toasts.map(function ({ id, title, description, action, duration, ...props }) {
        const needsReading = props.variant === "destructive" || !!description || !!action
        return (
          <Toast key={id} duration={duration ?? (needsReading ? READ_MS : CONFIRM_MS)} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
