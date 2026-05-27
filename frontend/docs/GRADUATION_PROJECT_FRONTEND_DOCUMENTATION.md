# Graduation Project Frontend Documentation

## Project Name

Karna frontend.

## Purpose

The frontend is the user-facing application for the Karna graduation project. It provides the interface for browsing cars, creating listings, managing listings as a seller, moderating platform data as an admin, and interacting with supporting features such as authentication, localization, dashboards, and AI chat.

The frontend is built as a modern React single-page application. It communicates with the backend APIs, uses a shared design system for consistent UI, supports English and Arabic, and separates user experiences by role.

## Frontend Scope

The frontend covers these main areas:

- Public website pages.
- Authentication pages.
- Buyer browsing and profile pages.
- Seller dashboard and listing creation workflow.
- Admin dashboard and data-management workflow.
- Bilingual English/Arabic user interface.
- RTL support for Arabic.
- Backend API integration.
- Shared design system usage.
- Frontend documentation and reusable project conventions.

## Main Users

### Public Visitor

A public visitor can:

- Visit the home page.
- Read about the platform.
- Use the contact page.
- Open login/signup pages.
- Open onboarding.

### Buyer or Normal User

A logged-in normal user can:

- View profile.
- Browse feed pages.
- View car details.
- Use seller routes if the user is acting as a seller.

### Seller

A seller can:

- Open seller dashboard.
- Create a listing through a multi-step wizard.
- Add vehicle details.
- Add condition checklist defects.
- Upload listing photos.
- Generate an ML price suggestion.
- Submit the listing for admin review.

### Admin

An admin can:

- Open admin dashboard.
- Review pending car listings.
- Approve or reject listings.
- Manage car makes.
- Manage car models.
- Manage condition checklist categories.
- Manage condition defects.

## Technology Stack

### React

React is used as the UI library. It allows the frontend to be built from reusable components and supports dynamic user interaction without full page reloads.

### TypeScript

TypeScript is used to make frontend code safer and easier to maintain. API responses, request DTOs, form states, and component props are typed.

Why TypeScript was chosen:

- It catches many mistakes before runtime.
- It makes backend/frontend contracts easier to understand.
- It improves autocomplete and developer experience.
- It documents expected data shapes in code.

### Vite

Vite is used for frontend development and production builds.

Why Vite was chosen:

- Fast dev server startup.
- Fast hot reload during development.
- Modern bundling.
- Simple configuration.
- Good TypeScript and React support.

### React Router

React Router is used for client-side routing.

Why React Router was chosen:

- The project is a single-page application.
- Routes can be nested.
- Route guards can protect groups of pages.
- Role-based dashboards are easy to model.

### Axios

Axios is used for API communication.

Why Axios was chosen:

- Simple request/response API.
- Supports interceptors.
- Works well with cookies and `withCredentials`.
- Makes refresh-token retry logic straightforward.

### i18next

i18next and react-i18next are used for translations.

Why i18next was chosen:

- Strong React support.
- Language detection support.
- Namespace support.
- Works well with runtime switching between English and Arabic.

### Tailwind CSS

Tailwind CSS v4 is used for styling.

Why Tailwind was chosen:

- Fast UI development.
- Consistent spacing/color/typography utilities.
- Works well with design tokens.
- Reduces the need for many separate CSS files.

### Design System

The project uses a local design system package:

```text
packages/design-system
```

Imported in frontend as:

```ts
import { Button, Card, Table } from "@gp/design-system";
```

The design system is one of the most important frontend decisions because it keeps the platform visually consistent across public, seller, buyer, and admin screens.

## Project Structure

Frontend root:

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
  skills.md
