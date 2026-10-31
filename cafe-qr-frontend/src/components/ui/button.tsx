import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

// Composant de type shadcn/ui, sans dépendance Radix. Couleurs via variables CSS uniquement.
const buttonVariants = cva(
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-card px-4 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-fg hover:opacity-90",
        secondary: "border border-line bg-surface text-ink hover:bg-surface-2",
        ghost: "text-ink hover:bg-surface-2",
        danger: "bg-danger text-danger-fg hover:opacity-90",
        link: "min-h-0 px-0 text-ink underline underline-offset-4",
      },
      size: {
        md: "",
        lg: "min-h-[52px] px-6 text-base",
        sm: "min-h-[44px] px-3 text-sm",
        icon: "h-11 w-11 px-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, type = "button", ...props },
  ref,
) {
  return <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
