import { Reveal } from "./Reveal";

export function SectionHeading({ title }: { title: string }) {
  return (
    <Reveal>
      <h2 className="text-3xl font-bold sm:text-4xl md:text-5xl">{title}</h2>
    </Reveal>
  );
}
