import type { Meta, StoryObj } from "@storybook/react"
import { Textarea } from "./textarea"

const meta: Meta<typeof Textarea> = {
  title: "Design System/Textarea",
  component: Textarea,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    placeholder: {
      control: "text",
      description: "Placeholder text",
    },
    disabled: {
      control: "boolean",
      description: "Disabled state",
    },
    rows: {
      control: "number",
      description: "Number of rows",
    },
  },
}

export default meta

type Story = StoryObj<typeof Textarea>

export const Default: Story = {
  args: {
    placeholder: "Enter your message...",
    rows: 4,
  },
}

export const WithValue: Story = {
  args: {
    defaultValue: "This is a sample message",
    placeholder: "Enter your message...",
    rows: 4,
  },
}

export const Disabled: Story = {
  args: {
    placeholder: "Disabled textarea",
    disabled: true,
    rows: 4,
  },
}

export const Invalid: Story = {
  args: {
    placeholder: "Invalid textarea",
    "aria-invalid": true,
    defaultValue: "invalid input",
    rows: 4,
  },
}

export const Large: Story = {
  args: {
    placeholder: "Enter a longer message...",
    rows: 8,
  },
}

export const Small: Story = {
  args: {
    placeholder: "Short message",
    rows: 2,
  },
}
