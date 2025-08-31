"use client";

import { useEffect, useState } from "react";
import { httpClient } from "@/shared/api/httpClient";
import { useAuth } from "@/shared/auth/useAuth";
import { AnimatePresence, motion } from "framer-motion";

interface VerificationEvent {
  id: string;
  state: string;
  confirmations?: number;
  denials?: number;
  confirmsCount?: number;
  deniesCount?: number;
}

export default function CabinetPage() {
  const { role } = useAuth();

  if (role === "owner") {
    return <OwnerCabinet />;
  }

  if (role === "verifier") {
    return <VerifierCabinet />;
  }

  return <div className="p-6">Доступ запрещён</div>;
}

function OwnerCabinet() {
  const [vaults, setVaults] = useState<any[]>([]);
  const [vaultsLoading, setVaultsLoading] = useState(false);
  const [vaultsError, setVaultsError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [verifierEmails, setVerifierEmails] = useState<string[]>(["", "", ""]);
  const [quorum, setQuorum] = useState(2);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [verifiers, setVerifiers] = useState<any[]>([]);
  const [verifiersLoading, setVerifiersLoading] = useState(false);
  const [verifiersError, setVerifiersError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    async function loadVaults() {
      setVaultsLoading(true);
      setVaultsError(null);
      try {
        const res = await httpClient("/vaults", { method: "GET" });
        const data = await res.json();
        setVaults(data);
      } catch (e) {
        setVaultsError("Ошибка загрузки");
      } finally {
        setVaultsLoading(false);
      }
    }
    loadVaults();
  }, []);

  useEffect(() => {
    async function loadVerifiers() {
      setVerifiersLoading(true);
      setVerifiersError(null);
      try {
        const res = await httpClient("/verifiers", { method: "GET" });
        const data = await res.json();
        setVerifiers(data);
      } catch (e) {
        setVerifiersError("Ошибка загрузки");
      } finally {
        setVerifiersLoading(false);
      }
    }
    loadVerifiers();
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const body = {
        name,
        description,
        verifiers: verifierEmails,
        quorum,
      };
      const res = await httpClient("/vaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setVaults((v) => [...v, data]);
      setShowModal(false);
      setName("");
      setDescription("");
      setVerifierEmails(["", "", ""]);
      setQuorum(2);
    } catch (e) {
      setCreateError("Ошибка создания");
    } finally {
      setCreating(false);
    }
  };

  const handleInvite = async () => {
    setInviting(true);
    setInviteError(null);
    try {
      const res = await httpClient("/verifiers/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail }),
      });
      const data = await res.json();
      const email =
        data?.invitation?.verifier?.contact || data?.email || inviteEmail;
      setVerifiers((v) => [...v, { email }]);
      setInviteEmail("");
    } catch (e) {
      setInviteError("Ошибка приглашения");
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="p-6 space-y-8 font-body">
      <h1 className="mb-4 text-2xl">Личный кабинет</h1>

      <div>
        <button
          className="rounded border border-bodaghee-accent bg-bodaghee-bg px-4 py-2 text-white transition-colors hover:bg-bodaghee-accent hover:text-bodaghee-bg"
          onClick={() => setShowModal(true)}
        >
          Создать сейф
        </button>
        {vaultsError && (
          <p className="mt-2 text-bodaghee-accent">{vaultsError}</p>
        )}
        {vaultsLoading && <p className="mt-2">Загрузка...</p>}
        {!vaultsLoading && !vaultsError && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <AnimatePresence>
              {vaults.map((v: any, idx: number) => (
                <motion.div
                  key={idx}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="rounded bg-bodaghee-bg p-4 text-white shadow"
                >
                  <div className="font-bold">{v.name}</div>
                  <div className="text-sm text-white/70">{v.description}</div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-xl">Верификаторы</h2>
        {verifiersError && (
          <p className="mt-2 text-bodaghee-accent">{verifiersError}</p>
        )}
        {verifiersLoading && <p className="mt-2">Загрузка...</p>}
        {!verifiersLoading && !verifiersError && (
          <div className="grid gap-4 md:grid-cols-2">
            <AnimatePresence>
              {verifiers.map((v: any, idx: number) => (
                <motion.div
                  key={idx}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="rounded bg-bodaghee-bg p-4 text-white shadow"
                >
                  {v.email || v.verifier?.contact}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            className="flex-grow rounded border border-bodaghee-accent bg-bodaghee-bg p-2 text-white placeholder:text-white/50 transition-colors focus:border-bodaghee-accent"
            placeholder="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <button
            className="rounded border border-bodaghee-accent bg-bodaghee-bg px-4 py-2 text-white transition-colors hover:bg-bodaghee-accent hover:text-bodaghee-bg"
            onClick={handleInvite}
            disabled={inviting}
          >
            Пригласить
          </button>
        </div>
        {inviteError && (
          <p className="mt-2 text-bodaghee-accent">{inviteError}</p>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 flex items-center justify-center bg-bodaghee-bg/50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg rounded bg-bodaghee-bg p-6 text-white"
            >
              <h2 className="mb-4 text-xl">Новый сейф</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  className="col-span-full rounded border border-bodaghee-accent bg-bodaghee-bg p-2 text-white placeholder:text-white/50 transition-colors focus:border-bodaghee-accent"
                  placeholder="Название сейфа"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <textarea
                  className="col-span-full rounded border border-bodaghee-accent bg-bodaghee-bg p-2 text-white placeholder:text-white/50 transition-colors focus:border-bodaghee-accent"
                  placeholder="Описани (необязательно)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                {verifierEmails.map((email, idx) => (
                  <input
                    key={idx}
                    type="email"
                    className="rounded border border-bodaghee-accent bg-bodaghee-bg p-2 text-white placeholder:text-white/50 transition-colors focus:border-bodaghee-accent"
                    placeholder={`Верификатор ${idx + 1} (e-mail)`}
                    value={email}
                    onChange={(e) => {
                      const next = [...verifierEmails];
                      next[idx] = e.target.value;
                      setVerifierEmails(next);
                    }}
                  />
                ))}
                <p className="col-span-full text-sm text-white/70">
                  Добавьте три человека, которым вы доверяете. Доступ откроется при подтверждении двух из них.
                </p>
                <input
                  type="number"
                  min={1}
                  max={3}
                  className="col-span-full rounded border border-bodaghee-accent bg-bodaghee-bg p-2 text-white transition-colors focus:border-bodaghee-accent"
                  value={quorum}
                  onChange={(e) => setQuorum(Number(e.target.value))}
                />
              </div>
              {createError && (
                <p className="mt-2 text-bodaghee-accent">{createError}</p>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  className="rounded border border-bodaghee-accent px-4 py-2 text-white transition-colors hover:bg-bodaghee-accent hover:text-bodaghee-bg"
                  onClick={() => setShowModal(false)}
                >
                  Отмена
                </button>
                <button
                  className="rounded border border-bodaghee-accent bg-bodaghee-bg px-4 py-2 text-white transition-colors hover:bg-bodaghee-accent hover:text-bodaghee-bg"
                  onClick={handleCreate}
                  disabled={creating}
                >
                  Создать
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function VerifierCabinet() {
  const [events, setEvents] = useState<VerificationEvent[]>([]);

  useEffect(() => {
    httpClient("/verification-events", { method: "GET" })
      .then((res) => res.json())
      .then(setEvents)
      .catch(() => {});
  }, []);

  const updateEvent = (evt: VerificationEvent) => {
    setEvents((prev) => prev.map((e) => (e.id === evt.id ? evt : e)));
  };

  const handleAction = async (id: string, action: "confirm" | "deny") => {
    const res = await httpClient(`/verification-events/${id}/${action}`, {
      method: "POST",
    });

    if (res.status === 403 || res.status === 404) {
      alert(res.status === 403 ? "Доступ запрещён" : "Событие не найдено");
      return;
    }

    const data = await res.json();
    updateEvent(data);
  };

  const renderCounters = (e: VerificationEvent) => {
    const confirms = e.confirmsCount ?? e.confirmations ?? 0;
    const denies = e.deniesCount ?? e.denials ?? 0;
    return (
      <div className="text-sm text-white/70">
        Подтверждения: {confirms} / Отказы: {denies}
      </div>
    );
  };

  const statusMap: Record<string, { label: string; color: string }> = {
    pending: { label: "ожидает", color: "bg-bodaghee-accent" },
    confirmed: { label: "подтверждено", color: "bg-white" },
  };

  return (
    <div className="p-6 space-y-4 font-body">
      <h1 className="mb-2 text-2xl">Кабинет верификатора</h1>
      <p className="text-sm text-white/70">
        Требуется 2 подтверждения из 3. Публичная ссылка активна 24 часа.
      </p>
      <div className="space-y-4">
        <AnimatePresence>
          {events.map((e) => {
            const status = statusMap[e.state] || {
              label: e.state,
              color: "bg-gray-400",
            };
            return (
              <motion.div
                key={e.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-2 rounded bg-bodaghee-bg p-4 text-white shadow"
              >
                <div className="font-mono text-sm">ID: {e.id}</div>
                <div className="flex items-center gap-2">
                  <span className={`h-3 w-3 rounded-full ${status.color}`} />
                  <span>{status.label}</span>
                </div>
                {renderCounters(e)}
                <div className="space-x-2">
                  <button
                    onClick={() => handleAction(e.id, "confirm")}
                    className="rounded border border-bodaghee-accent bg-bodaghee-bg px-2 py-1 text-white transition-colors hover:bg-bodaghee-accent hover:text-bodaghee-bg"
                  >
                    Подтвердить
                  </button>
                  <button
                    onClick={() => handleAction(e.id, "deny")}
                    className="rounded border border-bodaghee-accent bg-bodaghee-bg px-2 py-1 text-white transition-colors hover:bg-bodaghee-accent hover:text-bodaghee-bg"
                  >
                    Отклонить
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

