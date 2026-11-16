import { Award, GraduationCap, ExternalLink } from "lucide-react";
import { Reveal } from "@/components/ui-kit/Reveal";
import { SectionHeading } from "@/components/ui-kit/SectionHeading";
import { CERTIFICATIONS, EDUCATION } from "@/data/portfolio";

export function Education() {
  return (
    <section id="education" className="relative py-16 md:py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading title="Education" />

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {EDUCATION.map((e, i) => (
            <Reveal key={e.degree} delay={i * 0.08}>
              <div className="glass glow-border h-full p-7">
                <GraduationCap aria-hidden="true" className="h-6 w-6 text-primary" />
                <p className="mt-5 font-mono text-[11px] tracking-[0.2em] text-muted-foreground">
                  {e.period}
                </p>
                <h3 className="mt-2 font-display text-lg font-semibold">{e.degree}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  <a
                    href={e.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 transition-colors hover:text-primary hover:underline"
                  >
                    {e.school}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CERTIFICATIONS.map((c, i) => (
            <Reveal key={c} delay={i * 0.05}>
              <div className="glass flex h-full items-center gap-3 p-5 transition-colors duration-300 hover:text-primary">
                <Award className="h-4.5 w-4.5 shrink-0 text-muted-foreground" />
                <p className="text-sm">{c}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
