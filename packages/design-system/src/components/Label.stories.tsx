import type { Meta, StoryObj } from "@storybook/react"
import { Label } from "./label"
import { Input } from "./input"

const meta: Meta<typeof Label> = {
  title: "Design System/Label",
  component: Label,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    htmlFor: {
      control: "text",
      description: "Associates the label with a form control",
    },
  },
}

export default meta

type Story = StoryObj<typeof Label>

export const Default: Story = {
  args: {
    children: "Label",
  },
}

export const WithInput: Story = {
  render: () => (
    <div className="grid w-full max-w-sm gap-2">
      <Label htmlFor="email">Email</Label>
      <Input id="email" type="email" placeholder="you@example.com" />
    </div>
  ),
}

export const FormGroup: Story = {
  render: () => (
    <div className="grid w-full max-w-sm gap-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" placeholder="Your name" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="message">Message</Label>
        <Input id="message" placeholder="Type your message..." />
      </div>
    </div>
  ),
}
