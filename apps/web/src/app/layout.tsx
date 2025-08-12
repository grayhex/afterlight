import "./../styles/globals.css";
import { ReactNode } from "react";

export const metadata = {
  title: "AfterLight — Wireframes",
  description: "Clickable wireframes prototype"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <nav className="nav">
          <div className="container-narrow flex items-center justify-between h-14">
            <a className="font-semibold" href="/wireframes">AfterLight</a>
            <div className="flex gap-2">
              <a className="btn" href="/wireframes">Вайрфреймы</a>
              <a className="btn" href="/wireframes/owner">Кабинет владельца</a>
              <a className="btn" href="/wireframes/verifier">Кабинет верификатора</a>
              <a className="btn" href="/wireframes/recipient">Вид получателя</a>
              <a className="btn" href="/wireframes/demo">Демо</a>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
