import * as React from "react"

import { cn } from "../utils/cn"

function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        "resize-none",
        // Custom scrollbar — hidden until hover/focus, visible only when overflowing
        "[scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]",
        "[&::-webkit-scrollbar]:w-1.5",
        "[&::-webkit-scrollbar-track]:bg-transparent",
        "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-transparent",
        "[&:hover::-webkit-scrollbar-thumb]:bg-border [&:focus::-webkit-scrollbar-thumb]:bg-border",
        "[&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
