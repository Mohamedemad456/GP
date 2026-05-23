# Frontend Architecture and Structure

This document explains the frontend structure, what is used in it, how each part is used, and why the current architecture was chosen.

The frontend is a React single-page application built with Vite. It is organized around role-based route groups, typed API clients, shared layout components, a local design system package, cookie-based authentication, and bilingual English/Arabic support.

## Technology Stack

### Runtime and Framework

- React 19 is used for the UI layer.
- Vite is used as the development server and production bundler.
- TypeScript is used for static typing across components, API DTOs, and helper modules.
- React Router is used for SPA routing.
- Axios is used for HTTP communication with the backend.
- i18next and react-i18next are used for translations.
- Tailwind CSS v4 is used for utility styling.
- `@gp/design-system` is the main shared UI component package.
- Sonner is used for toast notifications.
- Lucide React is used for icons.
- Framer Motion is used for animation-heavy UI, mostly in public/marketing UI and navigation.
- React Query is configured globally, but most product pages currently use explicit `useEffect` fetching.

### Tooling

Important files:

- `package.json`
- `vite.config.ts`
- `eslint.config.js`
- `tsconfig.json`
- `tsconfig.app.json`
- `tsconfig.node.json`
- `index.html`

Scripts:

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "preview": "vite preview"
}
```

The build script runs TypeScript project checks first, then creates the Vite production build.

## Root Folder Structure

```text
frontend/
  docs/
  public/
  src/
  index.html
  package.json
  vite.config.ts
  eslint.config.js
  tsconfig.json
  tsconfig.app.json
  tsconfig.node.json
```

### `docs/`

Documentation for the frontend. This file lives here because it describes the frontend app itself and should be close to the code it explains.

Existing docs include:

- `docs/README.md`
- `docs/SHADCN_CLI_USAGE.md`
- `docs/component-library/COMPONENT_LIBRARY_SETUP.md`

### `src/`

All frontend application source code lives here.

```text
src/
  actions/
  components/
  context/
  data/
  examples/
  hooks/
  lib/
  locales/
  pages/
  types/
  App.tsx
  index.css
  main.tsx
```

## Application Bootstrap

### `src/main.tsx`

This is the browser entry point. It mounts React into `#root`.

It wraps the app with:

- `StrictMode`
- `QueryClientProvider`
- `BrowserRouter`

It also imports:

- `index.css`
- `lib/i18n/config.ts`
- `App.tsx`

The Query Client is configured with:

- `staleTime: 5 minutes`
- `gcTime: 10 minutes`
- `refetchOnWindowFocus: false`
- `retry: 1`
- `refetchOnMount: false`

Why this setup is used:

- The app is an SPA, so `BrowserRouter` owns client-side routing.
- React Query is available globally for future cached server state.
- Current screens mostly use direct `useEffect` fetching, but the Query Client is ready for gradual migration.
- `StrictMode` helps catch unsafe React patterns during development.

## Routing Architecture

### `src/App.tsx`

`App.tsx` owns the route tree. Every route page is lazy-loaded with `React.lazy`.

The app is wrapped by:

- `ErrorBoundary`
- `AuthProvider`
- `Suspense`
- global `Toaster`

High-level route groups:

```text
/
  public layout
  home
  about
  contact
  buyer protected routes

/login
/signup
  guest-only auth routes

/onboarding
  public onboarding route

/admin
  admin-only dashboard routes

/seller
  seller/user-only dashboard routes
```

### Why Routes Are Grouped This Way

The app has different user contexts:

- public visitors
- unauthenticated auth users
- authenticated buyers/users
- sellers
- admins

Role-based grouping keeps the route tree easy to reason about. It also makes authorization explicit at the route boundary instead of scattering role checks inside every page.

### Route Guards

Route guards live in:

- `src/components/PrivateRoute.tsx`
- `src/components/GuestRoute.tsx`

`PrivateRoute` checks:

- whether auth state is still loading
- whether a user exists
- whether the user role matches `allowedRoles`, when provided

`GuestRoute` prevents logged-in users from returning to login/signup pages.

## Page Structure

Pages are grouped by route/domain:

```text
src/pages/
  (public)/
  (auth)/
  (buyer)/
  (seller)/
  (admin)/
```

