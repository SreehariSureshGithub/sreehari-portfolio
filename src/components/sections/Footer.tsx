import { Github, Linkedin, Mail } from "lucide-react";
import { EMAIL, GITHUB, LINKEDIN, ROLES } from "@/data/portfolio";

export function Footer() {
  return (
    <footer className="relative border-t border-border pb-24 pt-12 md:pb-36">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-5 text-center">
        <div>
          <p className="font-display text-lg font-bold text-foreground">Sreehari Suresh</p>
          <p className="mt-1 text-sm text-muted-foreground">{ROLES.join(" · ")}</p>
        </div>

        <div className="flex gap-3">
          {[
            { href: GITHUB, Icon: Github, label: "GitHub" },
            { href: LINKEDIN, Icon: Linkedin, label: "LinkedIn" },
            { href: `mailto:${EMAIL}`, Icon: Mail, label: "Email" },
          ].map(({ href, Icon, label }) => (
            <a
              key={label}
              href={href}
              target={href.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
              aria-label={label}
              className="glass grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition-colors duration-300 hover:text-primary"
            >
              <Icon className="h-4 w-4" />
            </a>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Sreehari Suresh · Built with React + Tailwind + Framer Motion
        </p>
      </div>
    </footer>
  );
}
