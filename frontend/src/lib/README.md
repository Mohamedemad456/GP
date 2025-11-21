# Component Library

This is your customizable component library built with [shadcn/ui](https://ui.shadcn.com/). All components are fully editable and can be customized to match your design needs.

## 📁 Structure

```
src/lib/
├── ui/              # shadcn/ui components (fully customizable)
│   ├── button.tsx   # Button component
│   ├── card.tsx     # Card component
│   └── index.ts     # Component exports
├── utils.ts         # Utility functions (cn helper)
├── index.ts         # Main library exports
└── README.md        # This file
```

## 🚀 Quick Start

### Importing Components

```tsx
// Import individual components
import { Button } from "@/lib/ui"
import { Card, CardHeader, CardTitle } from "@/lib/ui"

// Or import from the main lib index
import { Button, Card } from "@/lib"
```

### Using Components

```tsx
import { Button } from "@/lib/ui"
import { Card, CardHeader, CardTitle, CardContent } from "@/lib/ui"

function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>My Card</CardTitle>
      </CardHeader>
      <CardContent>
        <Button variant="default" size="lg">
          Click Me
        </Button>
      </CardContent>
    </Card>
  )
}
```

## ✨ Adding New Components

### Method 1: Using shadcn CLI (Recommended)

Use the shadcn CLI to add pre-built components:

```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add input
npx shadcn@latest add dialog
# etc.
```

The CLI will automatically:
- Install required dependencies
- Add the component to `src/lib/ui/`
- Configure everything for you

### Method 2: Manual Component Creation

1. Create a new file in `src/lib/ui/` (e.g., `my-component.tsx`)
2. Follow shadcn component patterns
3. Export it from `src/lib/ui/index.ts`

```tsx
// src/lib/ui/my-component.tsx
import { cn } from "@/lib/utils"

export const MyComponent = ({ className, ...props }) => {
  return (
    <div className={cn("base-styles", className)} {...props} />
  )
}
```

```ts
// src/lib/ui/index.ts
export { MyComponent } from "./my-component"
```

## 🎨 Customizing Components

**All components are fully customizable!** Simply edit the component files directly:

### Example: Customizing Button Variants

```tsx
// src/lib/ui/button.tsx
const buttonVariants = cva(
  "base-styles",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        custom: "bg-purple-500 text-white", // Add your custom variant
        // ... other variants
      },
      // ...
    }
  }
)
```

### Example: Modifying Card Styles

```tsx
// src/lib/ui/card.tsx
const Card = ({ className, ...props }) => (
  <div
    className={cn(
      "rounded-xl border bg-card text-card-foreground shadow",
      "your-custom-classes", // Add your custom styles
      className
    )}
    {...props}
  />
)
```

## 📦 Available Components

### Button

A versatile button component with multiple variants and sizes.

```tsx
<Button variant="default" size="lg">Default</Button>
<Button variant="outline" size="sm">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Delete</Button>
```

**Variants:** `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`  
**Sizes:** `default`, `sm`, `lg`, `icon`

### Card

A flexible card component with header, title, description, content, and footer sections.

```tsx
<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description</CardDescription>
  </CardHeader>
  <CardContent>
    Card content goes here
  </CardContent>
  <CardFooter>
    Footer content
  </CardFooter>
</Card>
```

## 🛠️ Utilities

### `cn()` - Class Name Utility

The `cn()` function helps merge Tailwind CSS classes efficiently:

```tsx
import { cn } from "@/lib/utils"

<div className={cn("base-class", className, { "conditional-class": isActive })} />
```

This utility combines `clsx` and `tailwind-merge` for optimal class merging.

## 🎯 Best Practices

### 1. Component Composition

Build complex UIs by composing simple components:

```tsx
<Card>
  <CardHeader>
    <CardTitle>Settings</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    <Button>Save</Button>
    <Button variant="outline">Cancel</Button>
  </CardContent>
</Card>
```

### 2. Customization Over Configuration

Since components are in your codebase, modify them directly rather than passing many props:

```tsx
// ✅ Good: Modify component directly
const CustomButton = ({ className, ...props }) => (
  <Button className={cn("custom-styles", className)} {...props} />
)

// ❌ Avoid: Over-complicating with too many props
<Button variant="custom" size="large" rounded="full" shadow="lg" />
```

### 3. Consistent Styling

Use the design system tokens defined in `src/index.css`:

- `--primary`, `--secondary` (colors)
- `--border`, `--input` (borders)
- `--radius` (border radius)
- etc.

### 4. TypeScript Support

All components are fully typed. Leverage TypeScript for better DX:

```tsx
import { Button, type ButtonProps } from "@/lib/ui"

const MyButton = (props: ButtonProps) => <Button {...props} />
```

## 📚 Adding More Components

Explore the [shadcn/ui components](https://ui.shadcn.com/docs/components) and add what you need:

```bash
# Form components
npx shadcn@latest add input
npx shadcn@latest add textarea
npx shadcn@latest add select
npx shadcn@latest add checkbox

# Overlay components
npx shadcn@latest add dialog
npx shadcn@latest add dropdown-menu
npx shadcn@latest add popover

# Data display
npx shadcn@latest add table
npx shadcn@latest add badge
npx shadcn@latest add avatar

# Navigation
npx shadcn@latest add tabs
npx shadcn@latest add navigation-menu
```

## 🔧 Configuration

Component library configuration is in `components.json` at the root:

```json
{
  "style": "new-york",           // Component style
  "aliases": {
    "ui": "@/lib/ui",            // Where components live
    "utils": "@/lib/utils"       // Where utilities live
  }
}
```

## 💡 Tips

1. **Version Control**: Components are in your repo, so you have full control
2. **Customization**: Modify components directly - no need for wrappers
3. **Updates**: Update components manually as needed (they're yours!)
4. **Theming**: Customize CSS variables in `src/index.css` for global theming
5. **Consistency**: Follow shadcn patterns for new components

## 📖 Resources

- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [shadcn/ui Components](https://ui.shadcn.com/docs/components)
- [Radix UI Primitives](https://www.radix-ui.com/) (shadcn uses these)
- [Tailwind CSS](https://tailwindcss.com/docs)

## 🤝 Contributing

This is your library! Feel free to:
- Modify existing components
- Add new components
- Refactor as needed
- Create component variants
- Share reusable patterns

---

**Remember**: This is YOUR component library. Customize it however you need!
