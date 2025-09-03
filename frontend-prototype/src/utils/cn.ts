import { clsx, type ClassValue } from 'clsx';

/**
 * Utility function for merging class names
 * Combines clsx for conditional classes with basic string concatenation
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/**
 * Alternative utility for merging Tailwind classes with conflict resolution
 * This is a simple implementation - for more advanced use cases, consider using tailwind-merge
 */
export function mergeTailwindClasses(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Utility for conditional class application
 */
export function conditionalClass(condition: boolean, trueClass: string, falseClass?: string): string {
  return condition ? trueClass : (falseClass || '');
}

/**
 * Utility for variant-based class selection
 */
export function variantClass<T extends string>(
  variant: T,
  variants: Record<T, string>,
  defaultVariant?: T
): string {
  return variants[variant] || (defaultVariant ? variants[defaultVariant] : '');
}
