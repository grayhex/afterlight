"use client";

import { FormEvent, useState } from "react";
import { httpClient } from "@/shared/api/httpClient";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

export default function LoginModal({ open, onClose }: LoginModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [message, setMessage] = useState("");

  if (!open) return null;

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await httpClient("/auth/login", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError("Ошибка логина");
        return;
      }
      onClose();
    } catch {
      setError("Ошибка соединения");
    }
  }

  async function handleForgot(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    try {
      const res = await httpClient("/auth/forgot-password", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setMessage("Письмо отправлено");
      }
    } catch {
      // ignore
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm rounded bg-bodaghee-bg p-6">
        {mode === "login" ? (
          <form onSubmit={handleLogin} className="flex flex-col gap-4 font-body">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded border border-bodaghee-accent bg-bodaghee-bg p-2 text-white placeholder:text-white/50"
            />
            <input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded border border-bodaghee-accent bg-bodaghee-bg p-2 text-white placeholder:text-white/50"
            />
            {error && <p className="text-bodaghee-accent">{error}</p>}
            <button
              type="submit"
              className="rounded border border-bodaghee-accent bg-bodaghee-bg px-4 py-2 text-white transition-colors hover:bg-bodaghee-accent hover:text-bodaghee-bg"
            >
              Войти
            </button>
            <button
              type="button"
              onClick={() => setMode("forgot")}
              className="text-sm text-bodaghee-accent underline"
            >
              Восстановить пароль
            </button>
          </form>
        ) : (
          <form onSubmit={handleForgot} className="flex flex-col gap-4 font-body">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded border border-bodaghee-accent bg-bodaghee-bg p-2 text-white placeholder:text-white/50"
            />
            {message && <p className="text-green-500">{message}</p>}
            <div className="flex items-center gap-4">
              <button
                type="submit"
                className="rounded border border-bodaghee-accent bg-bodaghee-bg px-4 py-2 text-white transition-colors hover:bg-bodaghee-accent hover:text-bodaghee-bg"
              >
                Отправить
              </button>
              <button
                type="button"
                onClick={() => setMode("login")}
                className="text-sm text-bodaghee-accent underline"
              >
                Назад
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
