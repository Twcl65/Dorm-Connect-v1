"use client";

import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui/utils";

type PasswordInputWithToggleProps = Omit<
  ComponentProps<typeof Input>,
  "type"
>;

export function PasswordInputWithToggle({
  className,
  disabled,
  ...props
}: PasswordInputWithToggleProps) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative w-full">
      <Input
        {...props}
        type={show ? "text" : "password"}
        disabled={disabled}
        className={cn("h-8 text-xs pr-9", className)}
      />
      <button
        type="button"
        className={cn(
          "absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground",
          disabled && "pointer-events-none opacity-50"
        )}
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        {show ? (
          <EyeOff className="h-3.5 w-3.5" />
        ) : (
          <Eye className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

const VIEW_HIDDEN = "••••••••";
const VIEW_SHOWN =
  "Not shown (stored as a secure hash). Use Edit to set a new password.";

/** Read-only “password” row for user details; eye toggles hint vs masked placeholder. */
export function ViewPasswordPlaceholder() {
  const [show, setShow] = useState(false);
  return (
    <div className="relative w-full">
      <Input
        readOnly
        type={show ? "text" : "password"}
        value={show ? VIEW_SHOWN : VIEW_HIDDEN}
        className="h-8 text-xs pr-9"
      />
      <button
        type="button"
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Hide password info" : "Show password info"}
        tabIndex={-1}
      >
        {show ? (
          <EyeOff className="h-3.5 w-3.5" />
        ) : (
          <Eye className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}
