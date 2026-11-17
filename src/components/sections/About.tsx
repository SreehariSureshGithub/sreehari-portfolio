import { motion } from "motion/react";
import { Reveal } from "@/components/ui-kit/Reveal";
import { SectionHeading } from "@/components/ui-kit/SectionHeading";
import { INTERESTS, QUICK_FACTS } from "@/data/portfolio";

export function About() {
  return (
    <section id="about" className="relative py-16 md:py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading title="About" />

        <div className="mt-12 grid gap-12 lg:grid-cols-[3fr_2fr] lg:gap-16">
          <div className="max-w-[70ch] space-y-6">
            <Reveal delay={0.1}>
              <p className="text-lg leading-relaxed text-muted-foreground">
                I'm Sreehari, an <span className="text-foreground">AI engineer based in Dubai</span>
                , with interests in{" "}
                <span className="text-foreground">
                  computer vision, generative AI and intelligent automation
                </span>
                .
              </p>
            </Reveal>

            <Reveal delay={0.15}>
              <p className="text-lg leading-relaxed text-muted-foreground">
                I've been pursuing AI for the past six years: a bachelor's and a master's degree in
                AI, followed by two years of studying, building and delivering AI systems and
                solutions.
              </p>
            </Reveal>

            <Reveal delay={0.2}>
              <p className="text-lg leading-relaxed text-muted-foreground">
                During my master's I did two AI internships, working on{" "}
                <span className="text-foreground">real-time computer vision</span>: getting
                detection models to run fast on edge devices like the Jetson Nano and Raspberry Pi.
                After that I spent a year freelancing, building{" "}
                <span className="text-foreground">automation systems and data pipelines</span> for
                businesses, which taught me to work directly with clients and deliver end to end.
              </p>
            </Reveal>

            <Reveal delay={0.25}>
              <p className="text-lg leading-relaxed text-muted-foreground">
                Along the way I've learned that{" "}
                <span className="text-foreground">I learn best by building</span>. That's how I
                picked up RAG: I built the AI assistant on this site, so feel free to ask it
                anything about me.
              </p>
            </Reveal>

            <Reveal delay={0.3}>
              <p className="text-lg leading-relaxed text-muted-foreground">
                Now I'm looking for a team where I can keep growing, ideally doing{" "}
                <span className="text-foreground">research-driven work</span>, while building AI
                that solves real problems.
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.35} className="space-y-10">
            <div>
              <p className="font-mono text-xs tracking-[0.3em] text-primary">INTERESTS</p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                {INTERESTS.map((item, i) => (
                  <motion.span
                    key={item}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className="glass rounded-full px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {item}
                  </motion.span>
                ))}
              </div>
            </div>

            <div>
              <p className="font-mono text-xs tracking-[0.3em] text-primary">QUICK FACTS</p>
              <dl className="mt-5 space-y-3 text-sm">
                {QUICK_FACTS.map((fact) => (
                  <div key={fact.label} className="flex gap-3">
                    <dt className="w-24 shrink-0 text-muted-foreground">{fact.label}</dt>
                    <dd className="text-foreground">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
