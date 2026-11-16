import { Reveal } from "./Reveal";

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <p className="font-mono text-xs tracking-[0.35em] text-primary">{eyebrow}</p>
      <h2 className="mt-4 text-3xl font-bold sm:text-4xl md:text-5xl">
        <span className="text-foreground">{title}</span>
      </h2>
      {subtitle && <p className="mt-4 text-base text-muted-foreground">{subtitle}</p>}
      <div
        aria-hidden="true"
        className="mx-auto mt-8 h-px w-40"
        style={{ background: "var(--gradient-brand)" }}
      />
    </Reveal>
  );
}
