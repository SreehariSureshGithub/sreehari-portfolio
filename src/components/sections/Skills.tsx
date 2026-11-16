import { motion } from "motion/react";
import { Brain, Cpu, Eye, Sparkles, Terminal, type LucideIcon } from "lucide-react";
import { Reveal } from "@/components/ui-kit/Reveal";
import { SectionHeading } from "@/components/ui-kit/SectionHeading";
import { SKILL_GROUPS } from "@/data/portfolio";

const ICONS: Record<string, LucideIcon> = { Eye, Brain, Cpu, Terminal, Sparkles };

export function Skills() {
  return (
    <section id="skills" className="relative py-16 md:py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          eyebrow="TECHNICAL SKILLS"
          title="The stack behind the systems"
          subtitle="Tooling used in production pipelines, edge deployments and research prototypes."
        />

        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {SKILL_GROUPS.map((group, gi) => {
            const Icon = ICONS[group.icon] ?? Sparkles;
            return (
              <Reveal key={group.title} delay={gi * 0.08}>
                <div className="glass glow-border group h-full p-7 transition-transform duration-300 hover:-translate-y-1.5">
                  <div className="flex items-center gap-3">
                    <span
                      className="grid h-11 w-11 place-items-center rounded-xl text-primary-foreground"
                      style={{ background: "var(--gradient-brand)" }}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="font-display text-lg font-semibold">{group.title}</h3>
                  </div>

                  <ul className="mt-6 space-y-4">
                    {group.skills.map((skill) => (
                      <li key={skill.name}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground transition-colors group-hover:text-foreground">
                            {skill.name}
                          </span>
                          <span className="font-mono text-[11px] text-primary">{skill.level}%</span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                          <motion.div
                            initial={{ width: 0 }}
                            whileInView={{ width: `${skill.level}%` }}
                            viewport={{ once: true, margin: "-40px" }}
                            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                            className="h-full rounded-full"
                            style={{ background: "var(--gradient-brand)" }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
