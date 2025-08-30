"use client";

import { useEffect, useState } from "react";
import { httpClient } from "@/shared/api/httpClient";
import { useAuth } from "@/shared/auth/useAuth";
import { AnimatePresence, motion } from "framer-motion";

export default function OwnerPage() {
  const { role } = useAuth();
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
    if (role !== "owner") return;
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
  }, [role]);

  useEffect(() => {
    if (role !== "owner") return;
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
  }, [role]);

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
      const email = data?.invitation?.verifier?.contact || data?.email || inviteEmail;
      setVerifiers((v) => [...v, { email }]);
      setInviteEmail("");
    } catch (e) {
      setInviteError("Ошибка приглашения");
    } finally {
      setInviting(false);
    }
  };
  if (role !== "owner") {
    return <div className="p-6">Доступ запрещён</div>;
  }

  return (
    <div className="p-6 space-y-8 font-body">
      <h1 className="mb-4 text-2xl">Личный кабинет</h1>

      <div>
        <button
          className="rounded border border-bodaghee-accent bg-bodaghee-bg px-4 py-2 text-white transition-colors hover:bg-bodaghee-accent hover:text-bodaghee-bg"
          onClick={() => setShowModal(true)}
        >
          Новый сейф
        </button>
      </div>

      {vaultsLoading && <p>Загрузка...</p>}
      {vaultsError && <p className="text-bodaghee-accent">{vaultsError}</p>}
      {!vaultsLoading && !vaultsError && (
        <div className="grid gap-4 md:grid-cols-2">
          <AnimatePresence>
            {vaults.map((v: any) => (
              <motion.div
                key={v.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="rounded bg-bodaghee-bg p-4 text-white shadow"
              >
                <div className="font-bold">{v.name || v.id}</div>
                {v.description && <div className="text-sm">{v.description}</div>}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-xl">Верификаторы</h2>
        {verifiersLoading && <p>Загрузка...</p>}
        {verifiersError && <p className="text-bodaghee-accent">{verifiersError}</p>}
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
        {inviteError && <p className="mt-2 text-bodaghee-accent">{inviteError}</p>}
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
                  placeholder="Описание (необязательно)"
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
              {createError && <p className="mt-2 text-bodaghee-accent">{createError}</p>}
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

