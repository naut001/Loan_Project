import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const variants = cva('inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-600 disabled:pointer-events-none disabled:opacity-50', {
  variants: { variant: { default: 'bg-teal-700 text-white hover:bg-teal-800', outline: 'border border-current/20 hover:bg-teal-500/10', ghost: 'hover:bg-teal-500/10' } },
  defaultVariants: { variant: 'default' },
});
export function Button({ className, variant, asChild = false, ...props }: React.ComponentProps<'button'> & VariantProps<typeof variants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : 'button';
  return <Component className={twMerge(clsx(variants({ variant }), className))} {...props} />;
}