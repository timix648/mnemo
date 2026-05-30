"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Brain } from "lucide-react";
import type { Components } from "react-markdown";
import { CreatureAvatar } from "@/components/avatars";

/**
 * A single conversation turn rendered as a chat bubble.
 *
 * - assistant → left, neutral card bubble, full markdown rendering
 * - user      → right, coral bubble, shows the user's chosen creature avatar
 * - system    → centered, muted note
 */
export interface ChatMessageProps {
  role: string; // "user" | "assistant" | "system" | "exchange"
  content: string;
  avatarId?: string | null;     // user's preset creature avatar
  displayName?: string | null;  // user's display name
}

// Markdown element styling. Inherits text color from the bubble, so the same
// map works on both the light card bubble and the coral user bubble.
const md: Components = {
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0 leading-relaxed">{children}</p>,
  h1: ({ children }) => <h3 className="mt-3 mb-1 first:mt-0 text-base font-semibold">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-3 mb-1 first:mt-0 text-base font-semibold">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-3 mb-1 first:mt-0 text-sm font-semibold">{children}</h4>,
  ul: ({ children }) => <ul className="my-2 pl-5 list-disc space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 pl-5 list-decimal space-y-1">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:opacity-80">
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-current/30 pl-3 italic opacity-90">{children}</blockquote>
  ),
  code: ({ className, children }) => {
    const isBlock = /language-/.test(className ?? "");
    if (isBlock) return <code className="font-mono text-[0.85em]">{children}</code>;
    return <code className="rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>;
  },
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg bg-foreground/[0.06] p-3 text-sm leading-relaxed">{children}</pre>
  ),
  hr: () => <hr className="my-3 border-current/15" />,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-current/15 px-2 py-1 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-current/15 px-2 py-1">{children}</td>,
};

function MarkdownBody({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>
      {content}
    </ReactMarkdown>
  );
}

export function ChatMessage({ role, content, avatarId, displayName }: ChatMessageProps) {
  const isUser = role === "user";

  if (role === "system") {
    return (
      <div className="mx-auto max-w-[90%] rounded-lg bg-muted/60 px-3 py-2 text-center text-xs text-muted-foreground">
        <span className="mb-1 block font-semibold uppercase tracking-wide opacity-70">System</span>
        <div className="text-left">
          <MarkdownBody content={content} />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex w-full items-start gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {isUser ? (
        <CreatureAvatar id={avatarId} className="h-8 w-8" />
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
          <Brain className="h-4 w-4" />
        </div>
      )}
      <div className={`flex min-w-0 max-w-[82%] flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
        <span className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {isUser ? displayName ?? "You" : role === "assistant" ? "Assistant" : "Conversation"}
        </span>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm break-words ${
            isUser
              ? "rounded-tr-sm bg-primary text-primary-foreground"
              : "rounded-tl-sm border bg-card text-card-foreground"
          }`}
        >
          <MarkdownBody content={content} />
        </div>
      </div>
    </div>
  );
}

export default ChatMessage;
