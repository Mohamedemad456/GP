# Frontend Codebase Skill

Use this file whenever an AI agent works on the Karna frontend. It defines the frontend structure, conventions, and decision rules the agent should follow.

For full architecture details, also read `docs/FRONTEND_ARCHITECTURE.md`.

## When To Use

Use this guidance for any task that touches:

- `frontend/src`
- React pages, layouts, components, hooks, or context
- API clients in `frontend/src/lib`
- translations in `frontend/src/locales`
- styling, Tailwind classes, or design-system components
- seller, buyer, admin, auth, or public frontend flows

## Core Stack

- React 19 + TypeScript + Vite.
- React Router owns routes in `src/App.tsx`.
- Axios API clients live in `src/lib`.
- Auth uses HttpOnly cookies and `AuthContext`.
- UI should prefer `@gp/design-system`.
- Tailwind CSS v4 is the styling layer.
- i18n uses `i18next` and `react-i18next`.
- English and Arabic are both first-class.

## Architecture Rules

### Routing

- Add routes only in `src/App.tsx`.
- Lazy-load route pages with `React.lazy`.
- Use `PrivateRoute` for authenticated pages.
- Use `PrivateRoute allowedRoles={["admin"]}` for admin routes.
- Use `PrivateRoute allowedRoles={["user"]}` for seller routes.
- Use `GuestRoute` only for guest-only auth pages.

Route groups:

- Public pages: `src/pages/(public)`
- Auth pages: `src/pages/(auth)`
- Buyer pages: `src/pages/(buyer)`
- Seller pages: `src/pages/(seller)`
- Admin pages: `src/pages/(admin)`

### Layouts

- Public shell: `src/components/Layout.tsx`
- Admin shell: `src/pages/(admin)/AdminLayout.tsx`
- Seller shell: `src/pages/(seller)/SellerLayout.tsx`
- Keep global shell components lightweight.
- Lazy-load non-critical heavy UI when possible, like chatbot or rarely opened panels.

### API Clients

- Do not call `api` directly from pages when adding a new backend endpoint.
- Create or update a domain API file in `src/lib`.
- Keep DTO/request/response types beside the API function.
- Keep endpoint comments above functions.
- Map frontend camelCase input to backend PascalCase payloads inside the API client, not in components.
- Return the backend response envelope unless an existing file already follows a different local convention.

Existing domain API files:

- `authApi.ts`
- `api.ts`
- `adminApi.ts`
- `listingsApi.ts`
- `makesApi.ts`
- `modelsApi.ts`
- `lookupsApi.ts`
- `conditionChecklistCategoriesApi.ts`
- `conditionDefectsApi.ts`

### Auth

- Auth state belongs in `src/context/AuthContext.tsx`.
- Do not store tokens in frontend state or localStorage.
- Axios uses `withCredentials: true`.
- `src/lib/api.ts` owns refresh-cookie retry behavior.
- If auth fails globally, use `authSignal.ts` pattern rather than importing React context into `api.ts`.

### Data Fetching

- Current app pattern is page-local `useEffect`, `useCallback`, `useState`.
- React Query is configured globally but not yet used broadly.
- If adding shared/repeated data, prefer React Query only when it clearly reduces duplicate fetching.
- For list endpoints, use backend pagination, sorting, and filters instead of client-side full-list filtering when available.
- Respect backend page-size limits. Current backend commonly caps page size at `10`.

### Forms

- Current forms use controlled inputs and manual validation.
- Keep validation close to the form unless the same rule is reused in multiple places.
- Use toast for mutation feedback and inline text for field-level errors.
- Keep payload creation explicit and typed.

### Styling and UI

- Prefer `@gp/design-system` components before creating local UI.
- Use Tailwind utility classes for layout and page-specific styling.
- Use `cn()` from `src/lib/utils.ts` for conditional class names.
- Keep classes token-based: `bg-card`, `text-muted-foreground`, `border-border`, `text-primary`, etc.
- Avoid hardcoded colors unless there is no design token available.
- Use CSS transitions for simple hover/focus effects.
- Use Framer Motion only when the motion is meaningful enough to justify bundle/runtime cost.