The parentheses are a local grouping convention. They do not affect URLs by themselves. The actual URLs are defined in `App.tsx`.

### Public Pages

```text
src/pages/(public)/
  home.tsx
  about.tsx
  contact.tsx
```

These pages use the public layout:

- `Navbar`
- page content via `Outlet`
- `Footer`
- lazy-loaded `ChatbotSheet`

### Auth Pages

```text
src/pages/(auth)/
  login.tsx
  signup.tsx
  onboarding.tsx
```

Responsibilities:

- login and signup forms
- auth API calls
- redirect decisions
- onboarding favorite make selection

`onboarding.tsx` loads active makes from the API and displays them through `FavoriteModelsSlide`.

### Buyer Pages

```text
src/pages/(buyer)/
  feed.tsx
  car-details.tsx
  profile.tsx
```

Responsibilities:

- browse listings
- view listing details
- view/edit profile

Current maturity note:

- Some buyer listing screens still use mock listing data.
- Profile is API-backed.

### Seller Pages

```text
src/pages/(seller)/
  SellerLayout.tsx
  analytics.tsx
  listings.tsx
  add-listing.tsx
```

`SellerLayout` provides the seller dashboard shell.

`add-listing.tsx` is the main API-backed seller workflow. It handles:

- listing details
- checklist defects
- listing photos
- ML price generation
- final listing submit

### Admin Pages

```text
src/pages/(admin)/
  AdminLayout.tsx
  analytics.tsx
  users-pending.tsx
  cars-pending.tsx
  makes.tsx
  models.tsx
  conditions.tsx
```

`AdminLayout` provides the admin dashboard shell.

API-backed admin pages:

- `cars-pending.tsx`
- `makes.tsx`
- `models.tsx`
- `conditions.tsx`

Mock/demo-based admin pages:

- `analytics.tsx`
- `users-pending.tsx`

## Shared Components

```text
src/components/
  ChatbotSheet.tsx
  ErrorBoundary.tsx
  Footer.tsx
  GuestRoute.tsx
  LanguageSwitcher.tsx
  Layout.tsx
  Navbar.tsx
  PrivateRoute.tsx
  index.ts
  onboarding/
```

### `Layout.tsx`

The public shell:

- renders `Navbar`
- renders nested route page through `Outlet`
- renders `Footer`
- lazy-loads `ChatbotSheet`

Why the chatbot is lazy-loaded:

- Chat is not required for first paint.
- It imports interactive UI and animation-related logic.
- Splitting it keeps the initial layout bundle smaller.

### `Navbar.tsx`

Global public navigation.

It handles:

- public nav links
- auth-aware actions
- account/admin/seller links
- mobile menu behavior
- language switching

### `Footer.tsx`

Global public footer with navigation and product information.

### `ErrorBoundary.tsx`

Catches render-time errors and prevents the whole app from crashing into a blank page.

### `LanguageSwitcher.tsx`

Switches between English and Arabic through i18next.

### `ChatbotSheet.tsx`

Floating chat UI connected to:

- `src/actions/action.ts`
- `src/lib/formatMarkdown.tsx`

It posts messages to the configured AI endpoint and renders formatted assistant responses.

## Authentication Architecture

Important files:

```text
src/context/AuthContext.tsx
src/lib/api.ts
src/lib/authApi.ts
src/lib/authSignal.ts
src/components/PrivateRoute.tsx
src/components/GuestRoute.tsx
```

### Auth Model

The frontend assumes the backend stores tokens in HttpOnly cookies.

This means:

- JavaScript does not read access tokens directly.
- Axios must send cookies with each request.
- `withCredentials: true` is enabled globally.

### `AuthContext.tsx`

Stores:

- `user`
- `isLoading`
- `setUser`
- `clearUser`

On app load, it calls `getProfile()` to check whether the backend cookies represent a valid session.

Role mapping:

- backend roles are strings
- frontend reduces them to `"admin"` or `"user"`

Why this architecture was chosen:

- Auth state is needed globally.
- Context is simple enough for auth identity.
- Sensitive tokens remain in backend-managed cookies.
- Route guards can rely on a single auth source.

### `authSignal.ts`

