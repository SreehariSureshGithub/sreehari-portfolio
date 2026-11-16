import { motion } from "motion/react";
import { Github, Linkedin, Mail, ArrowDown, Download } from "lucide-react";
import { MagneticButton } from "@/components/ui-kit/MagneticButton";
import { Typewriter } from "@/components/ui-kit/Typewriter";
import { Counter } from "@/components/ui-kit/Counter";
import { NeuralVisual } from "./NeuralVisual";
import { EMAIL, GITHUB, HERO_STATS, LINKEDIN, RESUME_URL, ROLES } from "@/data/portfolio";

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pb-20 pt-32 md:pt-40">
      <div aria-hidden="true" className="grid-lines absolute inset-0 -z-10 opacity-40" />
      <div
        aria-hidden="true"
        className="absolute -left-40 top-10 -z-10 h-[420px] w-[420px] rounded-full blur-3xl"
        style={{ background: "var(--gradient-glow)" }}
      />

      <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <span className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground">
              AVAILABLE FOR AI ROLES
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-6 text-4xl font-bold leading-[1.05] sm:text-6xl lg:text-7xl"
          >
            <span className="block text-lg font-medium text-muted-foreground sm:text-xl">
              Hi, I&apos;m
            </span>
            <span className="text-foreground">Sreehari Suresh</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mt-4 font-display text-xl font-semibold sm:text-2xl"
          >
            <Typewriter words={ROLES} />
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground"
          >
            AI Engineer with hands-on experience building Computer Vision, Machine Learning,
            Generative AI, NLP, and intelligent automation solutions. Experienced across the AI
            development lifecycle, from data preparation and model development to optimization,
            deployment, and building AI-powered applications using modern ML frameworks, LLMs, APIs,
            and automation tools.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-9 flex flex-wrap items-center gap-4"
          >
            <MagneticButton href="#projects">
              View Projects <ArrowDown className="h-4 w-4" />
            </MagneticButton>
            <MagneticButton href={RESUME_URL} download variant="ghost">
              <Download className="h-4 w-4" /> Download Resume
            </MagneticButton>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.65 }}
            className="mt-8 flex items-center gap-3"
          >
            {[
              { href: GITHUB, Icon: Github, label: "GitHub" },
              { href: LINKEDIN, Icon: Linkedin, label: "LinkedIn" },
              { href: `mailto:${EMAIL}`, Icon: Mail, label: "Email" },
            ].map(({ href, Icon, label }) => (
              <a
                key={label}
                href={href}
                target={href.startsWith("http") ? "_blank" : undefined}
                rel="noreferrer"
                aria-label={label}
                className="glass grid h-11 w-11 place-items-center rounded-full text-muted-foreground transition-all duration-300 hover:scale-110 hover:text-primary hover:glow-cyan"
              >
                <Icon className="h-4.5 w-4.5" />
              </a>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="flex justify-center"
        >
          <NeuralVisual />
        </motion.div>
      </div>

      <div className="mx-auto mt-20 grid max-w-6xl grid-cols-2 gap-4 px-5 lg:grid-cols-4">
        {HERO_STATS.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7 + i * 0.1 }}
            className="glass glow-border p-6 text-center"
          >
            <p className="font-display text-3xl font-bold text-foreground sm:text-4xl">
              <Counter value={s.value} suffix={s.suffix} />
            </p>
            <p className="mt-2 text-xs text-muted-foreground sm:text-sm">{s.label}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
