// Visitor-facing chat texts, copied verbatim from docs/chatbot/chatbot-settings.md (the source
// of truth — keep in sync). Shared by /api/chat and the chat UI, so everything here ships to
// the browser: never put secrets, prompts or guardrail details in this file.

export const CONTACT_EMAIL = "sreehari.official0606@gmail.com";

export const CHAT_TEXT = {
  assistantName: "Sreehari's AI Assistant",
  greeting:
    "Hi! I'm Sreehari's AI assistant. Ask me anything about his experience, projects or skills.",
  offTopic:
    "I can only answer questions about Sreehari — his experience, projects, skills or how to reach him. What would you like to know?",
  missing: `I don't have that detail — you can ask Sreehari directly at ${CONTACT_EMAIL}.`,
  /** The output guard blocked an answer to an on-topic question (not an off-topic refusal). */
  answerFailed: `Sorry, I couldn't put that answer together. Please try rephrasing, or reach Sreehari directly at ${CONTACT_EMAIL}.`,
  /**
   * A request to show, drop or change the assistant's instructions, when no model words the
   * reply (router unavailable, or its reply didn't say this). Sent with the contact buttons.
   */
  cantChange:
    "I can't change how I work, but suggestions about this assistant are welcome: you can send them to Sreehari by email or WhatsApp with the buttons below.",
  /** Always sent with the contact buttons (see /api/chat). */
  busy: "I'm getting a lot of questions right now. You can reach Sreehari directly by email or WhatsApp with the buttons below.",
  slowDown: "You're asking questions a little fast — please wait a few seconds and try again.",
  limitReached: `Thanks for all the questions! You've reached the limit for now — please come back a bit later, or reach Sreehari directly at ${CONTACT_EMAIL} or on LinkedIn.`,
  invalid: "Sorry, I couldn't read that message. Please try again with a shorter question.",
} as const;

export const CHAT_UI = {
  suggestedQuestions: [
    "What is Sreehari doing now?",
    "What's his work experience?",
    "What computer vision projects has he built?",
    "How can I contact him?",
  ],
  footerNote: "AI answers based on Sreehari's resume and projects. May make mistakes.",
  networkError: "Couldn't reach the assistant. Try again.",
  tooltip: "Ask my AI assistant",
  /** Mirrors the server's default CHAT_MAX_MESSAGE_CHARS. */
  maxMessageChars: 500,
  /** Mirrors the server's request limits (12 messages, 16 KB body). */
  maxMessagesSent: 12,
  maxBodyChars: 15_000,
} as const;
