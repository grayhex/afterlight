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
      <body className="flex min-h-screen flex-col">
        <Header />
        <Navigation />
        <main className="container flex-1 py-4">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
