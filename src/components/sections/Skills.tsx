import { Reveal } from "@/components/ui-kit/Reveal";
import { SectionHeading } from "@/components/ui-kit/SectionHeading";
import { SKILL_GROUPS } from "@/data/portfolio";

export function Skills() {
  return (
    <section id="skills" className="relative py-16 md:py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading title="Skills" />

        <div className="mt-12 grid gap-10 md:grid-cols-2 lg:grid-cols-3">
          {SKILL_GROUPS.map((group, gi) => (
            <Reveal key={group.title} delay={gi * 0.08}>
              <h3 className="font-display text-lg font-semibold">{group.title}</h3>
              <ul className="mt-4 flex flex-wrap gap-2">
                {group.skills.map((skill) => (
                  <li
                    key={skill}
                    className="rounded-md border border-border px-2.5 py-1 text-sm text-muted-foreground"
                  >
                    {skill}
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
