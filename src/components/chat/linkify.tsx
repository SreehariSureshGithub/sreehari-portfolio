import type { ReactNode } from "react";

// Assistant text is rendered as plain React text nodes (never as HTML or Markdown).
// Only http(s) URLs, email addresses (as mailto:) and the short forms of his profile links
// ("linkedin.com/in/…", "github.com/…", shown as written, opened over https) become links.

const LINK_PATTERN =
  /(https?:\/\/[^\s<>"'`]+)|([A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})|(?<![\w./@-])((?:www\.)?(?:linkedin\.com|github\.com)\/[^\s<>"'`]+)/g;
const TRAILING_PUNCTUATION = /[.,;:!?'")\]}]+$/;

const linkClass =
  "font-medium text-primary underline decoration-primary/40 underline-offset-2 break-all hover:decoration-primary";

function safeHttpUrl(candidate: string): string | null {
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

/** Removes Markdown bold markers the model sometimes adds (display only; nothing is parsed). */
export function tidyAnswer(text: string): string {
  // Also drops Markdown's "two spaces before a line break" so lines end cleanly.
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/[ \t]+\n/g, "\n");
}

export function linkify(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK_PATTERN)) {
    const start = match.index ?? 0;
    let value = match[0];
    let trailing = "";
    if (match[1] || match[3]) {
      trailing = value.match(TRAILING_PUNCTUATION)?.[0] ?? "";
      value = value.slice(0, value.length - trailing.length);
    }
    const href = match[1]
      ? safeHttpUrl(value)
      : match[3]
        ? safeHttpUrl(`https://${value}`)
        : `mailto:${value}`;
    if (!href) continue;
    if (start > last) nodes.push(text.slice(last, start));
    nodes.push(
      <a key={start} href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
        {value}
      </a>,
    );
    if (trailing) nodes.push(trailing);
    last = start + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}
