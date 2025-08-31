"use client";

import { FormEvent, useEffect, useState } from "react";
import { httpClient } from "@/shared/api/httpClient";
import { useAuth } from "@/shared/auth/useAuth";
import { X } from "lucide-react";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

export default function LoginModal({ open, onClose }: LoginModalProps) {
  const { login: authLogin } = useAuth();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (open) {
      setMode("login");
      setError("");
      setMessage("");
      setEmail("");
      setPassword("");
    }
  }, [open]);

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
      const data = await res.json().catch(() => ({}));
      if (data?.role) {
        authLogin(data.role.toLowerCase());
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded border-2 border-bodaghee-accent bg-bodaghee-bg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute right-2 top-2 text-bodaghee-accent"
        >
          <X className="h-6 w-6" />
        </button>
        {mode === "login" && (
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
            <div className="flex items-center gap-4">
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
            </div>
          </form>
        )}
        {mode === "forgot" && (
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
