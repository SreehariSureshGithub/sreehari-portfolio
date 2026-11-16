import { motion } from "motion/react";
import { Reveal } from "@/components/ui-kit/Reveal";
import { SectionHeading } from "@/components/ui-kit/SectionHeading";
import { INTERESTS } from "@/data/portfolio";
import portrait from "@/assets/portrait.jpg";

export function About() {
  return (
    <section id="about" className="relative py-16 md:py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          eyebrow="ABOUT ME"
          title="Building AI systems that solve real-world problems"
          subtitle="From computer vision and Machine Learning to generative AI, automation and intelligent software systems."
        />

        <div className="mt-16">
          <div className="grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr]">
            <Reveal>
              <div className="relative mx-auto max-w-sm">
                <div
                  aria-hidden="true"
                  className="absolute -inset-6 rounded-full blur-3xl"
                  style={{ background: "var(--gradient-glow)" }}
                />
                <div className="glass glow-border relative overflow-hidden rounded-3xl">
                  <img
                    src={portrait}
                    alt="Portrait of Sreehari Suresh, AI Engineer"
                    loading="lazy"
                    width={1024}
                    height={1024}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background to-transparent p-5">
                    <p className="font-display text-sm font-semibold">Sreehari Suresh</p>
                    <p className="text-xs text-muted-foreground">Dubai, UAE</p>
                  </div>
                </div>
              </div>
            </Reveal>

            <div className="space-y-6">
              <Reveal delay={0.1}>
                <p className="text-lg leading-relaxed text-muted-foreground">
                  I am an <span className="text-foreground">AI Engineer</span> with hands-on
                  experience across{" "}
                  <span className="text-foreground">
                    Computer Vision, Machine Learning, Generative AI
                  </span>{" "}
                  and intelligent automation. My work spans from developing and evaluating machine
                  learning models to deploying real-time AI systems and building practical
                  AI-powered applications.
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
                  . This includes embedded AI systems using Raspberry Pi, LiDAR and TensorRT, as
                  well as LLM-based chatbots, NLP applications and automation workflows.
                </p>
              </Reveal>

              <Reveal delay={0.2}>
                <p className="text-lg leading-relaxed text-muted-foreground">
                  More recently, I have expanded into{" "}
                  <span className="text-foreground">
                    LLM applications, RAG, AI agents, business automation, APIs and software systems
                  </span>
                  . I enjoy working across the boundary between AI models and the systems around
                  them, turning individual models and tools into complete, usable solutions.
                </p>
              </Reveal>
            </div>
          </div>

          <Reveal delay={0.25}>
            <div className="mt-14">
              <p className="text-center font-mono text-xs tracking-[0.3em] text-primary">
                INTERESTS
              </p>
              <div className="mx-auto mt-5 flex max-w-4xl flex-wrap justify-center gap-2.5">
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
          </Reveal>
        </div>
      </div>
    </section>
  );
}
