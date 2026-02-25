import { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Send, Sparkles, Bot, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  ScrollArea,
  Button,
  Input,
  Avatar,
  AvatarFallback,
  AvatarBadge,
} from "@gp/design-system";
import { cn } from "@/lib/utils";

type Message = { role: "user" | "assistant"; text: string };

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block size-2 rounded-full bg-primary/60"
          animate={{ y: [0, -6, 0] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

function MessageBubble({
  msg,
  isRTL,
  index,
}: {
  msg: Message;
  isRTL: boolean;
  index: number;
}) {
  const isUser = msg.role === "user";
  const align = isUser
    ? isRTL
      ? "justify-start"
      : "justify-end"
    : isRTL
      ? "justify-end"
      : "justify-start";

  return (
    <motion.div
      className={cn("flex gap-2.5", align)}
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.35,
        delay: index * 0.08,
        ease: [0.2, 0, 0, 1],
      }}
    >
      {!isUser && (
        <Avatar size="default" className="mt-1 ring-0">
          <AvatarFallback className="bg-primary/15 text-primary">
            <Bot strokeWidth={2.2} />
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          "max-w-[80%] px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "rounded-t-3xl rounded-bl-3xl rounded-br-lg bg-primary text-primary-foreground shadow-md shadow-primary/15"
            : "rounded-t-3xl rounded-br-3xl rounded-bl-lg border border-border/60 bg-card text-card-foreground shadow-sm"
        )}
      >
        {msg.text}
      </div>
      {isUser && (
        <Avatar size="default" className="mt-1 ring-0">
          <AvatarFallback className="bg-primary text-primary-foreground">
            <User strokeWidth={2.2} />
          </AvatarFallback>
        </Avatar>
      )}
    </motion.div>
  );
}

export default function ChatbotSheet() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const isRTL = i18n.language?.startsWith("ar") ?? false;
  const bottomRef = useRef<HTMLDivElement>(null);

  const mockMessages: Message[] = [
    { role: "assistant", text: t("chatbot.greeting") },
    { role: "user", text: t("chatbot.mock.user1") },
    { role: "assistant", text: t("chatbot.mock.assistant1") },
    { role: "user", text: t("chatbot.mock.user2") },
    { role: "assistant", text: t("chatbot.mock.assistant2") },
  ];

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <motion.button
          type="button"
          aria-label={t("chatbot.openLabel")}
          className={cn(
            "fixed z-40 flex size-14 cursor-pointer items-center justify-center rounded-full",
            "bg-primary text-primary-foreground",
            "shadow-[0_4px_24px_-4px_hsl(var(--primary)/0.45)]",
            "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            isRTL ? "left-5" : "right-5",
            "bottom-5"
          )}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
        >
          <AnimatePresence mode="wait">
            {open ? (
              <motion.span
                key="open"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Sparkles className="size-6" strokeWidth={2.2} />
              </motion.span>
            ) : (
              <motion.span
                key="closed"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Sparkles className="size-6" strokeWidth={2.2} />
              </motion.span>
            )}
          </AnimatePresence>

          <span className="absolute -right-0.5 -top-0.5 flex size-3.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex size-3.5 rounded-full bg-success" />
          </span>
        </motion.button>
      </SheetTrigger>

      <SheetContent
        side={isRTL ? "left" : "right"}
        className={cn(
          "flex h-full w-[92vw] max-w-[420px] flex-col gap-0 overflow-hidden border-0 p-0 sm:w-[420px]",
          "bg-background",
          "shadow-[-4px_0_24px_-6px_rgba(0,0,0,0.1)]",
          isRTL ? "rounded-r-2xl" : "rounded-l-2xl"
        )}
        showCloseButton={false}
      >
        {/* Header */}
        <div className="relative shrink-0 overflow-hidden border-b border-border/50 px-5 py-4">
          <div
            className="absolute inset-0 bg-linear-to-br from-primary/8 via-transparent to-primary/4"
            aria-hidden
          />
          <SheetHeader className="relative z-10 p-0">
            <div className="flex items-center gap-3.5">
              <Avatar size="lg" className="rounded-2xl ring-0 shadow-sm">
                <AvatarFallback className="rounded-2xl bg-primary text-primary-foreground">
                  <Sparkles strokeWidth={2.2} />
                </AvatarFallback>
                <AvatarBadge className="bg-success animate-pulse" />
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col">
                <SheetTitle className="font-heading text-base font-semibold tracking-tight text-foreground">
                  {t("chatbot.title")}
                </SheetTitle>
                <SheetDescription className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-success" />
                  {t("chatbot.online")}
                </SheetDescription>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Close"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 15 15"
                  fill="none"
                  className="size-4"
                >
                  <path
                    d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z"
                    fill="currentColor"
                    fillRule="evenodd"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </SheetHeader>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 border-0 bg-transparent">
          <div
            className="flex flex-col gap-4 px-4 py-5"
            style={{ direction: isRTL ? "rtl" : "ltr" }}
          >
            {mockMessages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} isRTL={isRTL} index={i} />
            ))}

            {/* Typing indicator */}
            <motion.div
              className={cn(
                "flex items-center gap-2.5",
                isRTL ? "justify-end" : "justify-start"
              )}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: mockMessages.length * 0.08 + 0.2 }}
            >
              <Avatar size="default" className="ring-0">
                <AvatarFallback className="bg-primary/15 text-primary">
                  <Bot strokeWidth={2.2} />
                </AvatarFallback>
              </Avatar>
              <div className="rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm">
                <TypingIndicator />
              </div>
            </motion.div>

            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="shrink-0 border-t border-border/50 bg-background px-4 py-3.5">
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => e.preventDefault()}
            style={{ direction: isRTL ? "rtl" : "ltr" }}
          >
            <Input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={t("chatbot.placeholder")}
              className="min-w-0 flex-1 rounded-full border-border/70 bg-secondary/50 px-4 py-2 text-sm placeholder:text-muted-foreground/70"
              aria-label={t("chatbot.placeholder")}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!inputValue.trim()}
              className={cn(
                "size-10 shrink-0 rounded-full transition-all",
                inputValue.trim()
                  ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90 hover:shadow-lg"
                  : "bg-secondary text-muted-foreground"
              )}
              aria-label={t("chatbot.send")}
            >
              <Send
                className={cn(
                  "size-4 transition-transform",
                  isRTL ? "rotate-180" : ""
                )}
                strokeWidth={2.2}
              />
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
