import { useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, Github, Linkedin, Mail, MessageCircle, Phone, Send } from "lucide-react";
import { toast } from "sonner";
import { Reveal } from "@/components/ui-kit/Reveal";
import { SectionHeading } from "@/components/ui-kit/SectionHeading";
import { MagneticButton } from "@/components/ui-kit/MagneticButton";
import { EMAIL, GITHUB, LINKEDIN, PHONE } from "@/data/portfolio";

const field =
  "w-full rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm outline-none transition-all duration-300 placeholder:text-muted-foreground focus:border-primary/60 focus:bg-secondary/70";

export function Contact() {
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isSubmitting) return;

    setIsSubmitting(true);

    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.append("portfolio", "sreehari");

    try {
      const response = await fetch(
        "https://script.google.com/macros/s/AKfycbzyoYiw900MBgc4lMqdXWcr1_nzX3rlty2koQMB1a6oUrR75UjBQ7lDVxl-pH5x-k4uTg/exec",
        {
          method: "POST",
          body: formData,
          redirect: "follow",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to send");
      }

      setSent(true);
      form.reset();
      setIsSubmitting(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to send message.");
      setIsSubmitting(false);
    }
  };

  const copyEmail = async () => {
    await navigator.clipboard.writeText(EMAIL);
    setCopied(true);
    toast.success("Email copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="contact" className="relative py-28">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading title="Contact" />

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Reveal>
            <form onSubmit={submit} className="glass glow-border relative overflow-hidden p-7">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="text-xs text-muted-foreground">
                    Name
                  </label>
                  <input id="name" name="name" required className={`mt-2 ${field}`} />
                </div>
                <div>
                  <label htmlFor="email" className="text-xs text-muted-foreground">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    className={`mt-2 ${field}`}
                  />
                </div>
              </div>

              <div className="mt-4">
                <label htmlFor="subject" className="text-xs text-muted-foreground">
                  Subject
                </label>
                <input id="subject" name="subject" required className={`mt-2 ${field}`} />
              </div>

              <div className="mt-4">
                <label htmlFor="message" className="text-xs text-muted-foreground">
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={5}
                  required
                  className={`mt-2 ${field}`}
                />
              </div>

              <div className="mt-6">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className={`relative inline-flex items-center gap-2 overflow-hidden rounded-full px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-all duration-300 ${
                    isSubmitting
                      ? "cursor-not-allowed bg-primary opacity-80"
                      : "glow-cyan hover:scale-[1.03]"
                  }`}
                  style={isSubmitting ? undefined : { background: "var(--gradient-brand)" }}
                >
                  {isSubmitting ? (
                    <>
                      <span
                        aria-hidden="true"
                        className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground"
                      />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" /> Send Message
                    </>
                  )}
                </button>
              </div>

              <AnimatePresence>
                {sent && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 grid place-items-center bg-background/90 p-7 text-center"
                  >
                    <motion.div
                      initial={{ scale: 0.6 }}
                      animate={{ scale: 1 }}
                      className="flex max-w-md flex-col items-center gap-4"
                    >
                      <span
                        className="grid h-16 w-16 place-items-center rounded-full text-primary-foreground"
                        style={{ background: "var(--gradient-brand)" }}
                      >
                        <Check className="h-7 w-7" />
                      </span>
                      <p className="font-display text-lg font-semibold">
                        Message sent successfully!
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Thank you for reaching out. Your message has been received successfully.
                        I'll get back to you as soon as possible.
                      </p>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </Reveal>

          <Reveal delay={0.1} className="space-y-4">
            <div className="glass glow-border p-6">
              <p className="font-mono text-[11px] tracking-[0.25em] text-primary">DIRECT</p>
              <a
                href={`tel:${PHONE.replace(/\s/g, "")}`}
                className="mt-5 flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground"
              >
                <Phone className="h-4 w-4 text-muted-foreground" /> {PHONE}
              </a>
              <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                <a href={`mailto:${EMAIL}`} className="truncate hover:text-foreground">
                  {EMAIL}
                </a>
                <button
                  type="button"
                  onClick={copyEmail}
                  aria-label="Copy email address"
                  className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border transition-colors hover:text-primary"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <div className="glass glow-border p-6">
              <p className="font-mono text-[11px] tracking-[0.25em] text-primary">ELSEWHERE</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <MagneticButton href={GITHUB} variant="ghost" className="px-5 py-2.5 text-xs">
                  <Github className="h-4 w-4" /> GitHub
                </MagneticButton>
                <MagneticButton href={LINKEDIN} variant="ghost" className="px-5 py-2.5 text-xs">
                  <Linkedin className="h-4 w-4" /> LinkedIn
                </MagneticButton>
                <MagneticButton
                  href={`https://wa.me/${PHONE.replace(/\D/g, "")}`}
                  variant="ghost"
                  className="px-5 py-2.5 text-xs"
                  onClick={() =>
                    toast.success("Opening WhatsApp", {
                      description: "Starting a chat with Sreehari…",
                    })
                  }
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </MagneticButton>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