```

Source folder:

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

## Folder Details

### `src/main.tsx`

This is the frontend entry point.

Responsibilities:

- Creates the React root.
- Wraps the app in `StrictMode`.
- Adds `QueryClientProvider`.
- Adds `BrowserRouter`.
- Imports global CSS.
- Imports i18n configuration.
- Renders `App`.

Important providers:

- `QueryClientProvider`
- `BrowserRouter`

The Query Client is configured with:

- 5 minute stale time.
- 10 minute garbage collection time.
- no refetch on window focus.
- one retry.
- no refetch on mount.

This configuration reduces unnecessary network calls and prepares the app for future React Query usage.

### `src/App.tsx`

This is the main application shell and route definition file.

Responsibilities:

- Defines all routes.
- Lazy-loads pages.
- Wraps app in `ErrorBoundary`.
- Wraps app in `AuthProvider`.
- Uses `Suspense` with a page loader.
- Renders global toast notifications.
- Sets toast position depending on language direction.

Why page lazy loading is used:

- The user does not need all pages immediately.
- Admin, seller, buyer, and public pages can be split into separate chunks.
- Initial load becomes smaller.
- Browser downloads page code only when needed.

### `src/index.css`

This file imports:

- Google fonts.
- Tailwind.
- design-system source scanning.
- design-system styles.

It also defines local utility classes:

- `hero-gradient`
- `noise`
- `glass`
- `shadow-elevated`

Why these utilities exist:

- Some visual patterns are reused across pages.
- They keep repeated design treatments consistent.
- They avoid rewriting long background/shadow class combinations.

### `src/pages`

The pages folder is grouped by user role and product area.

```text
src/pages/
  (public)/
  (auth)/
  (buyer)/
  (seller)/
  (admin)/
