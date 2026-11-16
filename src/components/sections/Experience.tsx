import { useState } from "react";
import { motion } from "motion/react";
import { Briefcase, ChevronDown, ExternalLink } from "lucide-react";
import { Reveal } from "@/components/ui-kit/Reveal";
import { SectionHeading } from "@/components/ui-kit/SectionHeading";
import { EXPERIENCE } from "@/data/portfolio";

export function Experience() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="experience" className="relative py-16 md:py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading title="Experience" />

        <div className="relative mt-12 pl-8 md:pl-12">
          <div
            aria-hidden="true"
            className="absolute bottom-0 left-[7.5px] top-2 w-px"
            style={{ background: "var(--gradient-brand)", opacity: 0.5 }}
          />

          {EXPERIENCE.map((job, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={job.role + job.period} delay={i * 0.06} className="relative mb-6">
                <span
                  aria-hidden="true"
                  className="absolute -left-8 top-7 grid h-4 w-4 place-items-center rounded-full bg-background md:-left-12"
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: "var(--gradient-brand)" }}
                  />
                </span>

                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="glass glow-border w-full p-6 text-left"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Briefcase className="h-4 w-4 text-primary" />
                        <span className="font-mono text-[11px] tracking-[0.2em]">{job.period}</span>
                      </div>
                      <h3 className="mt-2 font-display text-xl font-semibold">{job.role}</h3>
                      <p className="text-sm text-muted-foreground">
                        <a
                          href={job.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 transition-colors hover:text-primary hover:underline"
                        >
                          {job.company}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </p>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300 ${
                        isOpen ? "rotate-180 text-primary" : ""
                      }`}
                    />
                  </div>

                  <motion.div
                    initial={false}
                    animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <ul className="mt-5 space-y-2.5">
                      {job.highlights.map((h) => (
                        <li key={h} className="flex gap-3 text-sm text-muted-foreground">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                          {h}
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                </button>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
