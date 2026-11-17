import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowUpRight, X } from "lucide-react";
import { Reveal } from "@/components/ui-kit/Reveal";
import { SectionHeading } from "@/components/ui-kit/SectionHeading";
import { MagneticButton } from "@/components/ui-kit/MagneticButton";
import {
  GITHUB_REPOSITORIES_URL,
  OPEN_SOURCE_PROJECTS,
  WORK_PROJECTS,
  type OpenSourceProject,
  type WorkProject,
} from "@/data/portfolio";

/** GitHub's own language colours, used only for the small language dot. */
const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  Python: "#3572A5",
  "Jupyter Notebook": "#DA5B0B",
};

type Active = { kind: "work"; project: WorkProject } | { kind: "oss"; project: OpenSourceProject };

const groupLabel = "font-mono text-xs uppercase tracking-[0.3em] text-primary";
const categoryLabel = "font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground";
const card = "glass glow-border flex h-full flex-col overflow-hidden";

function Tags({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((t) => (
        <span
          key={t}
          className="rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground"
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function DetailsButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-xs font-semibold text-primary hover:underline">
      View details
    </button>
  );
}

export function Projects() {
  const [active, setActive] = useState<Active | null>(null);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setActive(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  return (
    <section id="projects" className="relative py-16 md:py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading title="Projects" />

        {/* Featured projects: image cards, code not on GitHub */}
        <Reveal className="mt-12">
          <h3 className={groupLabel}>Featured projects</h3>
        </Reveal>
        <div className="mt-6 grid gap-7 md:grid-cols-2">
          {WORK_PROJECTS.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.08}>
              <article className={card}>
                <div className="relative aspect-[16/9] overflow-hidden">
                  <img
                    src={p.image}
                    alt={`${p.title} preview`}
                    loading="lazy"
                    width={1024}
                    height={640}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
                  {p.metric && (
                    <span className="glass absolute right-4 top-4 rounded-full px-3 py-1 font-mono text-[10px] tracking-wider text-muted-foreground">
                      {p.metric}
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-7">
                  <p className={categoryLabel}>{p.category}</p>
                  <h4 className="mt-2 font-display text-xl font-semibold">{p.title}</h4>
                  <p className="mt-2 text-sm text-muted-foreground">{p.summary}</p>
                  <div className="mt-5">
                    <Tags tags={p.tags} />
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-3 pt-6">
                    <DetailsButton onClick={() => setActive({ kind: "work", project: p })} />
                    <span className="text-xs text-muted-foreground">{p.codeLabel}</span>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        {/* Open source: compact text cards linking to GitHub */}
        <Reveal className="mt-16">
          <h3 className={groupLabel}>Open source</h3>
        </Reveal>
        <div className="mt-6 flex flex-wrap justify-center gap-6">
          {OPEN_SOURCE_PROJECTS.map((p, i) => (
            <Reveal
              key={p.url}
              delay={i * 0.06}
              className="w-full md:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-3rem)/3)]"
            >
              <article className={`${card} p-6`}>
                <p className={categoryLabel}>{p.category}</p>
                <h4 className="mt-2 font-display text-lg font-semibold">{p.title}</h4>
                <p className="mt-2 text-sm text-muted-foreground">{p.summary}</p>
                <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: LANGUAGE_COLORS[p.language] ?? "var(--muted-foreground)" }}
                  />
                  {p.language}
                </p>
                <div className="mt-4">
                  <Tags tags={p.tags} />
                </div>
                <div className="mt-auto flex items-center justify-between gap-3 pt-6">
                  <DetailsButton onClick={() => setActive({ kind: "oss", project: p })} />
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${p.title} on GitHub (opens in a new tab)`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    GitHub <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                  </a>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-12 text-center">
          <a
            href={GITHUB_REPOSITORIES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            See the rest of my projects on GitHub{" "}
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </a>
        </Reveal>
      </div>

      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActive(null)}
            role="dialog"
            aria-modal="true"
            aria-label={active.project.title}
            className="fixed inset-0 z-[80] grid place-items-center bg-background/90 p-4"
          >
            <motion.div
              initial={{ y: 24 }}
              animate={{ y: 0 }}
              exit={{ y: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="glass relative max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto"
            >
              <button
                onClick={() => setActive(null)}
                aria-label="Close project details"
                className="glass absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:text-primary"
              >
                <X className="h-4 w-4" />
              </button>
              {active.kind === "work" && (
                <img
                  src={active.project.image}
                  alt={`${active.project.title} preview`}
                  width={1024}
                  height={640}
                  className="aspect-[16/9] w-full object-cover"
                />
              )}
              <div className="p-7">
                <p className={`${categoryLabel} ${active.kind === "oss" ? "pr-12" : ""}`}>
                  {active.project.category}
                </p>
                <h3
                  className={`mt-2 font-display text-2xl font-bold ${active.kind === "oss" ? "pr-12" : ""}`}
                >
                  {active.project.title}
                </h3>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  {active.project.detail}
                </p>
                <div className="mt-5">
                  <Tags tags={active.project.tags} />
                </div>
                {active.kind === "oss" && (
                  <div className="mt-7">
                    <MagneticButton href={active.project.url} className="px-6 py-3 text-xs">
                      View on GitHub <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
                    </MagneticButton>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
