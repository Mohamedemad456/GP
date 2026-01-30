# @gp/design-system

Design system package with token-based theming. Components are built with Shadcn-style patterns and styled using CSS variables from `tokens.css`.

## Storybook

Run Storybook to browse and develop components:

```bash
npm run storybook
```

Build the static Storybook:

```bash
npm run build-storybook
```

### Docker

From the repo root, run Storybook in a container:

```bash
docker compose up design-system-storybook
```

Then open http://localhost:6006. Source is mounted, so changes in `packages/design-system` hot-reload.

## Adding Shadcn Components

The package is configured for the [Shadcn CLI](https://ui.shadcn.com/docs). Components use `src/styles/tokens.css` for theming, so new components will automatically pick up your design tokens.

1. Add a component:
   ```bash
   npx shadcn@latest add [component-name]
   ```

2. The CLI will write to `src/components/`. If it uses `@/lib/utils`, that resolves to `src/lib/utils` (re-exporting `cn`).

3. After adding, export the component from `src/components/index.ts` and add a `.stories.tsx` file in the same folder.

## Tokens

Design tokens live in `src/styles/tokens.css`:

- **Colors**: `--primary`, `--background`, `--destructive`, `--success`, `--warning`, `--info`, etc.
- **Spacing**: `--space-1` through `--space-8`
- **Typography**: `--font-sans`, `--font-heading`, `--font-mono`
- **Shadows, radius, motion**: `--shadow-*`, `--radius`, `--duration-*`, `--ease-*`

`@theme inline` maps these to Tailwind utilities (`bg-primary`, `text-muted-foreground`, etc.).

## Exports

- `@gp/design-system` — components and `cn`
- `@gp/design-system/styles.css` — base styles (import `tokens.css` in your app)
