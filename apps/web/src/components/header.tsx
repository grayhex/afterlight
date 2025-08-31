"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/shared/auth/useAuth";
import {
  User,
  ShieldCheck,
  LogIn,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { motion } from "framer-motion";

export default function Header() {
  const { role } = useAuth();
  const [open, setOpen] = useState(false);

  const mainLinks = [
    {
      href: "/owner",
      label: "Кабинет пользователя",
      icon: <User className="h-4 w-4 text-bodaghee-accent" />,
    },
    {
      href: "/verifier",
      label: "Кабинет верификатора",
      icon: <ShieldCheck className="h-4 w-4 text-bodaghee-accent" />,
    },
  ];

  const authLinks =
    role === "guest"
      ? [{ href: "/login", label: "Войти", icon: <LogIn className="h-4 w-4" /> }]
      : [{ href: "/logout", label: "Выйти", icon: <LogOut className="h-4 w-4" /> }];

  const NavItem = ({
    href,
    label,
    icon,
  }: { href: string; label: string; icon: ReactNode }) => (
    <motion.div
      className="relative flex items-center gap-1"
      initial="rest"
      whileHover="hover"
      animate="rest"
    >
      <Link
        href={href}
        className="flex items-center gap-1 text-sm font-body uppercase text-white"
      >
        {icon}
        <span>{label}</span>
      </Link>
      <motion.span
        variants={{ rest: { scaleX: 0 }, hover: { scaleX: 1 } }}
        transition={{ duration: 0.3 }}
        className="absolute left-0 -bottom-0.5 h-px w-full origin-left bg-bodaghee-accent"
      />
    </motion.div>
  );

  return (
    <header className="sticky top-0 z-50 bg-bodaghee-bg/80 border-b border-bodaghee-accent">
      <nav className="container mx-auto flex items-center justify-between p-4">
        <Link href="/" className="text-xl font-bold text-white">
          Afterlight
        </Link>
        <div className="hidden flex-1 justify-center gap-6 md:flex">
          {mainLinks.map((l) => (
            <NavItem key={l.href} {...l} />
          ))}
        </div>
        <div className="hidden gap-6 md:flex">
          {authLinks.map((l) => (
            <NavItem key={l.href} {...l} />
          ))}
        </div>
        <button
          className="md:hidden"
          aria-label="Toggle menu"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? (
            <X className="h-6 w-6 text-white" />
          ) : (
            <Menu className="h-6 w-6 text-white" />
          )}
        </button>
      </nav>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="md:hidden bg-bodaghee-bg/80"
        >
          <div className="container mx-auto flex flex-col items-center gap-4 p-4">
            {[...mainLinks, ...authLinks].map((l) => (
              <NavItem key={l.href} {...l} />
            ))}
          </div>
        </motion.div>
      )}
    </header>
  );
}

