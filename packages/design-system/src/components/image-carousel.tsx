import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
import { cn } from "../utils/cn";

const THUMB_PAGE = 4;

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
  const [thumbOffset, setThumbOffset] = useState(0);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lbThumbOffset, setLbThumbOffset] = useState(0);

  // ── helpers ────────────────────────────────────────────────────────────────
  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };
  const closeLightbox = () => setLightboxOpen(false);

  const goPrev = () =>
    setActiveIndex((p) => (p - 1 + images.length) % images.length);
  const goNext = () =>
    setActiveIndex((p) => (p + 1) % images.length);

  const lightboxPrev = useCallback(
    () => setLightboxIndex((p) => (p - 1 + images.length) % images.length),
    [images.length],
  );
  const lightboxNext = useCallback(
    () => setLightboxIndex((p) => (p + 1) % images.length),
    [images.length],
  );

  // ── keep thumb windows in sync with active indices ─────────────────────────
  useEffect(() => {
    setThumbOffset((prev) => {
      if (activeIndex < prev) return activeIndex;
      if (activeIndex >= prev + THUMB_PAGE) return activeIndex - THUMB_PAGE + 1;
      return prev;
    });
  }, [activeIndex]);

  useEffect(() => {
    if (!lightboxOpen) return;
    setLbThumbOffset((prev) => {
      if (lightboxIndex < prev) return lightboxIndex;
      if (lightboxIndex >= prev + THUMB_PAGE)
        return lightboxIndex - THUMB_PAGE + 1;
      return prev;
    });
  }, [lightboxIndex, lightboxOpen]);

  // ── keyboard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") lightboxPrev();
      if (e.key === "ArrowRight") lightboxNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen, lightboxPrev, lightboxNext]);

  // ── body scroll lock ───────────────────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = lightboxOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [lightboxOpen]);

  // ── empty state ────────────────────────────────────────────────────────────
  if (!images.length) {
    return (
      <div
        className={cn(
          "rounded-lg border border-border bg-muted/40 p-8 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        No images available
      </div>
    );
  }

  const hasManyThumbs = images.length > THUMB_PAGE;

  // ── reusable thumbnail strip ───────────────────────────────────────────────
  function ThumbStrip({
    offset,
    setOffset,
    currentIndex,
    onSelect,
    dark = false,
  }: {
    offset: number;
    setOffset: (fn: (p: number) => number) => void;
    currentIndex: number;
    onSelect: (i: number) => void;
    dark?: boolean;
  }) {
    const canPrev = offset > 0;
    const canNext = offset + THUMB_PAGE < images.length;
    const btnBase = dark
      ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      : "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50";

    return (
      <div className="flex items-center gap-2 mx-2">
        {/* Prev arrow */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOffset((p) => Math.max(0, p - 1));
          }}
          disabled={!canPrev}
          aria-label="Previous thumbnails"
          className={cn(
            btnBase,
            canPrev
              ? dark
                ? "bg-white/10 hover:bg-white/25 hover:scale-110"
                : "hover:border-primary/50 hover:bg-muted hover:scale-110"
              : "pointer-events-none opacity-25",
          )}
        >
          <ChevronLeft className="size-4" />
        </button>

        {/* Visible thumbnails */}
        <div className="grid flex-1 grid-cols-4 gap-2">
          {images.slice(offset, offset + THUMB_PAGE).map((img, i) => {
            const idx = offset + i;
            return (
              <button
                key={img}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(idx);
                }}
                aria-label={`Show image ${idx + 1}`}
                aria-current={idx === currentIndex}
                className={cn(
                  "overflow-hidden rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2",
                  dark
                    ? cn(
                        "border-2 focus-visible:ring-white/50",
                        idx === currentIndex
                          ? "border-white opacity-100"
                          : "border-transparent opacity-45 hover:opacity-80",
                      )
                    : cn(
                        "border-2 focus-visible:ring-primary/60",
                        idx === currentIndex
                          ? "border-primary ring-1 ring-primary/40 shadow-sm opacity-100"
                          : "border-border opacity-60 hover:opacity-100 hover:border-primary/50",
                      ),
                )}
              >
                <img
                  src={img}
                  alt={`${altBase} thumbnail ${idx + 1}`}
                  className="aspect-video w-full object-cover"
                  loading="lazy"
                />
              </button>
            );
          })}
        </div>

        {/* Next arrow */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOffset((p) => Math.min(images.length - THUMB_PAGE, p + 1));
          }}
          disabled={!canNext}
          aria-label="Next thumbnails"
          className={cn(
            btnBase,
            canNext
              ? dark
                ? "bg-white/10 hover:bg-white/25 hover:scale-110"
                : "hover:border-primary/50 hover:bg-muted hover:scale-110"
              : "pointer-events-none opacity-25",
          )}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    );
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div className={cn("space-y-3", className)}>
        {/* Main image */}
        <div className="group relative overflow-hidden rounded-xl bg-muted">
          <button
            type="button"
            className="relative block w-full cursor-zoom-in focus-visible:outline-none"
            onClick={() => openLightbox(activeIndex)}
            aria-label={`View image ${activeIndex + 1} full size`}
          >
            <img
              src={images[activeIndex]}
              alt={`${altBase} ${activeIndex + 1}`}
              className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              loading="lazy"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-300 group-hover:bg-black/25">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/0 transition-all duration-300 group-hover:bg-black/50 group-hover:scale-110">
                <ZoomIn className="size-5 text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </span>
            </div>
          </button>

          {/* Counter */}
          {images.length > 1 && (
            <span className="pointer-events-none absolute bottom-3 end-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
              {activeIndex + 1} / {images.length}
            </span>
          )}

          {/* Main prev/next */}
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={goPrev}
                className="absolute start-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-all hover:scale-110 hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                aria-label="Previous image"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={goNext}
                className="absolute end-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-all hover:scale-110 hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                aria-label="Next image"
              >
                <ChevronRight className="size-5" />
              </button>
            </>
          )}
        </div>

        {/* Thumbnail strip */}
        {images.length > 1 && (
          hasManyThumbs ? (
            <ThumbStrip
              offset={thumbOffset}
              setOffset={setThumbOffset}
              currentIndex={activeIndex}
              onSelect={setActiveIndex}
            />
          ) : (
            <div className="grid grid-cols-4 gap-2 mx-2">
              {images.map((img, index) => (
                <button
                  key={img}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-label={`Show image ${index + 1}`}
                  aria-current={index === activeIndex}
                  className={cn(
                    "overflow-hidden rounded-lg border-2 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                    index === activeIndex
                      ? "border-primary ring-1 ring-primary/40 shadow-sm opacity-100"
                      : "border-border opacity-60 hover:opacity-100 hover:border-primary/50",
                  )}
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
          )
        )}
      </div>

      {/* ── Lightbox ── */}
      {lightboxOpen &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Image viewer"
            className="fixed inset-0 z-9999 flex flex-col items-center justify-center gap-4 bg-black/95 backdrop-blur-sm"
            onClick={closeLightbox}
          >
            {/* Close */}
            <button
              type="button"
              onClick={closeLightbox}
              className="absolute end-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              aria-label="Close image viewer"
            >
              <X className="size-5" />
            </button>

            {/* Counter */}
            <span className="absolute start-1/2 top-4 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
              {lightboxIndex + 1} / {images.length}
            </span>

            {/* Main image */}
            <div
              className="flex max-h-[75vh] max-w-[85vw] items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={images[lightboxIndex]}
                alt={`${altBase} ${lightboxIndex + 1}`}
                className="max-h-[75vh] max-w-[85vw] rounded-xl object-contain shadow-2xl"
              />
            </div>

            {/* Lightbox prev/next */}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); lightboxPrev(); }}
                  className="absolute start-4 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-all hover:scale-110 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="size-6" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); lightboxNext(); }}
                  className="absolute end-4 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-all hover:scale-110 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                  aria-label="Next image"
                >
                  <ChevronRight className="size-6" />
                </button>
              </>
            )}

            {/* Lightbox thumbnail strip */}
            {images.length > 1 && (
              <div
                className="absolute bottom-4 w-full max-w-md px-4"
                onClick={(e) => e.stopPropagation()}
              >
                {hasManyThumbs ? (
                  <ThumbStrip
                    offset={lbThumbOffset}
                    setOffset={setLbThumbOffset}
                    currentIndex={lightboxIndex}
                    onSelect={setLightboxIndex}
                    dark
                  />
                ) : (
                  <div className="flex justify-center gap-2">
                    {images.map((img, index) => (
                      <button
                        key={img}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setLightboxIndex(index); }}
                        aria-label={`View image ${index + 1}`}
                        aria-current={index === lightboxIndex}
                        className={cn(
                          "h-12 w-16 overflow-hidden rounded-md border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
                          index === lightboxIndex
                            ? "border-white opacity-100"
                            : "border-transparent opacity-40 hover:opacity-75",
                        )}
                      >
                        <img
                          src={img}
                          alt={`${altBase} thumbnail ${index + 1}`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
