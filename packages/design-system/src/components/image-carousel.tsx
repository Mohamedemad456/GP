import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
import { cn } from "../utils/cn";

type ImageCarouselProps = {
  images: string[];
  altBase?: string;
  className?: string;
};

export function ImageCarousel({
  images,
  altBase = "Image",
  className,
}: ImageCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!images.length) {
    return (
      <div className={cn("rounded-lg border border-border bg-muted/40 p-8 text-center text-sm text-muted-foreground", className)}>
        No images available
      </div>
    );
  }

  const goPrev = () => setActiveIndex((prev) => (prev - 1 + images.length) % images.length);
  const goNext = () => setActiveIndex((prev) => (prev + 1) % images.length);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative overflow-hidden rounded-xl border border-border bg-card">
        <img
          src={images[activeIndex]}
          alt={`${altBase} ${activeIndex + 1}`}
          className="aspect-video h-full w-full object-cover"
          loading="lazy"
        />

        {images.length > 1 && (
          <>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="absolute left-3 top-1/2 -translate-y-1/2"
              onClick={goPrev}
              aria-label="Previous image"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="absolute right-3 top-1/2 -translate-y-1/2"
              onClick={goNext}
              aria-label="Next image"
            >
              <ChevronRight className="size-4" />
            </Button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="grid grid-cols-5 gap-2">
          {images.map((img, index) => (
            <button
              key={img}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={cn(
                "overflow-hidden rounded-md border transition-all",
                index === activeIndex
                  ? "border-primary ring-1 ring-primary"
                  : "border-border hover:border-primary/60"
              )}
              aria-label={`Show image ${index + 1}`}
            >
              <img
                src={img}
                alt={`${altBase} thumbnail ${index + 1}`}
                className="aspect-video w-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

