import type { Meta, StoryObj } from "@storybook/react";
import { ImageCarousel } from "./image-carousel";

const meta: Meta<typeof ImageCarousel> = {
  title: "Design System/ImageCarousel",
  component: ImageCarousel,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof ImageCarousel>;

const sampleImages = [
  "https://picsum.photos/seed/car1/800/500",
  "https://picsum.photos/seed/car2/800/500",
  "https://picsum.photos/seed/car3/800/500",
];

export const Default: Story = {
  args: {
    images: sampleImages,
    altBase: "Car",
  },
};

export const SingleImage: Story = {
  args: {
    images: ["https://picsum.photos/seed/single/800/500"],
    altBase: "Listing",
  },
};

export const Empty: Story = {
  args: {
    images: [],
    altBase: "Image",
  },
};

export const ManyImages: Story = {
  args: {
    images: [
      "https://picsum.photos/seed/a/800/500",
      "https://picsum.photos/seed/b/800/500",
      "https://picsum.photos/seed/c/800/500",
      "https://picsum.photos/seed/d/800/500",
      "https://picsum.photos/seed/e/800/500",
    ],
    altBase: "Photo",
  },
};
