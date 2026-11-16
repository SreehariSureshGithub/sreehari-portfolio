// Client-side check of the contact buttons the server sends ({type: "actions", items}).
// The server builds them from fixed config, but the client still trusts nothing: every item
// must have a known id and a link on the allowlist below, or it is dropped. Labels and
// aria-labels are the client's own; the server's text is never rendered.

export type ContactActionId = "whatsapp" | "email" | "call" | "linkedin" | "resume";
export type ContactAction = { id: ContactActionId; href: string; touchOnly: boolean };

export const ACTION_TEXT: Record<ContactActionId, { label: string; aria: string }> = {
  whatsapp: { label: "WhatsApp", aria: "Message Sreehari on WhatsApp (opens in a new tab)" },
  email: { label: "Email", aria: "Email Sreehari" },
  call: { label: "Call", aria: "Call Sreehari" },
  linkedin: { label: "LinkedIn", aria: "Sreehari on LinkedIn (opens in a new tab)" },
  resume: { label: "Resume", aria: "Sreehari's resume, PDF (opens in a new tab)" },
};

const isId = (id: unknown): id is ContactActionId =>
  typeof id === "string" && Object.hasOwn(ACTION_TEXT, id);

/** Allowed links: wa.me, mailto:, tel:, linkedin.com and this site's own pages and files. */
export function isAllowedHref(href: string, origin: string): boolean {
  let url: URL;
  try {
    url = new URL(href, origin);
  } catch {
    return false;
  }
  if (url.username || url.password) return false;
  switch (url.protocol) {
    case "mailto:":
      return /^[^\s@/%]+@[^\s@/%]+\.[a-z]{2,}$/i.test(url.pathname);
    case "tel:":
      return /^\+?\d{6,15}$/.test(url.pathname);
    case "https:":
      if (url.hostname === "wa.me") return true;
      if (url.hostname === "linkedin.com" || url.hostname.endsWith(".linkedin.com")) return true;
      return url.origin === origin;
    case "http:":
      return url.origin === origin; // local dev
    default:
      return false;
  }
}

/** Keeps only valid, allowlisted items (first of each id, at most 5). */
export function sanitizeActions(raw: unknown, origin: string): ContactAction[] {
  if (!Array.isArray(raw)) return [];
  const out: ContactAction[] = [];
  for (const item of raw as unknown[]) {
    if (!item || typeof item !== "object") continue;
    const { id, href, touchOnly } = item as { id?: unknown; href?: unknown; touchOnly?: unknown };
    if (!isId(id) || typeof href !== "string" || href.length > 500) continue;
    if (out.some((a) => a.id === id) || !isAllowedHref(href, origin)) continue;
    out.push({ id, href, touchOnly: touchOnly === true || id === "call" });
    if (out.length === 5) break;
  }
  return out;
}

/** External links open in a new tab; mailto:/tel: links hand off to the device's apps. */
export const opensNewTab = (href: string) => !/^(mailto|tel):/i.test(href);
