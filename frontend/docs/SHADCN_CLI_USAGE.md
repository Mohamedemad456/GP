# Using shadcn CLI with Your Component Library

## Current Status

✅ **Components are ready!** The `button.tsx` and `card.tsx` files were created manually following shadcn patterns. They work exactly the same as if installed via CLI.

## Using shadcn CLI to Add Components

Your setup is fully configured for the shadcn CLI. You can now add components using:

```bash
npx shadcn@latest add [component-name]
```

### Examples

```bash
# Add input component
npx shadcn@latest add input

# Add dialog component
npx shadcn@latest add dialog

# Add dropdown-menu component
npx shadcn@latest add dropdown-menu

# Add table component
npx shadcn@latest add table
```

## Replacing Existing Components (Optional)

If you want to replace the manually created `button.tsx` and `card.tsx` with official shadcn versions:

```bash
# This will ask if you want to overwrite
npx shadcn@latest add button
npx shadcn@latest add card
```

**Note**: Choose "Yes" to overwrite when prompted. The official versions will be identical or very similar to what's already there.

## Component Location

All components installed via CLI will be added to:
```
src/lib/ui/[component-name].tsx
```

This matches your `components.json` configuration where:
- `"ui": "@/lib/ui"` - Components go here

## Available Components

View all available components at: https://ui.shadcn.com/docs/components

Popular components to add:
- `input` - Form input
- `textarea` - Multi-line input
- `select` - Dropdown select
- `checkbox` - Checkbox
- `radio-group` - Radio buttons
- `dialog` - Modal dialog
- `dropdown-menu` - Dropdown menu
- `popover` - Popover
- `table` - Data table
- `badge` - Badge/tag
- `avatar` - Avatar image
- `tabs` - Tabs component
- `accordion` - Accordion/collapsible
- `alert` - Alert/notification
- `skeleton` - Loading skeleton
- `toast` - Toast notifications

## Adding Multiple Components

```bash
# Add multiple at once
npx shadcn@latest add input textarea select checkbox
```

## Configuration

Your `components.json` is already configured:
- ✅ Style: `new-york`
- ✅ Components location: `@/lib/ui`
- ✅ Utils location: `@/lib/utils`
- ✅ CSS file: `src/index.css`

## Tips

1. **Customize After Install**: After installing via CLI, you can still edit components directly in `src/lib/ui/`

2. **Overwrite Policy**: When asked to overwrite, the CLI will:
   - Show a diff if files differ
   - Ask for confirmation before overwriting

3. **Dependencies**: The CLI will automatically install required dependencies (like `@radix-ui/*` packages)

4. **TypeScript**: All components come with full TypeScript support

5. **Styling**: Components use your CSS variables from `src/index.css`

## Verification

To verify your setup works with shadcn CLI:

```bash
# Try adding a new component you don't have yet
npx shadcn@latest add input
```

This should:
1. Install any missing dependencies
2. Create `src/lib/ui/input.tsx`
3. Export it from `src/lib/ui/index.ts` (if using auto-export)

---

**Your component library is ready for both manual and CLI-based component management!** 🚀
