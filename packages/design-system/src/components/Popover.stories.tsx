import type { Meta, StoryObj } from "@storybook/react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from "./popover";
import { Button } from "./button";

const meta: Meta<typeof Popover> = {
  title: "Design System/Popover",
  component: Popover,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof Popover>;

export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Open popover</Button>
      </PopoverTrigger>
      <PopoverContent>
        <PopoverHeader>
          <PopoverTitle>Popover title</PopoverTitle>
          <PopoverDescription>
            This is the popover description. It can contain extra context or
            instructions.
          </PopoverDescription>
        </PopoverHeader>
        <div className="pt-2 text-sm text-muted-foreground">
          Optional body content goes here.
        </div>
      </PopoverContent>
    </Popover>
  ),
};

export const SimpleContent: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary">Click me</Button>
      </PopoverTrigger>
      <PopoverContent>
        <p className="text-sm">A simple popover with no header.</p>
      </PopoverContent>
    </Popover>
  ),
};
