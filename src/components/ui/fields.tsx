"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn("textarea", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  ({ className, ...props }, ref) => (
    <select ref={ref} className={cn("select", className)} {...props} />
  ),
);
Select.displayName = "Select";

export function Checkbox({
  label,
  className,
  ...props
}: React.ComponentProps<"input"> & { label?: React.ReactNode }) {
  return (
    <label className={cn("control-row", className)}>
      <input type="checkbox" {...props} />
      {label}
    </label>
  );
}

export function Switch({
  label,
  checked,
  onCheckedChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="switch"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
    >
      <span className="switch__track" aria-hidden="true">
        <span className="switch__thumb" />
      </span>
      <span>{label}</span>
    </button>
  );
}

export interface RadioOption {
  value: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
}

export function RadioGroup({
  name,
  value,
  options,
  onValueChange,
}: {
  name: string;
  value: string;
  options: RadioOption[];
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="radio-list" role="radiogroup">
      {options.map((option) => (
        <label className="radio-option" key={option.value}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            disabled={option.disabled}
            onChange={() => onValueChange(option.value)}
          />
          <span>
            <span>{option.label}</span>
            {option.description ? <span className="field__hint">{option.description}</span> : null}
          </span>
        </label>
      ))}
    </div>
  );
}

export function FormField({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {children}
      {hint ? <span className="field__hint">{hint}</span> : null}
      {error ? <span className="field__error" role="alert">{error}</span> : null}
    </div>
  );
}