This avoids a circular dependency between the Axios API layer and React context.

`api.ts` cannot directly import `AuthContext`, so it triggers an auth failure signal. `AuthProvider` registers `clearUser` as the handler.

### `PrivateRoute.tsx`

Used for authenticated and role-protected route groups.

Examples:

- buyer/profile routes require any authenticated user
- `/admin/*` requires role `"admin"`
- `/seller/*` requires role `"user"`

### `GuestRoute.tsx`

Used for `/login` and `/signup`.

It prevents already-authenticated users from seeing guest-only auth pages.

## API Architecture

All API clients live in `src/lib`.

```text
src/lib/
  api.ts
  authApi.ts
  adminApi.ts
  listingsApi.ts
  makesApi.ts
  modelsApi.ts
  lookupsApi.ts
  conditionChecklistCategoriesApi.ts
  conditionDefectsApi.ts
```

### `api.ts`

The shared Axios instance.

Configuration:

- base URL from `VITE_API_BASE_URL`
- fallback base URL: `http://localhost:5082`
- `withCredentials: true`
- default JSON content type
- request interceptor sets `Accept-Language`
- response interceptor handles 401 refresh

### Silent Refresh Flow

When an API request returns 401:

1. Axios checks whether the request already retried.
2. It skips refresh attempts for the refresh endpoint itself.
3. It calls `POST /api/auth/refresh-cookie`.
4. If refresh succeeds, it retries the original request.
5. If multiple requests fail at once, they wait in a queue.
6. If refresh fails, it clears frontend auth state and redirects to `/login`.

Why this is used:

- Users stay logged in when access cookies expire.
- Multiple simultaneous 401s do not trigger multiple refresh requests.
- Auth failure is centralized.

### API Client Style

Each domain has its own file.

Benefits:

- API DTOs stay close to the endpoint functions.
- Components import only the domain they need.
- Backend route comments make the contract obvious.
- Payload mapping from camelCase to PascalCase stays out of UI components.

Example pattern:

```ts
export const getAllMakes = (params?: MakeSpecParams) =>
  api
    .get<ApiResponse<PaginatedResponse<MakeDto>>>("/api/Makes/All", { params })
    .then((r) => r.data);
```

### Domain API Files

#### `authApi.ts`

Handles:

- login
- register
- logout
- logout all
- profile
- update profile
- change password

#### `makesApi.ts`

Handles:

- active makes
- admin all makes
- create/update make with multipart form data
- activate/deactivate/delete
- logo URL normalization
- pagination and sorting query params

#### `modelsApi.ts`

Handles:

- active models
- admin all models
- create/update model
- activate/deactivate/delete
- make filtering
- pagination and sorting

#### `conditionChecklistCategoriesApi.ts`

Handles:

- active condition categories
- admin all condition categories
- create/update/delete
- activate/deactivate
- bilingual admin merge

For admin views, it fetches English and Arabic versions and merges them by ID so the UI can show both languages together.

#### `conditionDefectsApi.ts`

Handles:

- active condition defects
- admin all condition defects
- create/update/delete
- activate/deactivate
- category filtering
- bilingual admin merge

#### `listingsApi.ts`

Handles:

- create listing
- update listing
- add condition checklist
- upload photos
- submit listing
- approve/reject listing
- mark sold
- status history
- delete listing
- generate ML price
- set final listing price

Important note:

- `generateListingPrice()` handles backend `400` ApiResponse bodies so UI can read the actual backend message.

#### `adminApi.ts`

Handles:

- pending listing moderation list
- pagination
- make/model/seller/date filters

#### `lookupsApi.ts`

Handles:

- lookup groups
- fuel types
- transmission types
- listing statuses
- locations

## Data Fetching Pattern

Most pages use:

- `useState` for data/loading/error state
- `useEffect` or `useCallback` for fetching
- typed API client functions from `src/lib`
- toast messages for errors

React Query is installed and configured but not broadly adopted yet.

Why this mixed approach exists:

- The app started with direct API calls and local page state.
- The Query Client is already available for future migration.
- Direct fetching keeps current pages explicit and easy to debug.

Recommended future direction:

