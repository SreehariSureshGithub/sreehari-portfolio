import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Search, X } from "lucide-react";
import { Reveal } from "@/components/ui-kit/Reveal";
import { SectionHeading } from "@/components/ui-kit/SectionHeading";
import { TiltCard } from "@/components/ui-kit/TiltCard";
import { PROJECTS, type Project } from "@/data/portfolio";

const FILTERS = ["All", "Computer Vision", "Embedded AI", "GenAI", "Machine Learning"] as const;

export function Projects() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<Project | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PROJECTS.filter(
      (p) =>
        (filter === "All" || p.category === filter) &&
        (!q ||
          p.title.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)) ||
          p.summary.toLowerCase().includes(q)),
    );
  }, [filter, query]);

  return (
    <section id="projects" className="relative py-16 md:py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading title="Projects" />

        <Reveal className="mt-12 flex flex-col items-center gap-5">
          <div className="flex flex-wrap justify-center gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`rounded-full px-4 py-2 text-xs font-medium transition-all duration-300 ${
                  filter === f
                    ? "text-primary-foreground glow-cyan"
                    : "glass text-muted-foreground hover:text-foreground"
                }`}
                style={filter === f ? { background: "var(--gradient-brand)" } : undefined}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="glass flex w-full max-w-sm items-center gap-3 rounded-full px-4 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects…"
              aria-label="Search projects"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </Reveal>

        <motion.div layout className="mt-12 grid gap-7 md:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {visible.map((p) => (
              <motion.article
                key={p.title}
                layout
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <TiltCard className="h-full">
                  <div className="glass glow-border group h-full overflow-hidden">
                    <div className="relative aspect-[16/9] overflow-hidden">
                      <img
                        src={p.image}
                        alt={`${p.title} preview`}
                        loading="lazy"
                        width={1024}
                        height={640}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
                      {p.metric && (
                        <span className="glass absolute right-4 top-4 rounded-full px-3 py-1 font-mono text-[10px] tracking-wider text-muted-foreground">
                          {p.metric}
                        </span>
                      )}
                    </div>

                    <div className="p-7">
                      <p className="font-mono text-[10px] tracking-[0.25em] text-muted-foreground">
                        {p.category.toUpperCase()}
                      </p>
                      <h3 className="mt-2 font-display text-xl font-semibold">{p.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">{p.summary}</p>

                      <div className="mt-5 flex flex-wrap gap-2">
                        {p.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground"
                          >
                            {t}
                          </span>
                        ))}
                      </div>

                      <div className="mt-6 flex flex-wrap items-center gap-3">
                        <button
                          onClick={() => setActive(p)}
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          View details
                        </button>
                      </div>
                    </div>
                  </div>
                </TiltCard>
              </motion.article>
            ))}
          </AnimatePresence>
        </motion.div>

        {visible.length === 0 && (
          <p className="mt-12 text-center text-sm text-muted-foreground">
            No projects match that search.
          </p>
        )}
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
            aria-label={active.title}
            className="fixed inset-0 z-[80] grid place-items-center bg-background/90 p-4"
          >
            <motion.div
              initial={{ scale: 0.94, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="glass glow-cyan relative w-full max-w-2xl overflow-hidden"
            >
              <button
                onClick={() => setActive(null)}
                aria-label="Close project details"
                className="glass absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full"
              >
                <X className="h-4 w-4" />
              </button>
              <img
                src={active.image}
                alt={`${active.title} preview`}
                loading="lazy"
                width={1024}
                height={640}
                className="aspect-[16/9] w-full object-cover"
              />
              <div className="p-7">
                <p className="font-mono text-[10px] tracking-[0.25em] text-muted-foreground">
                  {active.category.toUpperCase()}
                </p>
                <h3 className="mt-2 font-display text-2xl font-bold">{active.title}</h3>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  {active.detail}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {active.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