### Arabic and RTL

Every touched UI must preserve Arabic support.

- Add every visible string to both:
  - `src/locales/en/translation.json`
  - `src/locales/ar/translation.json`
- Use `t("key.path")`; do not hardcode user-visible strings.
- Respect `dir="rtl"` or document-level direction.
- Use logical Tailwind classes when possible: `start-*`, `end-*`, `ms-*`, `me-*`, `ps-*`, `pe-*`.
- Flip directional icons in RTL when needed.
- Use Arabic-friendly font stack when manually styling Arabic text:
  - `'Cairo', 'Tajawal', 'IBM Plex Arabic', sans-serif`
- Use locale-aware formatting for dates and numbers through `Intl`.

### Performance

- Keep route pages lazy-loaded.
- Memoize expensive derived values used in large tables or comboboxes.
- Memoize `Intl.NumberFormat` and `Intl.DateTimeFormat` per locale in table-heavy pages.
- Avoid sequential page fetch loops when remaining pages can be fetched in parallel safely.
- Revoke `URL.createObjectURL` previews on remove and unmount.
- Avoid importing large mock datasets into production-critical routes if an API exists.

### Error Handling

- Render crashes: `ErrorBoundary`.
- Auth failure: `api.ts` + `authSignal.ts`.
- API mutation failures: toast with backend `message` when available.
- Validation failures: inline field errors plus brief toast.
- Do not hide backend messages if they explain the failure.

## Feature Areas

### Seller Add Listing

Main file: `src/pages/(seller)/add-listing.tsx`

Flow:

1. Create listing details.
2. Add condition checklist defects.
3. Upload photos.
4. Generate price.
5. Submit listing.

Use API functions from `listingsApi.ts`. Do not skip required backend lifecycle steps.

### Admin Makes and Models

Files:

- `src/pages/(admin)/makes.tsx`
- `src/pages/(admin)/models.tsx`

Use server-side:

- pagination
- search
- sorting
- status filters
- make filters for models

### Admin Conditions

File: `src/pages/(admin)/conditions.tsx`

Keep bilingual English/Arabic editing intact. Admin condition API clients fetch both languages and merge results for review/editing.

### Admin Pending Cars

File: `src/pages/(admin)/cars-pending.tsx`

Use `adminApi.ts` and backend filters. Do not reintroduce mock listing data for this page.

## File Placement Rules

- Shared route shell: `src/components`
- Product pages: `src/pages/(role-or-area)`
- API clients: `src/lib/*Api.ts`
- Global auth state: `src/context`
- Shared hooks: `src/hooks`
- Translation files: `src/locales`
- Frontend-only shared types: `src/types`
- Mock/demo data: `src/data/mocks`
- Documentation: `docs`

## Do Not Do

- Do not put endpoint calls directly inside components if a reusable API client should exist.
- Do not store access tokens in JavaScript-visible storage.
- Do not add English-only UI.
- Do not replace design-system components with custom primitives without a reason.
- Do not add unrelated refactors while fixing a narrow bug.
- Do not remove user changes or dirty working tree changes you did not make.
- Do not use mock data for a flow that already has a working backend endpoint.

## Before Finishing A Frontend Change

Check:

- The route still lazy-loads if it is a page.
- API payloads match backend DTO casing and endpoint contracts.
- English and Arabic translations are both updated.
- RTL layout still works.
- Loading, empty, success, and error states are handled.
- New table/list work uses server pagination when available.
- Lints are clean for edited files.

Use `ReadLints` on edited files before final response.

## Response Style For Future Agents

When reporting frontend work:

- Mention changed files.
- Explain user-facing behavior changes.
- Explain architectural or performance reasons briefly.
- Mention verification performed.
- Mention anything not verified and why.
