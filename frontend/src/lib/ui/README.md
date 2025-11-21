# Design Tokens

Design tokens map CSS variables (defined in `src/index.css`) to Tailwind utility classes for use in component className props.

## Usage

### Import Tokens

```tsx
import { tokens, text, bg, border, rounded } from "@/lib/ui"
// or
import tokens from "@/lib/ui"
```

### Using Tokens in Components

```tsx
import { cn } from "@/lib/utils"
import { bg, text, border, rounded } from "@/lib/ui/tokens"

function MyComponent() {
  return (
    <div className={cn(
      bg.primary,           // bg-primary (uses --primary CSS variable)
      text["primary-foreground"], // text-primary-foreground
      rounded.default,      // rounded-md
      border.default        // border border-border
    )}>
      Content
    </div>
  )
}
```

### Using Tokens in Button Component

```tsx
// src/lib/ui/button.tsx
import { bg, text, border } from "./tokens"

const buttonVariants = cva(
  "base-classes...",
  {
    variants: {
      variant: {
        default: cn(bg.primary, text["primary-foreground"]),
        outline: cn(border.default, bg.background),
        // ...
      }
    }
  }
)
```

## Available Tokens

### Colors

```tsx
import { bg, text } from "@/lib/ui/tokens"

// Background colors (automatically use CSS variables)
bg.background      // bg-background
bg.card           // bg-card
bg.primary        // bg-primary
bg.secondary      // bg-secondary
bg.accent         // bg-accent
bg.destructive    // bg-destructive

// Text colors (automatically use CSS variables)
text.foreground           // text-foreground
text["primary-foreground"] // text-primary-foreground
text.secondary           // text-secondary
text.muted              // text-muted-foreground
text.destructive        // text-destructive
```

### Borders

```tsx
import { border } from "@/lib/ui/tokens"

border.default    // border border-border
border.input      // border border-input
border.ring       // border border-ring
border.none       // border-0
```

### Radius

```tsx
import { rounded } from "@/lib/ui/tokens"

rounded.default   // rounded-md
rounded.lg        // rounded-lg
rounded.xl        // rounded-xl
rounded.full      // rounded-full
// CSS variable-based radius
rounded.token     // rounded-[var(--radius)]
rounded["token-sm"] // rounded-[var(--radius-sm)]
```

## How It Works

1. **CSS Variables** are defined in `src/index.css`:
   ```css
   :root {
     --primary: oklch(0.5 0.08 180);
     --primary-foreground: oklch(1 0 0);
     /* ... */
   }
   ```

2. **Tailwind** automatically maps these to utility classes:
   - `--primary` → `bg-primary`, `text-primary`, etc.
   - `--primary-foreground` → `text-primary-foreground`
   - `--radius` → `rounded-[var(--radius)]`

3. **Tokens** provide a type-safe way to use these classes:
   ```tsx
   bg.primary  // Type-safe, autocompletes
   ```

## Benefits

1. **Type Safety**: Get autocomplete and type checking
2. **Consistency**: All components use the same tokens
3. **Easy Updates**: Change CSS variables in `index.css` and all components update
4. **Dark Mode**: Automatically works with `.dark` class
5. **Organization**: All design tokens in one place

## Customizing Tokens

To add new tokens:

1. **Add CSS variable** in `src/index.css`:
   ```css
   :root {
     --custom-color: oklch(0.5 0.08 180);
   }
   ```

2. **Add to Tailwind config** (if needed):
   ```ts
   // Already handled via @theme in index.css
   ```

3. **Add to tokens.ts**:
   ```ts
   export const bg = {
     // ...existing
     custom: "bg-custom-color",
   } as const
   ```

4. **Use in components**:
   ```tsx
   import { bg } from "@/lib/ui/tokens"
   <div className={bg.custom}>...</div>
   ```

---

**Design tokens ensure consistent styling across all components!** 🎨

