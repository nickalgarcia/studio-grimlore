import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { FieldValue } from "firebase/firestore";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getSafeDate(date: string | FieldValue | undefined | null): Date | null {
    if (!date) return null;
    if (typeof (date as any)?.toDate === 'function') {
        return (date as any).toDate();
    }
    if (typeof date === 'string') {
        const parsedDate = new Date(date);
        // Check if the date is valid
        if (!isNaN(parsedDate.getTime())) {
            return parsedDate;
        }
    }
    // If it's a server timestamp that hasn't resolved, or an invalid string, we can't form a date.
    return null;
}
