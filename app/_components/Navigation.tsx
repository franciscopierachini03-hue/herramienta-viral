"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/sobre-mi", label: "Sobre mí" },
  { href: "/libros", label: "Libros" },
  { href: "/conferencias", label: "Conferencias" },
  { href: "/blog", label: "Blog" },
  { href: "/prensa", label: "Prensa" },
];

export default function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#070710]/90 backdrop-blur-md border-b border-[#1E1E35]"
          : "bg-transparent"
      }`}
    >
      <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="font-bold text-lg tracking-tight text-white hover:text-[#A78BFA] transition-colors"
        >
          Francisco<span className="text-[#8B5CF6]">.</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm transition-colors ${
                pathname === link.href
                  ? "text-[#A78BFA]"
                  : "text-[#9090A8] hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* CTA + Language */}
        <div className="hidden md:flex items-center gap-4">
          <Link
            href="/en"
            className="text-xs text-[#6B6B8A] hover:text-white transition-colors uppercase tracking-widest"
          >
            EN
          </Link>
          <Link
            href="/#contacto"
            className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-sm font-medium px-5 py-2 rounded-full transition-all duration-200 hover:shadow-[0_0_20px_rgba(139,92,246,0.4)]"
          >
            Contacto
          </Link>
        </div>

        {/* Mobile burger */}
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden flex flex-col gap-1.5 p-2"
          aria-label="Menú"
        >
          <span
            className={`block w-6 h-0.5 bg-white transition-all duration-300 ${open ? "rotate-45 translate-y-2" : ""}`}
          />
          <span
            className={`block w-6 h-0.5 bg-white transition-all duration-300 ${open ? "opacity-0" : ""}`}
          />
          <span
            className={`block w-6 h-0.5 bg-white transition-all duration-300 ${open ? "-rotate-45 -translate-y-2" : ""}`}
          />
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-[#0D0D1A] border-t border-[#1E1E35] px-6 py-6 flex flex-col gap-4">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-base py-1 ${
                pathname === link.href ? "text-[#A78BFA]" : "text-[#9090A8]"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="border-t border-[#1E1E35] pt-4 flex items-center gap-4">
            <Link href="/en" className="text-xs text-[#6B6B8A] uppercase tracking-widest">
              EN
            </Link>
            <Link
              href="/#contacto"
              className="flex-1 text-center bg-[#8B5CF6] text-white text-sm font-medium px-5 py-2.5 rounded-full"
            >
              Contacto
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
