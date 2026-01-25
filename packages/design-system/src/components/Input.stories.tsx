import type { Meta, StoryObj } from "@storybook/react"
import { Input } from "./input"

const meta: Meta<typeof Input> = {
  title: "Design System/Input",
  component: Input,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    type: {
      control: "select",
      options: ["text", "email", "password", "number", "search"],
      description: "Input type",
    },
    placeholder: {
      control: "text",
      description: "Placeholder text",
    },
    disabled: {
      control: "boolean",
      description: "Disabled state",
    },
  },
}

export default meta

type Story = StoryObj<typeof Input>

export const Default: Story = {
  args: {
    placeholder: "Enter text...",
    type: "text",
  },
}

export const WithValue: Story = {
  args: {
    defaultValue: "Hello",
    placeholder: "Enter text...",
  },
}

export const Email: Story = {
  args: {
    type: "email",
    placeholder: "you@example.com",
  },
}

export const Password: Story = {
  args: {
    type: "password",
    placeholder: "••••••••",
  },
}

export const Disabled: Story = {
  args: {
    placeholder: "Disabled",
    disabled: true,
  },
}

export const Invalid: Story = {
  args: {
    placeholder: "Invalid input",
    "aria-invalid": true,
    defaultValue: "invalid",
  },
}
