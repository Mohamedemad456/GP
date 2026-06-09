# Design System Architecture & Documentation
**Graduation Project Technical Report**

---

## 1. Executive Summary

The `@gp/design-system` is a centralized, reusable UI component library engineered to serve as the visual and interactive foundation for all front-end applications within this project's ecosystem. Built to enterprise standards, it ensures UI consistency, accelerates development, and guarantees accessibility across the platform.

Rather than relying on rigid, pre-packaged component libraries, this design system adopts a modern "ownership" model. By leveraging **shadcn/ui** and **Radix UI**, it provides high-quality, accessible primitives while allowing complete control over the source code and styling.

---

## 2. Problem Statement & Objectives

In modern web development, particularly in large-scale applications like this graduation project, managing UI consistency across multiple interfaces (e.g., user portals, admin dashboards) becomes a significant challenge. 

**The objectives of building this custom design system are:**
1. **Consistency**: Maintain a single source of truth for design tokens (colors, typography, spacing).
2. **Reusability**: Write components once and reuse them across the monorepo, reducing code duplication.
3. **Customizability**: Ensure components can be easily adapted to specific business logic without fighting a third-party library's constraints.
4. **Accessibility (a11y)**: Guarantee that all interactive elements are usable by people with disabilities (keyboard navigation, screen readers).

---

## 3. Technology Stack Selection

The design system is constructed using a modern, scalable technology stack:

### 3.1. React & TypeScript
- **React**: Provides the component-based architecture necessary for building reusable UI pieces.
- **TypeScript**: Ensures type safety, providing excellent developer experience (DX) through autocomplete and compile-time error checking.

### 3.2. Tailwind CSS v4
- **Utility-First Styling**: Allows rapid styling directly within the component markup.
- **Performance**: Tailwind's compiler ensures that only the CSS actually used is shipped to production, resulting in highly optimized bundles.

### 3.3. Radix UI (Headless UI)
- Radix provides "headless" components—UI components that contain all the necessary state logic and accessibility features (WAI-ARIA compliance) but zero styling. This offloads the complex engineering of things like focus trapping, keyboard navigation, and popover positioning.

### 3.4. Shadcn/ui (The Ownership Model)
- Unlike MUI or Bootstrap, shadcn/ui is not installed as an NPM dependency. Instead, it generates the component's source code directly into the workspace (`src/components`). This means the project *owns* the code, allowing infinite customization without the constraints of overriding complex third-party CSS.

### 3.5. Storybook
- An industry-standard tool used for UI component development and testing in isolation. It serves as an interactive catalog for developers to view all available components without needing to run the main applications.

---

## 4. Architectural Design

### 4.1. Theming Engine & Design Tokens
The visual identity of the project is governed by a token-based theming engine located in `src/styles/tokens.css`. 
- **CSS Variables**: Colors, radii, and spacing are defined as CSS variables (e.g., `--primary`, `--radius`).
- **Tailwind Integration**: These variables are mapped to Tailwind classes via `@tailwindcss/vite`, allowing developers to use utility classes like `bg-primary` or `rounded-md` that dynamically adapt based on the theme.
- **Dark Mode Support**: The variables seamlessly switch values when a dark mode class is applied, providing an automated dark mode experience across all applications.

### 4.2. Utility Functions (`cn`)
To handle dynamic class names without conflicts, the system uses a custom utility function:
```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```
This elegantly resolves Tailwind class conflicts (e.g., ensuring `px-4` overrides `p-2` when applied together) and is a cornerstone of the system's flexibility.

### 4.3. Monorepo Integration
As a package within the monorepo (`@gp/design-system`), it is exported via `src/index.ts`. Consuming applications (like the frontend web app) import it seamlessly as a local workspace dependency, ensuring that updates to the design system immediately reflect across the entire platform.

---

## 5. Component Library Detail

The library includes a wide array of components structured for different use cases:

- **Foundation & Layout**: 
  - `Card`, `ScrollArea`, `Separator`, `Sidebar`
  - *Purpose*: Construct the structural skeleton of the application interfaces.
- **Form Controls & Inputs**: 
  - `Button`, `Input`, `Textarea`, `Select`, `Combobox`, `Label`
  - *Purpose*: Handle user data entry with built-in focus states and validation styling.
- **Data Display**: 
  - `Table`, `Chart`, `Avatar`, `Badge`, `Carousel`, `ImageCarousel`
  - *Purpose*: Present complex data and media in an organized, digestible format.
- **Feedback & Overlays**: 
  - `Dialog` (Modals), `Sheet` (Drawers), `Popover`, `Tooltip`, `Skeleton` (Loading states), `PageLoader`
  - *Purpose*: Provide contextual information and guide the user through asynchronous processes.

---

## 6. Accessibility & User Experience

Accessibility is treated as a first-class citizen in this project, primarily achieved through Radix UI primitives:
- **Keyboard Navigation**: All components support standard keyboard interactions (e.g., `Esc` to close modals, arrow keys for dropdowns).
- **ARIA Attributes**: Screen readers are supported automatically through dynamically injected `aria-*` attributes.
- **Focus Management**: Focus is intelligently trapped within modals (`Dialog`, `Sheet`) to prevent users from interacting with the background while an overlay is active.

---

## 7. Development & Workflow

### 7.1. Component Driven Development
Components are built in isolation using **Storybook**. Developers can run `npm run storybook` or `docker compose up design-system-storybook` to launch the interactive environment. Each component is accompanied by a `.stories.tsx` file demonstrating its various states (default, disabled, variants).

### 7.2. Adding New Components
The system is designed to scale. When a new UI requirement arises, developers use the Shadcn CLI:
```bash
npx shadcn@latest add [component-name]
```
This automatically scaffolds the necessary files, which are then customized and exported for platform-wide use.

---

## 8. Conclusion

The `@gp/design-system` represents a robust, scalable, and modern approach to UI engineering. By decoupling the UI logic from the business logic of the main applications, it drastically reduces technical debt. Furthermore, the adoption of an ownership model ensures that the project remains completely independent of restrictive third-party UI framework limitations, which is highly beneficial for the long-term maintainability of this graduation project.
