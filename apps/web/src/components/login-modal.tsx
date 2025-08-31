"use client";

import { FormEvent, useEffect, useState } from "react";
import InputMask from "react-input-mask";
import { httpClient } from "@/shared/api/httpClient";
import { useAuth } from "@/shared/auth/useAuth";
import { X } from "lucide-react";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

export default function LoginModal({ open, onClose }: LoginModalProps) {
  const { login: authLogin } = useAuth();
  const [mode, setMode] = useState<"login" | "forgot" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (open) {
      setMode("login");
      setError("");
      setMessage("");
      setEmail("");
      setPassword("");
      setName("");
      setPhone("");
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

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await httpClient("/auth/register", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, password }),
      });
      if (!res.ok) {
        setError("Ошибка регистрации");
        return;
      }
      const loginRes = await httpClient("/auth/login", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (loginRes.ok) {
        const data = await loginRes.json().catch(() => ({}));
        if (data?.role) {
          authLogin(data.role.toLowerCase());
        }
        onClose();
      }
    } catch {
      setError("Ошибка соединения");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-lg border border-bodaghee-accent bg-bodaghee-bg p-8 pt-10 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute right-4 top-4 text-bodaghee-accent"
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
              className="rounded-md border border-bodaghee-accent/50 bg-bodaghee-bg p-3 text-white placeholder:text-white/50 focus:border-bodaghee-accent focus:outline-none"
            />
            <input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-bodaghee-accent/50 bg-bodaghee-bg p-3 text-white placeholder:text-white/50 focus:border-bodaghee-accent focus:outline-none"
            />
            {error && <p className="text-bodaghee-accent">{error}</p>}
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="submit"
                className="rounded-md border border-bodaghee-accent bg-transparent px-4 py-2 text-white transition-colors hover:bg-bodaghee-accent hover:text-bodaghee-bg"
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
              <button
                type="button"
                onClick={() => setMode("register")}
                className="text-sm text-bodaghee-accent underline"
              >
                Регистрация
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
              className="rounded-md border border-bodaghee-accent/50 bg-bodaghee-bg p-3 text-white placeholder:text-white/50 focus:border-bodaghee-accent focus:outline-none"
            />
            {message && <p className="text-green-500">{message}</p>}
            <div className="flex items-center gap-4">
              <button
                type="submit"
                className="rounded-md border border-bodaghee-accent bg-transparent px-4 py-2 text-white transition-colors hover:bg-bodaghee-accent hover:text-bodaghee-bg"
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
        {mode === "register" && (
          <form onSubmit={handleRegister} className="flex flex-col gap-4 font-body">
            <input
              type="text"
              placeholder="Имя"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-bodaghee-accent/50 bg-bodaghee-bg p-3 text-white placeholder:text-white/50 focus:border-bodaghee-accent focus:outline-none"
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-bodaghee-accent/50 bg-bodaghee-bg p-3 text-white placeholder:text-white/50 focus:border-bodaghee-accent focus:outline-none"
            />
            <InputMask
              mask="+7 (999) 999-99-99"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            >
              {(inputProps: any) => (
                <input
                  {...inputProps}
                  type="tel"
                  placeholder="Телефон"
                  className="rounded-md border border-bodaghee-accent/50 bg-bodaghee-bg p-3 text-white placeholder:text-white/50 focus:border-bodaghee-accent focus:outline-none"
                />
              )}
            </InputMask>
            <input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-bodaghee-accent/50 bg-bodaghee-bg p-3 text-white placeholder:text-white/50 focus:border-bodaghee-accent focus:outline-none"
            />
            {error && <p className="text-bodaghee-accent">{error}</p>}
            <div className="flex items-center gap-4">
              <button
                type="submit"
                className="rounded-md border border-bodaghee-accent bg-transparent px-4 py-2 text-white transition-colors hover:bg-bodaghee-accent hover:text-bodaghee-bg"
              >
                Зарегистрироваться
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
