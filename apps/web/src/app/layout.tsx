import "./globals.css";
import type { ReactNode } from "react";
import Header from "../components/Header";
import Navigation from "../components/Navigation";
import Footer from "../components/Footer";

export const metadata = {
  title: "AfterLight",
  description: "MVP UI",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body
        className="flex min-h-screen flex-col text-slate-100"
        style={{ backgroundColor: "var(--brand-bg, #0e1116)" }}
      >
        <Header />
        <Navigation />
        <main
          className="flex-1"
          style={{
            backgroundColor: "var(--brand-bg, #0e1116)",
            backgroundImage:
              "radial-gradient(1000px 500px at 75% 10%, rgba(56,189,248,0.10), transparent)",
          }}
        >
          <div className="container py-4">{children}</div>
        </main>
        <Footer />
      </body>
    </html>
  );
}
