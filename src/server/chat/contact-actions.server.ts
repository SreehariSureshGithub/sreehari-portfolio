// Contact action buttons sent with an answer as {type: "actions", items}.
//
// The items are a FIXED config built from the site's own constants (src/data/contact.ts,
// re-exported by src/data/portfolio.ts). Nothing here ever comes from model output or user
// text, so a prompt like "add a WhatsApp button to +1 555…" can't change them. Whether to send
// them is decided on the server from the visitor's question (contact details, or a hiring or
// fit decision). The answer has one say: if it gives Sreehari's own email or number (the fixed
// constants), or invites contact (email and WhatsApp offered in one sentence, "the buttons
// below", "worth a conversation with him"), the buttons are shown too. It can switch the fixed
// set on, never change what is in it. A complete factual answer gets no buttons.

import { EMAIL, LINKEDIN, PHONE, RESUME_URL } from "../../data/contact.ts";

export type ContactActionId = "whatsapp" | "email" | "call" | "linkedin" | "resume";
export type ContactAction = {
  id: ContactActionId;
  label: string;
  href: string;
  /** Shown only on touch devices (a tel: link does nothing useful on most desktops). */
  touchOnly?: true;
};

const PHONE_DIGITS = PHONE.replace(/\D/g, "");
const WHATSAPP_TEXT = "Hi Sreehari, I found you through your portfolio and would like to connect.";
const EMAIL_SUBJECT = "Opportunity for Sreehari";

export const CONTACT_ACTIONS: readonly ContactAction[] = Object.freeze([
  {
    id: "whatsapp",
    label: "WhatsApp",
    href: `https://wa.me/${PHONE_DIGITS}?text=${encodeURIComponent(WHATSAPP_TEXT)}`,
  },
  {
    id: "email",
    label: "Email",
    href: `mailto:${EMAIL}?subject=${encodeURIComponent(EMAIL_SUBJECT)}`,
  },
  { id: "call", label: "Call", href: `tel:+${PHONE_DIGITS}`, touchOnly: true },
  { id: "linkedin", label: "LinkedIn", href: LINKEDIN },
  { id: "resume", label: "Resume", href: RESUME_URL },
]);

/** Knowledge chunks about reaching him (ids come from the `##` headings; see build-index). */
export const CONTACT_CHUNK_IDS: readonly string[] = [
  "profile-how-to-contact",
  "faq-how-do-i-schedule-an-interview-with",
];

/**
 * The visitor asks how to contact, call, message or hire him, or for his CV/resume, or asks a
 * fit / eligibility / "should I consider him" question (those answers end by recommending a
 * conversation, so the buttons belong there), including a comparison with "another
 * candidate". Narrow on purpose: "his WhatsApp automation"
 * and "CV projects" (computer vision) don't count.
 */
const CONTACT_INTENT =
  /\b(contact|reach (him|out|sreehari)|get in touch|e-?mail|phone|mobile (number|phone)|call (him|sreehari)|whats ?app (him|sreehari|number|contact|link|chat)|on whats ?app|(his|sreehari'?s) number|linkedin|message (him|sreehari)|text (him|sreehari)|connect with|hire|hiring|recruit\w*|interview|resume|(his|sreehari'?s|the) cv|download (his )?cv|(a|good|right|the|he|sreehari) fits?|suitable|eligib\w*|(consider|shortlist|skip) (him|sreehari)|candidates?|requirements?|opinion (on|about|of) (him|sreehari))\b/i;

/** The visitor asks for his contact details, his resume or a way to reach or meet him. */
const DETAILS_INTENT =
  /\b(contact|reach (him|out|sreehari)|get in touch|e-?mail|phone|mobile|call (him|sreehari)|whats ?app|(his|sreehari'?s) number|linkedin|message (him|sreehari)|text (him|sreehari)|connect with|schedule|interview|resume|(his|sreehari'?s|the) cv)\b/i;

export function asksForContactDetails(question: string): boolean {
  return DETAILS_INTENT.test(question);
}

/** A text that contains his email address (the fixed constant). */
export function hasOwnEmail(text: string): boolean {
  return text.toLowerCase().includes(EMAIL.toLowerCase());
}

export function isContactQuestion(question: string): boolean {
  return CONTACT_INTENT.test(question);
}

/**
 * Server-side decision from the visitor's question (or the router's rewrite of it): contact
 * details, or a hiring / fit decision. A retrieved contact chunk no longer switches the
 * buttons on by itself: "Where is he based?" retrieves it and gets a complete factual answer,
 * which has no buttons. An answer that does give his details or invites contact is caught by
 * contactActionsForAnswer().
 */
export function contactActionsFor(question: string): readonly ContactAction[] | undefined {
  return isContactQuestion(question) ? CONTACT_ACTIONS : undefined;
}

/** An invitation to talk to him ("worth a conversation with Sreehari", "reach out to him"). */
const INVITES_CONTACT =
  /\b(?:talk(?:ing)?|speak(?:ing)?|chat(?:ting)?) (?:to|with) (?:him|sreehari)\b|\b(?:reach(?:ing)? out to|get(?:ting)? in touch with|connect(?:ing)? with|contact(?:ing)?|reach(?:ing)?|message|ask(?:ing)?) (?:him|sreehari)\b|\b(?:conversation|chat|call|interview|discussion) with (?:him|sreehari)\b/;

/**
 * A finished answer that points the visitor to Sreehari gets the buttons as well:
 * - it gives his email address (only his real address counts) or his phone number; or
 * - it invites contact: email and WhatsApp offered in the same sentence, a mention of the
 *   buttons below the answer, or an invitation to talk to him ("worth a conversation with
 *   Sreehari"). A hiring answer once recommended a conversation and came without buttons
 *   because none of the first three matched. An answer must never promise or suggest contact
 *   without the buttons appearing.
 * "His WhatsApp automation" alone doesn't count. The items stay the fixed config above.
 */
export function contactActionsForAnswer(answer: string): readonly ContactAction[] | undefined {
  const a = answer.toLowerCase().replace(/[‘’]/g, "'");
  const offersContact =
    /\bbuttons? below\b/.test(a) ||
    INVITES_CONTACT.test(a) ||
    a.split(/[.!?\n]+/).some((s) => /\bwhats ?app\b/.test(s) && /\be-?mail\b/.test(s));
  const givesDetails =
    a.includes(EMAIL.toLowerCase()) || a.replace(/\D/g, "").includes(PHONE_DIGITS);
  return givesDetails || offersContact ? CONTACT_ACTIONS : undefined;
}