- Move repeated lookup/catalog/profile fetching to React Query.
- Use stable query keys for makes/models/lookups/profile.
- Keep mutation flows in dedicated hooks.

## State Management

Global state:

- Auth user via `AuthContext`

Page-local state:

- filters
- pagination
- forms
- loading states
- selected rows/dialog targets
- upload previews

Why no large global store is used:

- The app does not need complex shared client state yet.
- Most state belongs to a single page or form.
- A global store would add complexity without clear benefit.

## Forms and Validation

The frontend uses controlled React inputs and manual validation.

Examples:

- login/signup forms
- profile editing
- admin create/edit dialogs
- seller add-listing wizard

Why manual validation is used:

- Forms are currently straightforward.
- Validation rules are local to each screen.
- It avoids introducing another form library before the app needs it.

For larger future forms, `react-hook-form` plus a schema validator could reduce boilerplate.

## Seller Add Listing Flow

Main file:

```text
src/pages/(seller)/add-listing.tsx
```

Steps:

1. Listing details
2. Condition defects
3. Photos
4. Price generation
5. Submit listing

Data used:

- active makes
- active models
- lookups
- active condition categories
- active condition defects

Backend operations:

- `createListing`
- `addListingChecklist`
- `uploadListingPhotos`
- `generateListingPrice`
- `submitListing`

Performance details:

- make/model page loading is parallelized after the first page discovers total count
- image preview object URLs are revoked when removed and on unmount
- derived option lists are memoized where needed

Why this flow is split into steps:

- It matches the backend lifecycle.
- It prevents uploading photos or checklists before a listing exists.
- It gives sellers a clearer completion path.
- It allows validation to be scoped per step.

## Admin Management Flows

### Makes

File:

```text
src/pages/(admin)/makes.tsx
```

Uses:

- `getAllMakes`
- pagination
- search
- status filter
- sorting
- create/update via multipart form data
- activate/deactivate/delete

### Models

File:

```text
src/pages/(admin)/models.tsx
```

Uses:

- `getAllModels`
- pagination
- search
- status filter
- make filter
- sorting
- create/update
- activate/deactivate/delete

### Conditions

File:

```text
src/pages/(admin)/conditions.tsx
```

Uses:

- condition categories API
- condition defects API
- bilingual admin data merge
- pagination
- search
- status filter
- category filter for defects
- sorting
- create/update/delete
- activate/deactivate

Performance details:

- `Intl.DateTimeFormat` is memoized per locale
- category combobox options are memoized

### Pending Cars

File:

```text
src/pages/(admin)/cars-pending.tsx
```

Uses:

- `getPendingListings`
- pagination
- make/model/seller/date filters
- approve/reject actions

Performance details:

- `Intl.NumberFormat` and `Intl.DateTimeFormat` are memoized per locale
- filter option lists are memoized

## Localization and RTL

Important files:

```text
src/lib/i18n/config.ts
src/locales/en/translation.json
src/locales/ar/translation.json
src/locales/en/common.json
src/locales/ar/common.json
src/components/LanguageSwitcher.tsx
src/hooks/useI18n.ts
```

Languages:

- English
- Arabic

Detection order:

1. localStorage
2. browser navigator
3. HTML tag

Stored language key:

```text
i18nextLng
```

RTL behavior:

- Arabic sets `document.documentElement.dir = "rtl"`
- English sets `dir = "ltr"`
- UI components use logical properties when needed
- some layouts flip sidebar direction for Arabic
- toast position changes based on language

Why i18next is used:

- It integrates cleanly with React.
- It supports language detection.
- It supports multiple namespaces.
- It works well with runtime direction changes.

## Styling Architecture

Important files:

```text
src/index.css
vite.config.ts
src/lib/utils.ts
```

### Tailwind and Design System

`src/index.css` imports:

- Google fonts
- Tailwind
- design system source scanning
- `@gp/design-system/styles.css`

```css
@import "tailwindcss";
@source "../../packages/design-system/src";
@import "@gp/design-system/styles.css";
```

Why this is used:

- The design system package provides shared components and tokens.
- Tailwind utilities keep page-level styling fast and local.
- The `@source` directive ensures Tailwind sees classes from the package.

### Utility Classes

Local utilities include:

- `hero-gradient`
- `noise`
- `glass`
- `shadow-elevated`

These provide repeated visual treatments without rewriting long class chains.

### `cn()`

File:

```text
src/lib/utils.ts
```

Combines:

- `clsx`
- `tailwind-merge`

Used for conditional classes without duplicate/conflicting Tailwind utilities.

## Design System Usage

The project primarily imports components from:

```text
@gp/design-system
```

Common components:

- `Button`
- `Input`
- `Label`
- `Select`
- `Combobox`
- `Dialog`
- `Table`
- `Badge`
- `Card`
- `PaginationBar`
- `Skeleton`
- `Textarea`
- `Separator`
- `PageLoader`

Why a design system is used:

- It keeps admin, seller, buyer, and public UI visually consistent.
- It avoids rebuilding common primitives.
- It centralizes tokens, variants, sizes, and accessibility behavior.
- It makes UI changes easier to apply across the app.

## Local UI Wrappers

```text
src/lib/ui/
  button.tsx
  card.tsx
  input.tsx
  separator.tsx
  sonner.tsx
  textarea.tsx
  index.ts
```

These are shadcn-style wrappers used by some local examples and exports.

Why they exist:

- They provide local primitives where needed.
- They preserve compatibility with existing component examples.
- The main app still prefers `@gp/design-system` for product UI.

## Toast and Feedback

Files:

```text
src/hooks/use-toast.ts
src/lib/ui/sonner.tsx
```

Toast usage:

- success messages after mutations
- error messages for failed API calls
- validation failures

Why toasts are used:

- Most actions happen inside page flows or dialogs.
- Toasts give non-blocking feedback.
- They avoid adding extra page-level error surfaces for every mutation.

## Icons

Icons come from:

```text
lucide-react
```

Why:

- consistent SVG icon set
- tree-shakable imports
- works well with Tailwind sizing and color classes

## Animations

Animations are mainly implemented with:

- Framer Motion
- CSS transitions
- Tailwind utility transitions

Why:

- Framer Motion is useful for complex UI movement and presence transitions.
- CSS transitions are preferred for simple hover/focus states.
- Heavy animation code is avoided in critical paths where possible.

## Performance Architecture

Current performance choices:

- route-level lazy loading in `App.tsx`
- chatbot lazy loading in `Layout.tsx`
- memoized expensive formatters in table-heavy admin pages
- memoized derived options for large comboboxes
- parallelized catalog paging after first-page count discovery
- object URL cleanup for uploaded image previews
- Vite manual chunks for vendor splitting

Vite manual chunks:

```ts
manualChunks: {
  "react-vendor": ["react", "react-dom", "react-router-dom"],
  "ui-vendor": ["framer-motion", "lucide-react"],
  "i18n-vendor": ["i18next", "react-i18next", "i18next-browser-languagedetector"],
  "query-vendor": ["@tanstack/react-query"],
}
```

Why:

- vendor chunks change less often than app code
- browsers can cache vendor bundles better
- route chunks keep initial load smaller

## Mock Data

Mock data lives in:

```text
src/data/mocks/
  cars.ts
  listings.ts
```

Used by some pages that are not fully API-backed yet.

Examples:

- buyer feed/details
- seller listings/analytics
- admin analytics/users pending

Important distinction:

- API-backed pages should use `src/lib/*Api.ts`
- mock-backed pages are currently prototype/demo surfaces

Why mocks exist:

- They allow UI development before backend endpoints exist.
- They make it possible to design and test layouts early.
- They should be replaced by paginated backend APIs when those endpoints are ready.

## Examples Folder

```text
src/examples/
  ComponentLibraryExample.tsx
  I18nExample.tsx
  ReactQueryExample.tsx
```

These are examples and internal references, not primary product routes.

They demonstrate:

- component usage
- i18n behavior
- React Query setup

## Types Folder

```text
src/types/
  about.ts
  auth.ts
  home.ts
  index.ts
  onboarding.ts
```

Used for shared frontend-only type definitions.

API DTO types usually live beside their API client in `src/lib`.

Why:

- frontend-only presentation types stay in `types`
- backend contract types stay close to API functions

## Path Aliases

Configured in `vite.config.ts`:

