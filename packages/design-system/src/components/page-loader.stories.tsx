import type { Meta, StoryObj } from "@storybook/react";
import PageLoader from "./page-loader";

const frameStyle = {
  position: "relative" as const,
  width: "720px",
  height: "420px",
  overflow: "hidden" as const,
  borderRadius: "var(--radius)",
  border: "1px solid var(--border)",
};

const meta: Meta<typeof PageLoader> = {
  title: "Design System/PageLoader",
  component: PageLoader,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Full-screen page loader with animated car, speed lines, and road, themed by design tokens.",
      },
    },
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div style={frameStyle}>
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof PageLoader>;

export const Default: Story = {
  render: () => <PageLoader fullscreen={false} />,
};

export const Dark: Story = {
  render: () => <PageLoader fullscreen={false} />,
  decorators: [
    (Story) => (
      <div className="dark">
        <Story />
      </div>
    ),
  ],
};
