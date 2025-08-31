"use client";

import { FormEvent, useEffect, useState } from "react";
import { httpClient } from "@/shared/api/httpClient";
import { X } from "lucide-react";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

export default function LoginModal({ open, onClose }: LoginModalProps) {
  const [mode, setMode] = useState<"register" | "login" | "forgot">("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (open) {
      setMode("register");
      setError("");
      setMessage("");
    }
  }, [open]);

  if (!open) return null;

  function formatPhone(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    const parts = [] as string[];
    if (digits.length > 0) parts.push(digits.slice(0, 3));
    if (digits.length > 3) parts.push(digits.slice(3, 6));
    if (digits.length > 6) parts.push(digits.slice(6, 8));
    if (digits.length > 8) parts.push(digits.slice(8, 10));
    let result = "+7";
    if (parts[0]) result += " " + parts[0];
    if (parts[1]) result += " " + parts[1];
    if (parts[2]) result += "-" + parts[2];
    if (parts[3]) result += "-" + parts[3];
    return result;
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await httpClient("/auth/register", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone }),
      });
      if (!res.ok) {
        setError("Ошибка регистрации");
        return;
      }
      onClose();
    } catch {
      setError("Ошибка соединения");
    }
  }

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
        {mode === "register" && (
          <form onSubmit={handleRegister} className="flex flex-col gap-4 font-body">
            <input
              type="text"
              placeholder="Имя пользователя"
              value={name}
              onChange={(e) =>
                setName(e.target.value.replace(/[^\p{L}\s]/gu, ""))
              }
              className="rounded border border-bodaghee-accent bg-bodaghee-bg p-2 text-white placeholder:text-white/50"
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded border border-bodaghee-accent bg-bodaghee-bg p-2 text-white placeholder:text-white/50"
            />
            <input
              type="tel"
              placeholder="+7 999 999-99-99"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              className="rounded border border-bodaghee-accent bg-bodaghee-bg p-2 text-white placeholder:text-white/50"
            />
            {error && <p className="text-bodaghee-accent">{error}</p>}
            <button
              type="submit"
              className="rounded border border-bodaghee-accent bg-bodaghee-bg px-4 py-2 text-white transition-colors hover:bg-bodaghee-accent hover:text-bodaghee-bg"
            >
              Зарегистрироваться
            </button>
            <button
              type="button"
              onClick={() => setMode("login")}
              className="text-sm text-bodaghee-accent underline"
            >
              У меня есть пароль
            </button>
          </form>
        )}
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
            <button
              type="button"
              onClick={() => setMode("register")}
              className="text-sm text-bodaghee-accent underline"
            >
              Нет аккаунта?
            </button>
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