```ts
"@": path.resolve(__dirname, "./src")
```

Used like:

```ts
import { api } from "@/lib/api";
import PrivateRoute from "@/components/PrivateRoute";
```

Why:

- avoids fragile deep relative imports
- makes moving files easier
- improves readability

## Environment Variables

Frontend API base:

```text
VITE_API_BASE_URL
```

Fallback:

```text
http://localhost:5082
```

AI/chat endpoint:

```text
VITE_AI_API_URL
```

Vite requires client-exposed environment variables to use the `VITE_` prefix.

## Error Handling

Layers:

1. `ErrorBoundary` for render errors.
2. Axios interceptor for auth/401 failures.
3. API function error propagation.
4. Page-level toast messages.
5. Inline form validation messages.

Why this layered approach is used:

- render crashes are different from API failures
- auth failures require global behavior
- form validation belongs near the form
- mutation errors should be visible immediately

## File-by-File Responsibility Summary

### Entrypoints

- `src/main.tsx`: mounts React, sets providers.
- `src/App.tsx`: route tree, app-level wrappers, toaster placement.
- `src/index.css`: global CSS, Tailwind imports, utilities.

### Layout and Shell

- `src/components/Layout.tsx`: public page shell.
- `src/components/Navbar.tsx`: public navigation.
- `src/components/Footer.tsx`: public footer.
- `src/pages/(admin)/AdminLayout.tsx`: admin dashboard shell.
- `src/pages/(seller)/SellerLayout.tsx`: seller dashboard shell.

### Auth

- `src/context/AuthContext.tsx`: global auth user state.
- `src/components/PrivateRoute.tsx`: protected routes.
- `src/components/GuestRoute.tsx`: guest-only routes.
- `src/lib/authApi.ts`: auth/profile endpoint functions.
- `src/lib/authSignal.ts`: decoupled auth failure handling.

### API

- `src/lib/api.ts`: shared Axios client.
- `src/lib/listingsApi.ts`: listing lifecycle.
- `src/lib/adminApi.ts`: admin moderation.
- `src/lib/makesApi.ts`: makes.
- `src/lib/modelsApi.ts`: models.
- `src/lib/lookupsApi.ts`: lookup values.
- `src/lib/conditionChecklistCategoriesApi.ts`: condition categories.
- `src/lib/conditionDefectsApi.ts`: condition defects.

### Localization

- `src/lib/i18n/config.ts`: i18n setup.
- `src/locales/en/translation.json`: English UI strings.
- `src/locales/ar/translation.json`: Arabic UI strings.
- `src/components/LanguageSwitcher.tsx`: language switch UI.
- `src/hooks/useI18n.ts`: i18n utility hook.

### Product Pages

- `src/pages/(public)/home.tsx`: landing page.
- `src/pages/(public)/about.tsx`: about page.
- `src/pages/(public)/contact.tsx`: contact page.
- `src/pages/(auth)/login.tsx`: login.
- `src/pages/(auth)/signup.tsx`: registration.
- `src/pages/(auth)/onboarding.tsx`: favorite make onboarding.
- `src/pages/(buyer)/feed.tsx`: buyer feed.
- `src/pages/(buyer)/car-details.tsx`: listing details.
- `src/pages/(buyer)/profile.tsx`: user profile.
- `src/pages/(seller)/add-listing.tsx`: seller listing creation.
- `src/pages/(seller)/listings.tsx`: seller listings.
- `src/pages/(seller)/analytics.tsx`: seller analytics.
- `src/pages/(admin)/cars-pending.tsx`: admin pending listing review.
- `src/pages/(admin)/makes.tsx`: admin make management.
- `src/pages/(admin)/models.tsx`: admin model management.
- `src/pages/(admin)/conditions.tsx`: admin condition library.
- `src/pages/(admin)/analytics.tsx`: admin analytics.
- `src/pages/(admin)/users-pending.tsx`: pending users.

## Why This Architecture Was Chosen

### 1. Role-Based Routes Match the Product

The product has different experiences for public visitors, buyers, sellers, and admins. Grouping routes by role makes ownership clear and keeps authorization close to routing.

### 2. API Clients Are Domain-Based

