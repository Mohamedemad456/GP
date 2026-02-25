import type { Meta, StoryObj } from "@storybook/react";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarBadge,
  AvatarGroup,
  AvatarGroupCount,
} from "./avatar";
import { User } from "lucide-react";

const meta: Meta<typeof Avatar> = {
  title: "Design System/Avatar",
  component: Avatar,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: ["sm", "default", "lg", "xl"],
      description: "Avatar size",
    },
  },
};

export default meta;

type Story = StoryObj<typeof Avatar>;

export const WithImage: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Avatar size="sm">
        <AvatarImage src="https://i.pravatar.cc/64?u=a" alt="User" />
        <AvatarFallback>U</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarImage src="https://i.pravatar.cc/64?u=b" alt="User" />
        <AvatarFallback>U</AvatarFallback>
      </Avatar>
      <Avatar size="lg">
        <AvatarImage src="https://i.pravatar.cc/64?u=c" alt="User" />
        <AvatarFallback>U</AvatarFallback>
      </Avatar>
      <Avatar size="xl">
        <AvatarImage src="https://i.pravatar.cc/64?u=d" alt="User" />
        <AvatarFallback>U</AvatarFallback>
      </Avatar>
    </div>
  ),
};

export const WithFallback: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Avatar size="sm">
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
      <Avatar size="lg">
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
      <Avatar size="xl">
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    </div>
  ),
};

export const WithIcon: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Avatar size="sm">
        <AvatarFallback>
          <User />
        </AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>
          <User />
        </AvatarFallback>
      </Avatar>
      <Avatar size="lg">
        <AvatarFallback>
          <User />
        </AvatarFallback>
      </Avatar>
      <Avatar size="xl">
        <AvatarFallback>
          <User />
        </AvatarFallback>
      </Avatar>
    </div>
  ),
};

export const WithBadge: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Avatar>
        <AvatarImage src="https://i.pravatar.cc/64?u=e" alt="User" />
        <AvatarFallback>U</AvatarFallback>
        <AvatarBadge className="bg-success" />
      </Avatar>
      <Avatar size="lg">
        <AvatarImage src="https://i.pravatar.cc/64?u=f" alt="User" />
        <AvatarFallback>U</AvatarFallback>
        <AvatarBadge className="bg-destructive" />
      </Avatar>
      <Avatar size="xl">
        <AvatarFallback>AI</AvatarFallback>
        <AvatarBadge className="bg-success" />
      </Avatar>
    </div>
  ),
};

export const Styled: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Avatar>
        <AvatarFallback className="bg-primary text-primary-foreground">
          AI
        </AvatarFallback>
        <AvatarBadge className="bg-success" />
      </Avatar>
      <Avatar size="lg">
        <AvatarFallback className="bg-primary/15 text-primary">
          <User />
        </AvatarFallback>
      </Avatar>
    </div>
  ),
};

export const Group: Story = {
  render: () => (
    <AvatarGroup>
      <Avatar>
        <AvatarImage src="https://i.pravatar.cc/64?u=g" alt="User" />
        <AvatarFallback>A</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarImage src="https://i.pravatar.cc/64?u=h" alt="User" />
        <AvatarFallback>B</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarImage src="https://i.pravatar.cc/64?u=i" alt="User" />
        <AvatarFallback>C</AvatarFallback>
      </Avatar>
      <AvatarGroupCount>+5</AvatarGroupCount>
    </AvatarGroup>
  ),
};