```

This grouping makes the project easier to understand because every page belongs to a clear product area.

### `src/components`

Shared components used across pages.

Important files:

- `Layout.tsx`
- `Navbar.tsx`
- `Footer.tsx`
- `PrivateRoute.tsx`
- `GuestRoute.tsx`
- `LanguageSwitcher.tsx`
- `ChatbotSheet.tsx`
- `ErrorBoundary.tsx`
- `onboarding/FavoriteModelsSlide.tsx`

### `src/context`

Contains global React context.

Current main file:

- `AuthContext.tsx`

This stores the authenticated user and loading state.

### `src/lib`

Contains API clients, utilities, i18n setup, and local UI wrappers.

Important files:

- `api.ts`
- `authApi.ts`
- `adminApi.ts`
- `listingsApi.ts`
- `makesApi.ts`
- `modelsApi.ts`
- `lookupsApi.ts`
- `conditionChecklistCategoriesApi.ts`
- `conditionDefectsApi.ts`
- `authSignal.ts`
- `formatMarkdown.tsx`
- `utils.ts`
- `i18n/config.ts`
- `ui/*`

### `src/locales`

Contains translation files.

```text
src/locales/
  en/
    common.json
    translation.json
  ar/
    common.json
    translation.json
```

The app supports English and Arabic.

### `src/hooks`

Shared hooks.

Important files:

- `use-toast.ts`
- `useI18n.ts`

### `src/data/mocks`

Contains mock data used by prototype/demo screens.

Important files:

- `cars.ts`
- `listings.ts`

These files are used where backend endpoints are not fully integrated yet.

### `src/types`

Contains shared frontend-only types.

API-specific DTO types usually live beside their API functions in `src/lib`.

## Routing Details

Routes are defined in `src/App.tsx`.

### Public Routes

```text
/          -> home
/about     -> about
/contact   -> contact
```

These use `Layout.tsx`, which includes:

- Navbar.
- Page outlet.
- Footer.
- Lazy-loaded chatbot.

### Guest Routes

```text
/login
/signup
```

These use `GuestRoute`.

If the user is already authenticated, the guest pages should not be shown.

### Onboarding Route

```text
/onboarding
```

This route lets users select favorite car makes. It loads active makes from the backend and passes them to the onboarding component.

### Buyer Routes

```text
/profile
/feed
/cars/:id
```

These are protected by `PrivateRoute`.

### Admin Routes

```text
/admin
/admin/users-pending
/admin/cars-pending
/admin/makes
/admin/models
/admin/conditions
```

These are protected by:

```tsx
<PrivateRoute allowedRoles={["admin"]} />
```

### Seller Routes

```text
/seller
/seller/listings
/seller/add-listing
```

These are protected by:

```tsx
<PrivateRoute allowedRoles={["user"]} />
```

## Authentication and Session Management

Important files:

```text
src/context/AuthContext.tsx
src/lib/api.ts
src/lib/authApi.ts
src/lib/authSignal.ts
src/components/PrivateRoute.tsx
src/components/GuestRoute.tsx
```

### Authentication Strategy

The backend uses HttpOnly cookies for tokens.

The frontend does not store access tokens manually.

Why this is important:

- HttpOnly cookies are not readable by frontend JavaScript.
- This reduces token exposure risk.
- The browser sends cookies automatically when `withCredentials` is enabled.

### Auth Context

`AuthContext.tsx` stores:

- `user`
- `isLoading`
- `setUser`
- `clearUser`

When the app loads, it calls `getProfile()` to check whether the user already has a valid backend session.

### Axios Refresh Flow

`src/lib/api.ts` owns the shared Axios instance.

It uses:

```ts
withCredentials: true
```

When a request returns `401`:

1. The interceptor checks that the request has not already retried.
2. It calls `POST /api/auth/refresh-cookie`.
3. If refresh succeeds, it retries the original request.
4. If many requests fail at once, they wait in a queue.
5. If refresh fails, it clears the auth user and redirects to `/login`.

Why this was chosen:

- Users do not get logged out immediately when an access cookie expires.
- Only one refresh request happens at a time.
- Auth failure behavior is centralized.

## API Integration

The frontend uses domain-specific API client files in `src/lib`.

This pattern keeps backend endpoint details out of React components.

### API Client Pattern

Example:

```ts
export const getAllMakes = (params?: MakeSpecParams) =>
  api
    .get<ApiResponse<PaginatedResponse<MakeDto>>>("/api/Makes/All", { params })
    .then((r) => r.data);
```

Benefits:

- DTO types are close to endpoint functions.
- UI components stay focused on UI.
- Backend payload casing is handled in one place.
- Endpoint comments document backend contracts.

### API Files

#### `api.ts`

Shared Axios configuration.

Handles:

- base URL
- cookies
- Accept-Language header
- refresh-cookie retry
- auth failure redirect

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
- all makes for admin
- create make
- update make
- activate make
- deactivate make
- delete make
- logo URL formatting

#### `modelsApi.ts`

Handles:

- active models
- all models for admin
- make filtering
- create model
- update model
- activate/deactivate/delete

#### `conditionChecklistCategoriesApi.ts`

Handles:

- active condition checklist categories
- admin category management
- bilingual English/Arabic merge for admin pages

#### `conditionDefectsApi.ts`

Handles:

- active condition defects
- admin defect management
- category filtering
- bilingual English/Arabic merge for admin pages

#### `listingsApi.ts`

Handles:

- create listing
- update listing
- add condition checklist
- upload photos
- submit listing
- approve listing
- reject listing
- mark listing as sold
- status history
- delete listing
- generate price
- set price

#### `adminApi.ts`

Handles admin-specific endpoints:

- pending listings
- pagination
- make/model/seller/date filters

#### `lookupsApi.ts`

Handles lookup endpoints:

- fuel types
- transmission types
- listing statuses
- locations

## Design System

The project has a dedicated local design system package:

```text
packages/design-system
```

The frontend consumes it through:

```json
"@gp/design-system": "file:../packages/design-system"
```

### Why A Design System Was Used

The application has many different areas:

- public pages
- auth pages
- buyer pages
- seller dashboard
- admin dashboard
- forms
- tables
- dialogs
- filters
- pagination
- cards

Without a design system, each page could easily become visually inconsistent.

The design system was chosen to:

- standardize colors
- standardize spacing
- standardize typography
- standardize component variants
- improve UI consistency
- speed up page development
- reduce duplicated component code
- make the project look more professional for graduation presentation

### Design System Package Structure

```text
packages/design-system/
  src/
    components/
    hooks/
    lib/
    styles/
    utils/
    index.ts
  styles.css
  package.json
  README.md
  components.json
```

### Design System Exports

The package exports components from:

```text
packages/design-system/src/components/index.ts
```

Main exported components include:

- `Button`
- `Input`
- `Textarea`
- `Separator`
- `Card`
- `Badge`
- `Label`
- `Dialog`
- `Skeleton`
- `ChartContainer`
- `Table`
- `Select`
- `Sidebar`
- `PageLoader`
- `ImageCarousel`
- `DropdownMenu`
- `Carousel`
- `Pagination`
- `PaginationBar`
- `Popover`
- `ScrollArea`
- `Tooltip`
- `Avatar`
- `Combobox`
- `Sheet`

The package also exports:

- `cn`
- component variants such as `buttonVariants` and `badgeVariants`

### Design Tokens

Design tokens live in:

```text
packages/design-system/src/styles/tokens.css
```

Token categories:

- colors
- typography
- spacing
- radius
- shadows
- motion timing
- sidebar colors
- chart colors
- dark mode values
- Arabic font overrides

Important color tokens:

- `--background`
- `--foreground`
- `--card`
- `--card-foreground`
- `--popover`
- `--popover-foreground`
- `--primary`
- `--primary-foreground`
- `--secondary`
- `--secondary-foreground`
- `--muted`
- `--muted-foreground`
- `--accent`
- `--accent-foreground`
- `--destructive`
- `--success`
- `--warning`
- `--info`
- `--border`
- `--input`
- `--ring`

Typography tokens:

- `--font-sans`
- `--font-heading`
- `--font-mono`

Spacing tokens:

- `--space-1`
- `--space-2`
- `--space-3`
- `--space-4`
- `--space-5`
- `--space-6`
- `--space-7`
- `--space-8`

Shadow tokens:

- `--shadow-xs`
- `--shadow-sm`
- `--shadow-md`
- `--shadow-lg`

Motion tokens:

- `--duration-fast`
- `--duration-normal`
- `--duration-slow`
- `--ease-standard`
- `--ease-emphasized`

### Tailwind Token Mapping

The design system maps CSS variables into Tailwind theme values using:

```css
@theme inline
```

This makes classes like these available:

```text
bg-background
text-foreground
bg-card
text-muted-foreground
bg-primary
text-primary-foreground
border-border
ring-ring
```

Why this is important:

- Components can use readable token-based utility classes.
- Color changes can happen centrally in tokens.
- The UI remains consistent across the whole frontend.

### Dark Mode Support

The token file includes a `.dark` section.

This means the design system has dark-mode-ready tokens even if every page does not yet expose a theme toggle.

### Arabic Font Support

The design system changes font tokens when the HTML language is Arabic:

```css
html[lang="ar"] {
  --font-sans: "Tajawal", "Inter", system-ui, ...;
  --font-heading: "Tajawal", "Inter", system-ui, ...;
}
```

Why this matters:

- Arabic text needs an Arabic-friendly font.
- The same components can adapt automatically when language changes.
- This keeps Arabic UI quality close to English UI quality.

### Storybook

The design system has Storybook support.

Scripts:

```bash
npm run storybook
npm run build-storybook
```

Why Storybook is useful:

- Components can be tested in isolation.
- Variants can be demonstrated.
- Developers can review UI without opening the whole app.
- It is useful for a graduation presentation to show component-level organization.

### Component Stories

Story files exist for many components:

- `Button.stories.tsx`
- `Badge.stories.tsx`
- `Card.stories.tsx`
- `Table.stories.tsx`
- `Select.stories.tsx`
- `Dialog.stories.tsx`
- `Combobox.stories.tsx`
- `Pagination.stories.tsx`
- `Sidebar.stories.tsx`
- `Chart.stories.tsx`
- `ImageCarousel.stories.tsx`

### Shadcn-Style Architecture

The design system follows shadcn-style patterns:

- components are source-controlled
- components are editable
- Radix primitives are used where needed
- variants use class-variance-authority
- class merging uses `clsx` and `tailwind-merge`

Why this approach is good:

- It gives full ownership of component code.
- It avoids being locked into a black-box UI library.
- It keeps accessibility primitives through Radix.
- It allows styling to match the project brand.

### How The Frontend Imports The Design System

In `src/index.css`:

```css
@source "../../packages/design-system/src";
@import "@gp/design-system/styles.css";
```

Why:

- Tailwind scans design-system source classes.
- Design-system tokens/styles become available in the frontend.

In components:

```ts
import { Button, Dialog, Table } from "@gp/design-system";
```

Why:

- Shared components stay consistent.
- Pages avoid re-implementing UI primitives.

## Styling Standards

### Preferred Styling

Use:

- design-system components
- Tailwind classes
- design tokens
- logical RTL-aware classes
- `cn()` for conditional class names

Avoid:

- hardcoded colors
- duplicate CSS files for one-off styling
- English-only layouts
- custom components when design-system components already exist

### Visual Direction

The UI style is:

- clean
- modern
- card-based
- rounded
- spacious
- token-driven
- bilingual
- dashboard-friendly

Common visual patterns:

- rounded cards
- muted backgrounds
- subtle borders
- token-based shadows
- icon badges
- table headers with uppercase labels
- filter bars
- skeleton loading states
- empty-state illustrations through icons

## Internationalization

The frontend supports:

- English
- Arabic

Main files:

```text
src/lib/i18n/config.ts
src/locales/en/translation.json
src/locales/ar/translation.json
src/components/LanguageSwitcher.tsx
```

Language detection order:

1. localStorage
2. browser navigator
3. HTML tag

The selected language is cached in:

```text
i18nextLng
```

Arabic behavior:

- sets `dir="rtl"`
- sets `lang="ar"`
- changes font through design-system tokens
- adjusts sidebar direction where needed
- changes toast position
- uses Arabic translations

Why bilingual support is important:

- The target users may use either Arabic or English.
- Admin data includes English and Arabic values.
- Arabic support is not only text translation; layout direction and typography matter too.

## Main Frontend Workflows

### Authentication Workflow

Files:

- `src/pages/(auth)/login.tsx`
- `src/pages/(auth)/signup.tsx`
- `src/context/AuthContext.tsx`
- `src/lib/authApi.ts`

Flow:

1. User submits login or signup form.
2. Frontend calls auth API.
3. Backend sets HttpOnly cookies.
4. Frontend loads profile.
5. Auth context stores user identity and role.
6. User is redirected based on role.

### Seller Listing Creation Workflow

File:

```text
src/pages/(seller)/add-listing.tsx
```

Flow:

1. Seller enters vehicle details.
2. Frontend validates required fields.
3. Frontend creates listing.
4. Seller selects condition defects.
5. Frontend submits checklist.
6. Seller uploads photos.
7. Frontend uploads photos.
8. Frontend calls generate-price endpoint.
9. Frontend submits listing for review.
10. Admin can later approve or reject.

Why multi-step:

- The backend requires a listing ID before attaching checklist/photos.
- Each step has different validation.
- Sellers get a clear progress path.
- Errors can be shown at the correct step.

### Admin Car Review Workflow

File:

```text
src/pages/(admin)/cars-pending.tsx
```

Flow:

1. Admin opens pending cars.
2. Frontend requests paginated pending listings.
3. Admin filters by make, model, seller, or date.
4. Admin reviews listing data.
5. Admin approves or rejects.
6. UI refetches list after action.

### Admin Makes Workflow

File:

```text
src/pages/(admin)/makes.tsx
```

Features:

- server-side pagination
- search
- status filter
- sorting
- create
- update
- activate/deactivate
- delete
- icon upload

### Admin Models Workflow

File:

```text
src/pages/(admin)/models.tsx
```

Features:

- server-side pagination
- search
- status filter
- make filter
- sorting
- create
- update
- activate/deactivate
- delete

### Admin Conditions Workflow

File:

```text
src/pages/(admin)/conditions.tsx
```

Features:

- categories table
- defects table
- bilingual English/Arabic fields
- search
- filters
- sorting
- pagination
- create/edit/delete
- activate/deactivate

Why bilingual merge is used:

- Backend can return localized names depending on Accept-Language.
- Admin needs to manage both English and Arabic together.
- API clients fetch both language versions and merge by ID.

## Performance Choices

### Route-Level Lazy Loading

All major pages are lazy-loaded in `App.tsx`.

Why:

- smaller initial JavaScript
- faster first load
- role pages are loaded only when visited

### Lazy Chatbot

`ChatbotSheet` is lazy-loaded in `Layout.tsx`.

Why:

- chatbot is not needed for initial page render
- it keeps the public layout lighter

### Memoized Formatters

Admin table pages memoize:

- `Intl.NumberFormat`
- `Intl.DateTimeFormat`

Why:

- creating formatters repeatedly during table renders is expensive
- memoization improves render performance

### Parallel Page Fetching

Some catalog loaders fetch the first page to get total count, then load remaining pages in parallel.

Why:

- backend page size may be capped
- parallel requests reduce total waiting time

### Object URL Cleanup

Image preview URLs are revoked.

Why:

- `URL.createObjectURL` can retain memory
- revoking previews prevents memory leaks

## Build and Bundling

`vite.config.ts` defines:

- React plugin.
- Tailwind plugin.
- `@` alias for `src`.
- React dedupe.
- design-system optimize dependency rules.
- manual chunks.

Manual chunks:

- `react-vendor`
- `ui-vendor`
- `i18n-vendor`
- `query-vendor`

Why:

- vendor code can be cached separately
- app chunks are smaller
- route lazy loading works better with separated vendor dependencies

## Testing and Quality Status

Current scripts:

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run preview`

Current status:

- ESLint exists.
- TypeScript config exists.
- Storybook exists for the design system.
- No full frontend automated test suite is currently documented.

Recommended future testing:

- component tests for forms and route guards
- API-client mapping tests
- integration tests for listing creation
- admin CRUD flow tests
- RTL rendering checks

## Known Prototype Areas

Some pages still use mock/demo data.

Examples:

- buyer feed
- buyer car details
- seller listings
- analytics pages
- pending users

Why:

- UI was built before every backend endpoint was complete.
- Mock data helps demonstrate design and user flow.

Future improvement:

- replace mock data with paginated backend endpoints
- remove large mock data from production-critical bundles

## Why This Frontend Architecture Fits The Graduation Project

### Clear Role Separation

The project has buyers, sellers, admins, and public visitors. The route structure mirrors these roles, which makes the frontend easy to explain and maintain.

### Strong API Boundary

API clients keep backend communication separate from UI components. This makes the project easier to debug and present.

### Professional UI Through Design System

The design system gives the project a consistent product identity. It also shows that the frontend was built with maintainability and scalability in mind.

### Bilingual Support

English and Arabic support are core project requirements. The frontend handles not only translations, but also RTL direction, Arabic typography, and localized formatting.

### Secure Session Strategy

HttpOnly-cookie authentication avoids exposing tokens in JavaScript. This is a better security story for a graduation project than storing tokens in localStorage.

### Scalable Admin and Seller Workflows

Admin and seller areas are built as dashboard modules. This makes it easy to add more management pages later.

### Performance-Aware Frontend

The app uses lazy loading, memoization, vendor chunking, and cleanup patterns. These are practical performance choices for a real SPA.

## Future Improvements

Recommended next steps:

- move repeated server data to React Query
- replace remaining mock pages with backend endpoints
- add automated frontend tests
- add bundle analysis
- add more Storybook examples for project-specific composed UI
- improve analytics pages with real data
- standardize form validation with shared helpers if forms grow
- document admin and seller workflows with screenshots

## Conclusion

The Karna frontend is a role-based React SPA designed for a real product workflow. It uses a typed API layer, secure cookie-based authentication, a reusable design system, bilingual English/Arabic support, and dashboard-style layouts for seller and admin users.

The architecture was chosen to keep the project understandable, scalable, and professional enough for a graduation project presentation. The design system is especially important because it turns separate pages into one consistent product experience.
