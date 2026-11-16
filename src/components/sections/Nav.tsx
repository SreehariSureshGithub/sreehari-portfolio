import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Menu, X } from "lucide-react";
import { MagneticButton } from "@/components/ui-kit/MagneticButton";
import { RESUME_URL } from "@/data/portfolio";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#about", label: "About" },
  { href: "#experience", label: "Experience" },
  { href: "#projects", label: "Projects" },
  { href: "#skills", label: "Skills" },
  { href: "#education", label: "Education" },
  { href: "#contact", label: "Contact" },
];

const SECTION_IDS = LINKS.map((l) => l.href.slice(1));
/** Thin trigger band a little above mid-screen: the section crossing it is the current one. */
const TRIGGER_MARGIN = "-45% 0px -50% 0px";
/** Fallback for browsers without `scrollend`: release the click lock after this long. */
const CLICK_LOCK_MS = 1200;

/**
 * Scroll-spy: which section is under the trigger band (null in the hero). Uses only
 * IntersectionObservers, so there is no per-frame layout work. Contact is short, so a 1px
 * sentinel at the very bottom of the page makes it active when the page is scrolled to the end.
 */
function useActiveSection() {
  const [active, setActive] = useState<string | null>(null);
  const inBand = useRef(new Set<string>());
  const atBottom = useRef(false);
  const lock = useRef<string | null>(null);

  useEffect(() => {
    const compute = () => {
      if (lock.current) return;
      if (atBottom.current) return setActive("contact");
      if (inBand.current.has("top")) return setActive(null);
      const current = [...SECTION_IDS].reverse().find((id) => inBand.current.has(id));
      setActive(current ?? null);
    };

    const band = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) inBand.current.add(e.target.id);
          else inBand.current.delete(e.target.id);
        }
        compute();
      },
      { rootMargin: TRIGGER_MARGIN },
    );
    for (const id of ["top", ...SECTION_IDS]) {
      const el = document.getElementById(id);
      if (el) band.observe(el);
    }

    const sentinel = document.createElement("div");
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.style.cssText =
      "position:absolute;bottom:0;left:0;width:1px;height:1px;pointer-events:none";
    const footer = document.querySelector("footer");
    footer?.appendChild(sentinel);
    const bottom = new IntersectionObserver((entries) => {
      const last = entries[entries.length - 1];
      if (!last) return;
      atBottom.current = last.isIntersecting;
      compute();
    });
    if (footer) bottom.observe(sentinel);

    // Clicking a link: keep it active through the smooth scroll, then re-sync.
    let lockTimer: ReturnType<typeof setTimeout> | undefined;
    const release = () => {
      if (!lock.current) return;
      lock.current = null;
      clearTimeout(lockTimer);
      compute();
    };
    const onLock = (e: Event) => {
      lock.current = (e as CustomEvent<string>).detail;
      setActive(lock.current);
      clearTimeout(lockTimer);
      lockTimer = setTimeout(release, CLICK_LOCK_MS);
    };
    window.addEventListener("nav:lock", onLock);
    window.addEventListener("scrollend", release);

    return () => {
      band.disconnect();
      bottom.disconnect();
      sentinel.remove();
      clearTimeout(lockTimer);
      window.removeEventListener("nav:lock", onLock);
      window.removeEventListener("scrollend", release);
    };
  }, []);

  return active;
}

const lockTo = (id: string) => window.dispatchEvent(new CustomEvent("nav:lock", { detail: id }));

export function Nav() {
  const [open, setOpen] = useState(false);
  const active = useActiveSection();

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 py-3">
      <nav
        aria-label="Main"
        className="glass nav-raise mx-auto flex max-w-6xl items-center justify-between rounded-full !bg-background/85 py-3 pl-[26px] pr-4 backdrop-blur-md md:pl-[30px] md:pr-3"
      >
        <a href="#top" className="group flex items-center">
          <span className="font-display text-lg font-bold tracking-tight">
            Sreehari<span className="text-primary">.</span>dev
          </span>
        </a>

        <ul className="hidden items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                onClick={() => lockTo(l.href.slice(1))}
                aria-current={active === l.href.slice(1) ? "location" : undefined}
                className={cn(
                  "relative text-sm transition-colors duration-200 after:absolute after:-bottom-1 after:left-0 after:h-px after:bg-primary after:transition-all after:duration-200 hover:text-foreground hover:after:w-full",
                  active === l.href.slice(1)
                    ? "text-foreground after:w-full"
                    : "text-muted-foreground after:w-0",
                )}
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden md:block">
          <MagneticButton href={RESUME_URL} download className="px-5 py-2.5 text-xs">
            Resume
          </MagneticButton>
        </div>

        <button
          className="md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="glass mx-auto mt-3 max-w-6xl space-y-1 p-4 md:hidden"
          >
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => {
                    lockTo(l.href.slice(1));
                    setOpen(false);
                  }}
                  aria-current={active === l.href.slice(1) ? "location" : undefined}
                  className={cn(
                    "block rounded-xl px-3 py-2.5 text-sm transition-colors duration-200 hover:bg-secondary hover:text-foreground",
                    active === l.href.slice(1)
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {l.label}
                </a>
              </li>
            ))}
            <li>
              <a
                href={RESUME_URL}
                download
                className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-primary"
              >
                Download Resume
              </a>
            </li>
          </motion.ul>
        )}
      </AnimatePresence>
    </header>
  );
}