Each backend domain gets a matching frontend API file. This keeps endpoint knowledge out of components and makes backend contract changes easier to update.

### 3. Auth Uses HttpOnly Cookies

Keeping tokens in HttpOnly cookies reduces token exposure in browser JavaScript. The frontend only manages user identity state and lets the backend manage token storage.

### 4. Context Is Used Only Where Needed

Auth is global, so it uses context. Most other state is page-local because it belongs to a single flow or screen. This avoids unnecessary global complexity.

### 5. Design System First

Using `@gp/design-system` keeps pages consistent and reduces duplicated UI logic. It also makes the app easier to polish because shared components carry consistent variants and spacing.

### 6. Lazy Loading Protects Initial Load

Route pages and the chatbot are lazy-loaded because users do not need every dashboard/page/chat feature on first paint.

### 7. i18n and RTL Are First-Class

Arabic support affects more than strings. It affects direction, layout, typography, toast placement, and data formatting. The architecture centralizes language direction and keeps page-level RTL adjustments explicit.

### 8. Vite Keeps Development Fast

Vite gives fast dev server startup and modern production builds. Manual chunking improves caching and separates vendor code from app code.

### 9. Manual Page Fetching Was Chosen for Simplicity

Most screens use explicit `useEffect` fetching because the data flows are straightforward. React Query is already installed for future shared/cached server state where it will provide more value.

## Known Gaps and Future Improvements

### Move Repeated Queries to React Query

Good candidates:

- profile
- makes
- models
- lookups
- condition categories
- condition defects

Why:

- fewer duplicate requests
- automatic cache reuse
- better loading/error consistency

### Replace Mock Data with API-Backed Pagination

Mock-heavy pages should eventually use real paginated endpoints.

Good candidates:

- buyer feed
- buyer car details
- seller listings
- analytics pages
- pending users

Why:

- smaller production bundle
- real data behavior
- scalable filtering/sorting

### Add Automated Tests

Currently there is no clear frontend test suite.

Recommended:

- unit tests for helpers and API mapping
- component tests for forms and guards
- integration tests for auth and listing creation flows

### Standardize Form Handling

Manual validation works today, but larger forms may benefit from:

- `react-hook-form`
- a schema validator
- shared validation helpers

### Continue Performance Work

Future improvements:

- reduce global Framer Motion usage in always-mounted components
- move mock/demo data behind dev-only imports
- centralize cached catalog data
- add bundle analysis for production builds

## Development Guidelines

### When Adding a New Page

1. Put the page under the correct route group in `src/pages`.
2. Lazy-load it in `App.tsx`.
3. Add route protection if needed.
4. Use `@gp/design-system` components first.
5. Add translations in both English and Arabic.
6. Use logical CSS or RTL-aware classes if layout direction matters.
7. Put backend calls in `src/lib/*Api.ts`, not directly in the page.

### When Adding a New API Endpoint

1. Add request/response DTO types beside the API function.
2. Map frontend camelCase inputs to backend payload shape.
3. Return the backend response envelope.
4. Keep comments that identify the backend route.
5. Handle expected non-2xx responses only when the UI must read the backend message.

### When Adding Shared UI

1. Prefer `@gp/design-system`.
2. If a local component is needed, place it in `src/components`.
3. If it is a primitive wrapper, place it in `src/lib/ui`.
4. Keep visible strings translated.
5. Support RTL if the component has direction-sensitive layout.

### When Adding Translations

1. Add keys to `src/locales/en/translation.json`.
2. Add matching keys to `src/locales/ar/translation.json`.
3. Use `t("key.path")` in components.
4. Avoid hardcoded visible strings unless temporary.

## Summary

The frontend architecture is a role-based React SPA with:

- Vite for fast development and production bundling
- React Router for route ownership
- lazy-loaded pages for smaller initial load
- cookie-backed auth with refresh handling
- typed domain API clients
- a shared design system
- bilingual English/Arabic support
- explicit page-level state and forms
- a path for future React Query adoption

This architecture was chosen because it fits the product boundaries: public browsing, authenticated buyer/profile flows, seller listing creation, and admin management. It keeps backend integration typed and isolated, keeps UI consistent through the design system, and supports Arabic/RTL as a core requirement rather than an afterthought.
