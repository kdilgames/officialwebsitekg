import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "md" | "sm";
};

export function Button({ variant = "secondary", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cn("btn", `btn-${variant}`, size === "sm" && "btn-sm", className)}
    />
  );
}

export function buttonClass(
  variant: ButtonVariant = "secondary",
  size: "md" | "sm" = "md",
  className?: string,
): string {
  return cn("btn", `btn-${variant}`, size === "sm" && "btn-sm", className);
}
