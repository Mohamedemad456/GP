import type { Meta, StoryObj } from "@storybook/react";
import { Skeleton } from "./skeleton";

const meta: Meta<typeof Skeleton> = {
  title: "Design System/Skeleton",
  component: Skeleton,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof Skeleton>;

export const Default: Story = {
  args: {
    className: "h-12 w-48",
  },
};

export const Circle: Story = {
  render: () => <Skeleton className="size-12 rounded-full" />,
};

export const Card: Story = {
  render: () => (
    <div className="w-[320px] space-y-4 rounded-lg border border-border p-4">
      <div className="flex items-center gap-4">
        <Skeleton className="size-12 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-20 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 flex-1" />
      </div>
    </div>
  ),
};

export const TextLines: Story = {
  render: () => (
    <div className="space-y-2 w-64">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  ),
};
