import type { Meta, StoryObj } from "@storybook/react"
import { Separator } from "./separator"

const meta: Meta<typeof Separator> = {
  title: "Design System/Separator",
  component: Separator,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    orientation: {
      control: "select",
      options: ["horizontal", "vertical"],
      description: "Separator orientation",
    },
  },
}

export default meta

type Story = StoryObj<typeof Separator>

export const Horizontal: Story = {
  args: {
    orientation: "horizontal",
  },
  render: (args) => (
    <div className="w-64">
      <div className="py-4">Content above</div>
      <Separator {...args} />
      <div className="py-4">Content below</div>
    </div>
  ),
}

export const Vertical: Story = {
  args: {
    orientation: "vertical",
  },
  render: (args) => (
    <div className="flex items-center h-32 gap-4">
      <div>Left</div>
      <Separator {...args} />
      <div>Right</div>
    </div>
  ),
}

export const InCard: Story = {
  render: () => (
    <div className="w-64 p-6 border rounded-lg bg-card">
      <h3 className="font-semibold mb-2">Card Title</h3>
      <p className="text-sm text-muted-foreground mb-4">
        This is some card content that demonstrates the separator usage.
      </p>
      <Separator className="my-4" />
      <p className="text-sm text-muted-foreground">
        Content after separator
      </p>
    </div>
  ),
}

export const WithCustomStyling: Story = {
  render: () => (
    <div className="w-64 space-y-4">
      <div className="py-4">Default separator</div>
      <Separator />
      <div className="py-4">Thicker separator</div>
      <Separator className="h-[2px]" />
      <div className="py-4">Colored separator</div>
      <Separator className="bg-primary h-[2px]" />
    </div>
  ),
}
