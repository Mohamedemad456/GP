import * as React from "react"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MoreHorizontalIcon,
} from "lucide-react"

import { cn } from "../utils/cn"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select"

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      data-slot="pagination"
      className={cn("mx-auto flex w-full justify-center font-sans", className)}
      {...props}
    />
  )
}

function PaginationContent({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn("flex flex-row flex-wrap items-center gap-1", className)}
      {...props}
    />
  )
}

function PaginationItem({ ...props }: React.ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />
}

type PaginationLinkProps = {
  isActive?: boolean
  size?: "icon" | "default" | "sm" | "lg"
} & React.ComponentProps<"a">

function PaginationLink({
  className,
  isActive,
  size = "icon",
  ...props
}: PaginationLinkProps) {
  return (
    <a
      aria-current={isActive ? "page" : undefined}
      data-slot="pagination-link"
      data-active={isActive}
      className={cn(
        "inline-flex items-center justify-center rounded-md text-sm font-medium transition-[color,background-color,border-color,box-shadow] duration-(--duration-normal) ease-(--ease-standard) outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 select-none",
        isActive
          ? "border border-primary/20 bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 hover:text-primary-foreground"
          : "border border-border/70 bg-background text-muted-foreground shadow-xs hover:border-border hover:bg-muted hover:text-foreground",
        size === "icon" ? "size-8" : "h-8 gap-1.5 px-2.5",
        className
      )}
      {...props}
    />
  )
}

function PaginationPrevious({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink
      aria-label="Go to previous page"
      size="default"
      className={cn("gap-1.5 px-2.5", className)}
      {...props}
    >
      <ChevronLeftIcon className="size-4" />
      <span className="hidden sm:block">Previous</span>
    </PaginationLink>
  )
}

function PaginationNext({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink
      aria-label="Go to next page"
      size="default"
      className={cn("gap-1.5 px-2.5", className)}
      {...props}
    >
      <span className="hidden sm:block">Next</span>
      <ChevronRightIcon className="size-4" />
    </PaginationLink>
  )
}

function PaginationEllipsis({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn(
        "flex size-8 items-center justify-center text-muted-foreground/40",
        className
      )}
      {...props}
    >
      <MoreHorizontalIcon className="size-3.5" />
      <span className="sr-only">More pages</span>
    </span>
  )
}

// ── PaginationBar ─────────────────────────────────────────────────────────────
// A self-contained pagination footer: prev/next, smart page numbers with
// ellipsis, rows-per-page selector, and a from–to / total counter.

type PaginationBarProps = {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  pageSize: number
  pageSizeOptions?: readonly number[]
  onPageSizeChange: (size: number) => void
  totalItems: number
  /** Label for the rows-per-page selector. Defaults to "Rows per page". */
  rowsPerPageLabel?: string
  /** Pass "rtl" when the page is in an RTL layout to flip chevrons. */
  dir?: "ltr" | "rtl"
  className?: string
}

function PaginationBar({
  page,
  totalPages,
  onPageChange,
  pageSize,
  pageSizeOptions = [5, 10, 20, 50],
  onPageSizeChange,
  totalItems,
  rowsPerPageLabel = "Rows per page",
  dir = "ltr",
  className,
}: PaginationBarProps) {
  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(totalItems, page * pageSize)
  const shouldFlipArrows = dir === "rtl"

  // Smart page list: number = page button, null = ellipsis
  const visiblePages = React.useMemo((): (number | null)[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const left = Math.max(2, page - 1)
    const right = Math.min(totalPages - 1, page + 1)
    const items: (number | null)[] = [1]
    if (left > 2) items.push(null)
    for (let i = left; i <= right; i++) items.push(i)
    if (right < totalPages - 1) items.push(null)
    items.push(totalPages)
    return items
  }, [page, totalPages])

  return (
    <div
      data-slot="pagination-bar"
      className={cn("border-t border-border/70 bg-muted/20 px-4 py-3", className)}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

        <Pagination
          className="mx-auto w-auto justify-center md:mx-0 md:justify-start"
          dir="ltr"
        >
          <PaginationContent className="flex-wrap gap-0.5">
            {/* Previous */}
            <PaginationItem>
              <PaginationLink
                href="#"
                size="default"
                aria-label="Previous page"
                className={cn(
                  shouldFlipArrows && "scale-x-[-1]",
                  page === 1 && "pointer-events-none opacity-35"
                )}
                onClick={(e) => {
                  e.preventDefault()
                  onPageChange(Math.max(1, page - 1))
                }}
              >
                <ChevronLeftIcon className="size-4" />
              </PaginationLink>
            </PaginationItem>

            {/* Page numbers */}
            {visiblePages.map((p, index) =>
              p === null ? (
                <PaginationItem key={`ellipsis-${index}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={p}>
                  <PaginationLink
                    href="#"
                    isActive={p === page}
                    onClick={(e) => {
                      e.preventDefault()
                      onPageChange(p)
                    }}
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              )
            )}

            {/* Next */}
            <PaginationItem>
              <PaginationLink
                href="#"
                size="default"
                aria-label="Next page"
                className={cn(
                  shouldFlipArrows && "scale-x-[-1]",
                  page === totalPages && "pointer-events-none opacity-35"
                )}
                onClick={(e) => {
                  e.preventDefault()
                  onPageChange(Math.min(totalPages, page + 1))
                }}
              >
                <ChevronRightIcon className="size-4" />
              </PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>

        {/* Rows per page + counter */}
        <div className="flex items-center justify-center gap-3 md:justify-end">
          <span className="text-[11px] text-muted-foreground/70">
            {rowsPerPageLabel}
          </span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange(Number(v))}
          >
            <SelectTrigger className="h-7 w-16 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-[11px] tabular-nums text-muted-foreground/60">
            {from}–{to} / {totalItems}
          </span>
        </div>

      </div>
    </div>
  )
}

export {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
  PaginationBar,
}
