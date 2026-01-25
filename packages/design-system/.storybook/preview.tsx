import type { Preview } from "@storybook/react"
import "./storybook.css"

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: "light",
      values: [
        { name: "light", value: "oklch(0.98 0.01 70)" },
        { name: "dark", value: "oklch(0.15 0.01 70)" },
      ],
    },
  },
  globalTypes: {
    theme: {
      name: "Theme",
      description: "Global theme for components",
      defaultValue: "light",
      toolbar: {
        icon: "circlehollow",
        items: ["light", "dark"],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals?.theme ?? "light"
      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("dark", theme === "dark")
      }
      return <Story />
    },
  ],
}

export default preview
