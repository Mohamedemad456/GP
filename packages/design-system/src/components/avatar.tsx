import * as React from "react"
import { Avatar as AvatarPrimitive } from "radix-ui"

import { cn } from "../utils/cn"

function Avatar({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
  size?: "sm" | "default" | "lg" | "xl"
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        "group/avatar relative flex shrink-0 select-none rounded-full",
        "ring-1 ring-border/50",
        "transition-shadow duration-(--duration-normal) ease-(--ease-standard)",
        "data-[size=sm]:size-7",
        "data-[size=default]:size-9",
        "data-[size=lg]:size-11",
        "data-[size=xl]:size-14",
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full overflow-hidden rounded-[inherit] object-cover", className)}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center overflow-hidden rounded-full font-sans font-medium",
        "bg-muted text-muted-foreground",
        "group-data-[size=sm]/avatar:text-xs",
        "group-data-[size=default]/avatar:text-sm",
        "group-data-[size=lg]/avatar:text-base",
        "group-data-[size=xl]/avatar:text-lg",
        "[&_svg]:shrink-0",
        "group-data-[size=sm]/avatar:[&_svg]:size-3.5",
        "group-data-[size=default]/avatar:[&_svg]:size-4",
        "group-data-[size=lg]/avatar:[&_svg]:size-5",
        "group-data-[size=xl]/avatar:[&_svg]:size-6",
        className
      )}
      {...props}
    />
  )
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full select-none",
        "ring-2 ring-background",
        "group-data-[size=sm]/avatar:size-2.5",
        "group-data-[size=default]/avatar:size-3",
        "group-data-[size=lg]/avatar:size-3.5",
        "group-data-[size=xl]/avatar:size-4",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "group/avatar-group flex -space-x-2",
        "*:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroupCount({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full ring-2 ring-background",
        "bg-muted text-muted-foreground font-sans text-sm font-medium",
        "size-9",
        "group-has-data-[size=sm]/avatar-group:size-7 group-has-data-[size=sm]/avatar-group:text-xs",
        "group-has-data-[size=lg]/avatar-group:size-11 group-has-data-[size=lg]/avatar-group:text-base",
        "group-has-data-[size=xl]/avatar-group:size-14 group-has-data-[size=xl]/avatar-group:text-lg",
        "[&>svg]:size-4 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5",
        className
      )}
      {...props}
    />
  )
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarBadge,
  AvatarGroup,
  AvatarGroupCount,
}
