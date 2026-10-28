"use client";

import ReactMarkdown, { type Components } from "react-markdown";

// react-markdown builds React elements itself and never parses raw HTML in
// the text, and its default link filter drops `javascript:` addresses — so
// a Markdown file can't inject script. Links open in a new tab; images are
// shown as their alt text (the CSP doesn't allow remote images, and a
// file's own relative paths don't exist here).
const components: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow">
      {children}
    </a>
  ),
  img: ({ alt }) => <span className="italic opacity-70">[image{alt ? `: ${alt}` : ""}]</span>,
};

export default function MarkdownBody({ text }: { text: string }) {
  return <ReactMarkdown components={components}>{text}</ReactMarkdown>;
}
