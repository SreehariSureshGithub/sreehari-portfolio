import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { Nav } from "@/components/sections/Nav";
import { Hero } from "@/components/sections/Hero";
import { About } from "@/components/sections/About";
import { Skills } from "@/components/sections/Skills";
import { Experience } from "@/components/sections/Experience";
import { Projects } from "@/components/sections/Projects";
import { Education } from "@/components/sections/Education";
import { Contact } from "@/components/sections/Contact";
import { Footer } from "@/components/sections/Footer";
import { ParticleField } from "@/components/fx/ParticleField";
import { CursorGlow } from "@/components/fx/CursorGlow";
import { ScrollProgress } from "@/components/fx/ScrollProgress";
import { BackToTop } from "@/components/fx/BackToTop";
import { Loader } from "@/components/fx/Loader";
import { KonamiEasterEgg } from "@/components/fx/Konami";

const title = "Sreehari Suresh — AI & Computer Vision Engineer";
const description =
  "Applied AI Engineer building Computer Vision, Embedded AI and GenAI systems with YOLO, TensorRT, Raspberry Pi and PyTorch. 98% detection accuracy, 4ms inference.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Divider() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto h-px w-full max-w-6xl"
      style={{
        background:
          "linear-gradient(90deg, transparent, color-mix(in oklab, var(--cyan) 35%, transparent), transparent)",
      }}
    />
  );
}

function Index() {
  return (
    <main className="relative">
      <Loader />
      <ScrollProgress />
      <ParticleField />
      <CursorGlow />
      <Nav />
      <Hero />
      <Divider />
      <About />
      <Divider />
      <Experience />
      <Divider />
      <Projects />
      <Divider />
      <Skills />
      <Divider />
      <Education />
      <Divider />
      <Contact />
      <Footer />
      <BackToTop />
      <KonamiEasterEgg />
      <Toaster theme="dark" position="bottom-center" richColors />
    </main>
  );
}
