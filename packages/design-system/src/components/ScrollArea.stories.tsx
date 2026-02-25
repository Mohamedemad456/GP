import type { Meta, StoryObj } from "@storybook/react";
import { ScrollArea } from "./scroll-area";

const meta: Meta<typeof ScrollArea> = {
  title: "Design System/ScrollArea",
  component: ScrollArea,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof ScrollArea>;

const longContent = Array.from({ length: 20 }, (_, i) => (
  <p key={i} className="py-2 text-sm text-muted-foreground">
    Line {i + 1}. Scroll to see the scrollbar and how it matches the design
    tokens.
  </p>
));

export const Vertical: Story = {
  render: () => (
    <ScrollArea className="h-48 w-64">
      <div className="p-4">{longContent}</div>
    </ScrollArea>
  ),
};

export const WithHeading: Story = {
  render: () => (
    <ScrollArea className="h-64 w-72">
      <div className="p-4">
        <h3 className="mb-2 font-heading font-semibold text-foreground">
          Scrollable content
        </h3>
        {longContent}
      </div>
    </ScrollArea>
  ),
};

export const Horizontal: Story = {
  render: () => (
    <ScrollArea className="w-64">
      <div className="flex w-max gap-4 p-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex size-20 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-sm font-medium"
          >
            {i + 1}
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
};

export const BothAxes: Story = {
  render: () => (
    <ScrollArea className="h-48 w-64">
      <div
        className="flex w-max flex-col gap-2 p-4"
        style={{ width: "max-content", minWidth: "100%" }}
      >
        {Array.from({ length: 8 }).map((_, row) => (
          <div key={row} className="flex gap-2">
            {Array.from({ length: 6 }).map((_, col) => (
              <div
                key={col}
                className="flex size-12 shrink-0 items-center justify-center rounded-md border border-border bg-secondary text-xs"
              >
                {row * 6 + col + 1}
              </div>
            ))}
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
};
