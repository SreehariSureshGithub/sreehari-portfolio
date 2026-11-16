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
                I am an <span className="text-foreground">AI Engineer</span> with hands-on
                experience across{" "}
                <span className="text-foreground">
                  Computer Vision, Machine Learning, Generative AI
                </span>{" "}
                and intelligent automation. My work spans from developing and evaluating machine
                learning models to deploying real-time AI systems and building practical AI-powered
                applications.
              </p>
            </Reveal>

            <Reveal delay={0.15}>
              <p className="text-lg leading-relaxed text-muted-foreground">
                I have worked across the full AI development lifecycle, from{" "}
                <span className="text-foreground">dataset preparation and model development</span>{" "}
                to{" "}
                <span className="text-foreground">
                  optimization, deployment and real-world validation
                </span>
                . This includes embedded AI systems using Raspberry Pi, LiDAR and TensorRT, as well
                as LLM-based chatbots, NLP applications and automation workflows.
              </p>
            </Reveal>

            <Reveal delay={0.2}>
              <p className="text-lg leading-relaxed text-muted-foreground">
                More recently, I have expanded into{" "}
                <span className="text-foreground">
                  LLM applications, RAG, AI agents, business automation, APIs and software systems
                </span>
                . I enjoy working across the boundary between AI models and the systems around them,
                turning individual models and tools into complete, usable solutions.
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.25} className="space-y-10">
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
