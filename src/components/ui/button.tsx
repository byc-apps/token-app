import * as React from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "admin" | "student" | "small";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "admin", fullWidth = false, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        "button",
        `button--${variant}`,
        size === "student" ? "button--student" : size === "small" ? "button--small" : "",
        fullWidth ? "button--full" : "",
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
