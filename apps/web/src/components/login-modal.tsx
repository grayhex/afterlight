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
  const [mode, setMode] = useState<"main" | "forgot">("main");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regError, setRegError] = useState("");

  const [forgotEmail, setForgotEmail] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (open) {
      setMode("main");
      setLoginEmail("");
      setLoginPassword("");
      setLoginError("");

      setRegName("");
      setRegEmail("");
      setRegPhone("");
      setRegPassword("");
      setRegError("");

      setForgotEmail("");
      setMessage("");
    }
  }, [open]);

  if (!open) return null;

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await httpClient("/auth/login", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      if (!res.ok) {
        setLoginError("Ошибка логина");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data?.role) {
        authLogin(data.role.toLowerCase());
      }
      onClose();
    } catch {
      setLoginError("Ошибка соединения");
    }
  }

  async function handleForgot(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    try {
      const res = await httpClient("/auth/forgot-password", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
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
    setRegError("");
    try {
      const res = await httpClient("/auth/register", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          phone: regPhone,
          password: regPassword,
        }),
      });
      if (!res.ok) {
        setRegError("Ошибка регистрации");
        return;
      }
      const loginRes = await httpClient("/auth/login", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: regEmail, password: regPassword }),
      });
      if (loginRes.ok) {
        const data = await loginRes.json().catch(() => ({}));
        if (data?.role) {
          authLogin(data.role.toLowerCase());
        }
        onClose();
      }
    } catch {
      setRegError("Ошибка соединения");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-xl border border-bodaghee-accent bg-gradient-to-br from-bodaghee-bg to-bodaghee-bg/80 p-8 pt-12 shadow-lg"
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
        {mode === "main" && (
          <div className="flex flex-col gap-8 font-body md:flex-row">
            <form
              onSubmit={handleRegister}
              className="flex w-full flex-col gap-4 md:w-1/2"
            >
              <h2 className="text-2xl font-bold text-white">Регистрация</h2>
              <p className="text-sm text-white/70">
                Создайте новый аккаунт
              </p>
              <input
                type="text"
                placeholder="Имя"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                className="rounded-md border border-white/20 bg-transparent p-3 text-white placeholder:text-white/50 focus:border-bodaghee-accent focus:outline-none"
              />
              <input
                type="email"
                placeholder="Email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                className="rounded-md border border-white/20 bg-transparent p-3 text-white placeholder:text-white/50 focus:border-bodaghee-accent focus:outline-none"
              />
              <InputMask
                mask="+7 (999) 999-99-99"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
              >
                {(inputProps: any) => (
                  <input
                    {...inputProps}
                    type="tel"
                    placeholder="Телефон"
                    className="rounded-md border border-white/20 bg-transparent p-3 text-white placeholder:text-white/50 focus:border-bodaghee-accent focus:outline-none"
                  />
                )}
              </InputMask>
              <input
                type="password"
                placeholder="Пароль"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                className="rounded-md border border-white/20 bg-transparent p-3 text-white placeholder:text-white/50 focus:border-bodaghee-accent focus:outline-none"
              />
              {regError && <p className="text-bodaghee-accent">{regError}</p>}
              <button
                type="submit"
                className="mt-2 rounded-md bg-bodaghee-accent px-4 py-2 font-semibold text-bodaghee-bg transition-colors hover:bg-bodaghee-accent/90"
              >
                Зарегистрироваться
              </button>
            </form>
            <form
              onSubmit={handleLogin}
              className="flex w-full flex-col gap-4 md:w-1/2 md:border-l md:border-bodaghee-accent/20 md:pl-8"
            >
              <h2 className="text-2xl font-bold text-white">Вход</h2>
              <p className="text-sm text-white/70">Уже есть аккаунт? Войдите</p>
              <input
                type="email"
                placeholder="Email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="rounded-md border border-white/20 bg-transparent p-3 text-white placeholder:text-white/50 focus:border-bodaghee-accent focus:outline-none"
              />
              <input
                type="password"
                placeholder="Пароль"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="rounded-md border border-white/20 bg-transparent p-3 text-white placeholder:text-white/50 focus:border-bodaghee-accent focus:outline-none"
              />
              {loginError && <p className="text-bodaghee-accent">{loginError}</p>}
              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="submit"
                  className="rounded-md bg-bodaghee-accent px-4 py-2 font-semibold text-bodaghee-bg transition-colors hover:bg-bodaghee-accent/90"
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
          </div>
        )}
        {mode === "forgot" && (
          <form onSubmit={handleForgot} className="flex flex-col gap-4 font-body">
            <h2 className="text-2xl font-bold text-white">Восстановление</h2>
            <p className="text-sm text-white/70">
              Укажите email для восстановления
            </p>
            <input
              type="email"
              placeholder="Email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              className="rounded-md border border-white/20 bg-transparent p-3 text-white placeholder:text-white/50 focus:border-bodaghee-accent focus:outline-none"
            />
            {message && <p className="text-green-500">{message}</p>}
            <div className="flex items-center gap-4">
              <button
                type="submit"
                className="rounded-md bg-bodaghee-accent px-4 py-2 font-semibold text-bodaghee-bg transition-colors hover:bg-bodaghee-accent/90"
              >
                Отправить
              </button>
              <button
                type="button"
                onClick={() => setMode("main")}
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
