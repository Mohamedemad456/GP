import type { Meta, StoryObj } from "@storybook/react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "./carousel";

const meta: Meta<typeof Carousel> = {
  title: "Design System/Carousel",
  component: Carousel,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof Carousel>;

const slides = [
  { color: "bg-primary/20", label: "Slide 1" },
  { color: "bg-secondary", label: "Slide 2" },
  { color: "bg-muted", label: "Slide 3" },
];

export const Default: Story = {
  render: () => (
    <Carousel className="w-full max-w-md">
      <CarouselContent>
        {slides.map((slide, i) => (
          <CarouselItem key={i}>
            <div
              className={`flex aspect-video items-center justify-center rounded-lg border border-border ${slide.color}`}
            >
              <span className="text-sm font-medium">{slide.label}</span>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  ),
};

export const MultiplePerView: Story = {
  render: () => (
    <Carousel
      opts={{
        align: "start",
        loop: true,
      }}
      className="w-full max-w-2xl"
    >
      <CarouselContent className="-ml-2 md:-ml-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <CarouselItem key={i} className="pl-2 md:pl-4 md:basis-1/2 lg:basis-1/3">
            <div className="flex aspect-square items-center justify-center rounded-lg border border-border bg-muted">
              <span className="text-sm">Item {i + 1}</span>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  ),
};
