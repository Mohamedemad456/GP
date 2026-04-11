"use client";

import * as React from "react";
import { CheckIcon, ChevronsUpDownIcon, SearchIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { cn } from "../utils/cn";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ComboboxOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface ComboboxProps {
  /** Currently selected value */
  value?: string;
  /** Called when the user picks an option */
  onValueChange?: (value: string) => void;
  /** List of options to display */
  options: ComboboxOption[];
  /** Trigger placeholder when nothing is selected */
  placeholder?: string;
  /** Placeholder inside the search input */
  searchPlaceholder?: string;
  /** Text shown when no options match the search query */
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  "aria-invalid"?: boolean | "true" | "false";
}

// ─── Component ────────────────────────────────────────────────────────────────

function Combobox({
  value,
  onValueChange,
  options,
  placeholder = "Select an option",
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  disabled,
  className,
  "aria-invalid": ariaInvalid,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const filtered = React.useMemo(
    () =>
      options.filter((opt) =>
        opt.label.toLowerCase().includes(search.toLowerCase())
      ),
    [options, search]
  );

  const selectedLabel = React.useMemo(
    () => options.find((opt) => opt.value === value)?.label,
    [options, value]
  );

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setSearch("");
  };

  const handleSelect = (optValue: string) => {
    onValueChange?.(optValue);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-invalid={ariaInvalid}
          disabled={disabled}
          className={cn(
            // Mirror SelectTrigger styles exactly
            "border-input bg-background flex h-9 w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm shadow-xs whitespace-nowrap",
            "focus:outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
            !selectedLabel && "text-muted-foreground",
            className
          )}
        >
          <span className="line-clamp-1 flex-1 text-start">
            {selectedLabel ?? placeholder}
          </span>
          <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 border-b border-border px-3">
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            role="searchbox"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex h-9 w-full bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        {/* Options list */}
        <div role="listbox" className="max-h-60 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {emptyText}
            </p>
          ) : (
            filtered.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={opt.value === value}
                disabled={opt.disabled}
                onClick={() => handleSelect(opt.value)}
                className={cn(
                  "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none",
                  "hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground",
                  "disabled:pointer-events-none disabled:opacity-50",
                  opt.value === value && "bg-accent/40 font-medium"
                )}
              >
                <span className="absolute left-2 flex size-3.5 items-center justify-center">
                  {opt.value === value && <CheckIcon className="size-4" />}
                </span>
                {opt.label}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { Combobox };
