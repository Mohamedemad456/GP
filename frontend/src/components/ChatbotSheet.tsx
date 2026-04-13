import { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Send, Sparkles, Bot, User, MessageCircle, X } from "lucide-react";
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
  Textarea,
  Avatar,
  AvatarFallback,
  AvatarBadge,
} from "@gp/design-system";
import { cn } from "@/lib/utils";
import { formatMarkdown } from "@/lib/formatMarkdown";
import { chatWithAI } from "@/actions/action";

type Message = { role: "user" | "assistant"; text: string };

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block size-2 rounded-full bg-primary/70"
          animate={{ y: [0, -5, 0], opacity: [0.5, 1, 0.5] }}
          transition={{
            duration: 0.7,
            repeat: Infinity,
            delay: i * 0.14,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

function MessageBubble({
  msg,
  index,
}: {
  msg: Message;
  index: number;
}) {
  const isUser = msg.role === "user";
  // User always right, AI always left (consistent in both LTR and RTL)
  const align = isUser ? "justify-end" : "justify-start";

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
          "max-w-[80%] px-4 py-3 text-sm leading-relaxed [&_ul]:list-disc [&_ol]:list-decimal",
          isUser
            ? "rounded-t-3xl rounded-bl-3xl rounded-br-lg bg-primary text-primary-foreground shadow-md shadow-primary/15"
            : "rounded-t-3xl rounded-br-3xl rounded-bl-lg border border-border/60 bg-card text-card-foreground shadow-sm",
        )}
        dir="auto"
      >
        {isUser ? msg.text : formatMarkdown(msg.text)}
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
  const [messages, setMessages] = useState<Message[]>(() => [
    { role: "assistant", text: t("chatbot.greeting") },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const isRTL = i18n.language?.startsWith("ar") ?? false;
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);


  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.overflowY = "hidden";  
    el.style.height = "auto";
    const maxH = 120;               
    if (el.scrollHeight > maxH) {
      el.style.height = `${maxH}px`;
      el.style.overflowY = "auto"; 
    } else {
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [inputValue]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  const handleMessageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;

    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setInputValue("");
    setIsLoading(true);

    try {
      const data = await chatWithAI(trimmed);
      const assistantText =
        (data as { response?: string })?.response ?? "Sorry, I couldn't process that.";
      setMessages((prev) => [...prev, { role: "assistant", text: assistantText }]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: t("chatbot.error", "Something went wrong. Please try again."),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [open, messages, isLoading]);

  // Update greeting when language changes (initial state only runs once at mount)
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 0 || prev[0].role !== "assistant") return prev;
      return [{ ...prev[0], text: t("chatbot.greeting") }, ...prev.slice(1)];
    });
  }, [i18n.language, t]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <motion.button
          type="button"
          aria-label={t("chatbot.openLabel")}
          className={cn(
            "fixed z-40 flex size-14 cursor-pointer items-center justify-center rounded-full",
            "bg-primary text-primary-foreground",
            "shadow-[0_8px_32px_-4px_hsl(var(--primary)/0.5)]",
            "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "end-5 bottom-5",
          )}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
        >
          <AnimatePresence mode="wait">
            {open ? (
              <motion.span
                key="open"
                initial={{ rotate: -90, opacity: 0, scale: 0.7 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: 90, opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.18 }}
              >
                <X className="size-5" strokeWidth={2.5} />
              </motion.span>
            ) : (
              <motion.span
                key="closed"
                initial={{ rotate: 90, opacity: 0, scale: 0.7 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: -90, opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.18 }}
              >
                <MessageCircle className="size-6" strokeWidth={2} />
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
        side="right"
        className={cn(
          "flex h-full w-[92vw] max-w-[420px] flex-col gap-0 overflow-hidden border-0 p-0 sm:w-[420px]",
          "bg-background",
          "shadow-[-4px_0_24px_-6px_rgba(0,0,0,0.1)] rounded-l-2xl",
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
                aria-label={t("chatbot.close", "Close")}
              >
                <X className="size-4" strokeWidth={2.5} />
              </button>
            </div>
          </SheetHeader>
        </div>

        {/* Messages */}
        <div className="relative flex-1 overflow-hidden">
          {/* Top fade */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-linear-to-b from-background to-transparent"
            aria-hidden
          />
          <ScrollArea className="h-full border-0 bg-muted/20">
            <div className="flex flex-col gap-4 px-4 py-5" style={{ direction: "ltr" }}>
              {messages.map((msg, i) => (
                <MessageBubble key={i} msg={msg} index={i} />
              ))}

              {/* Typing indicator */}
              <AnimatePresence>
                {isLoading && (
                  <motion.div
                    className="flex items-center justify-start gap-2.5"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: 0.1 }}
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
                )}
              </AnimatePresence>

              <div ref={bottomRef} />
            </div>
          </ScrollArea>
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-border/50 bg-background px-4 pb-4 pt-3">
          <form
            ref={formRef}
            className="flex items-end gap-2"
            onSubmit={handleMessageSubmit}
            style={{ direction: isRTL ? "rtl" : "ltr" }}
          >
            <Textarea
              ref={textareaRef}
              rows={1}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("chatbot.placeholder")}
              aria-label={t("chatbot.placeholder")}
              style={{ minHeight: 0 }}
              className={cn(
                "min-w-0 flex-1 rounded-2xl border-border/70",
                "bg-secondary/50 px-4 py-2 text-sm leading-relaxed",
                "placeholder:text-muted-foreground/60 max-h-[120px]",
              )}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!inputValue.trim() || isLoading}
              className={cn(
                "size-10 shrink-0 rounded-full transition-all duration-200",
                inputValue.trim() && !isLoading
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/30"
                  : "bg-secondary text-muted-foreground",
              )}
              aria-label={t("chatbot.send")}
            >
              <Send
                className={cn(
                  "size-4 transition-transform",
                  isRTL ? "rotate-180" : "",
                )}
                strokeWidth={2.2}
              />
            </Button>
          </form>
          <p className="mt-2 text-center text-[10px] text-muted-foreground/50">
            {t("chatbot.poweredBy", "Powered by Sayarti AI")}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
