# Before Stage 0 — checklist

## Accounts (free, NO credit card anywhere)
- [ ] Groq API key — https://console.groq.com
- [x] ~~Gemini API key~~ — not used: this Google project has no Gemini free tier (2026-11-11). The fallback is a second Groq model.
- [ ] Upstash Redis database — https://console.upstash.com → copy REST URL + token
- [ ] Keys stored in a password manager. Never paste them into any chat.

## Content (knowledge/)
- [x] Resume content (profile, experience, skills, education)
- [ ] projects.md — fill [FILL] lines (how it works, challenge, GitHub links)
- [ ] faq.md — "why hire me" line, team preference, relocation
- [ ] status.md — work arrangement; keep or delete the visa section
- [ ] Decide: phone/WhatsApp in the bot? (default: no)
- [ ] docs/chatbot/chatbot-settings.md — language choice (logging: decided — none)

## Laptop / Vercel
- [ ] `npm run dev` works in sreehari-ai
- [ ] Node 20+ (`node -v`)
- [ ] Vercel dashboard: confirm production branch is main and you can add env vars
- [ ] Git remote still points to ReyDeInferno (repo was transferred) — Stage 0 fixes it with your OK

## Fix on the website itself (src/data/portfolio.ts / sections)
- [ ] "Images Annotated 7500+" → CV says 2,500+
- [ ] Location "Trivandrum" → Dubai
- [ ] Freelance role shows "Present" → CV says Aug 2025 – Sept 2026
- [ ] Freelance link missing https://, typo "PROFESSONAL EXPERIENCE"
