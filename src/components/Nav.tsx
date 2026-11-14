import Link from "next/link";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/rankings", label: "Rankings" },
  { href: "/predictions", label: "Predictions" },
  { href: "/cfp", label: "CFP Projection" },
  { href: "/custom", label: "Build Your Own" },
];

export function Nav() {
  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-4">
        <Link href="/" className="font-semibold tracking-tight">
          CFP Stats
        </Link>
        <div className="flex gap-4 text-sm text-neutral-600 dark:text-neutral-300">
          {LINKS.slice(1).map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
