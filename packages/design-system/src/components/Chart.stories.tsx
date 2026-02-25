import type { Meta, StoryObj } from "@storybook/react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "./chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const meta: Meta<typeof ChartContainer> = {
  title: "Design System/Chart",
  component: ChartContainer,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof ChartContainer>;

const barData = [
  { month: "Jan", value: 186 },
  { month: "Feb", value: 305 },
  { month: "Mar", value: 237 },
  { month: "Apr", value: 273 },
  { month: "May", value: 398 },
  { month: "Jun", value: 404 },
];

const barConfig = {
  value: {
    label: "Value",
    color: "hsl(var(--chart-1))",
  },
  month: {
    label: "Month",
  },
} satisfies ChartConfig;

export const BarChartDemo: Story = {
  render: () => (
    <ChartContainer config={barConfig} className="h-64 w-full max-w-2xl">
      {({ width, height }) => (
        <BarChart
          width={width}
          height={height}
          data={barData}
          margin={{ left: 12, right: 12 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="value" radius={4} />
        </BarChart>
      )}
    </ChartContainer>
  ),
};

export const BarChartWithLegend: Story = {
  render: () => (
    <ChartContainer config={barConfig} className="h-64 w-full max-w-2xl">
      {({ width, height }) => (
        <BarChart
          width={width}
          height={height}
          data={barData}
          margin={{ left: 12, right: 12 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="value" radius={4} />
        </BarChart>
      )}
    </ChartContainer>
  ),
};
