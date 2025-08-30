"use client";

import { useEffect, useState } from "react";
import { httpClient } from "@/shared/api/httpClient";
import { useAuth } from "@/shared/auth/useAuth";

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
    <div className="p-6">
      <h1 className="mb-4 text-2xl">Личный кабинет</h1>

      <div className="mb-4">
        <button
          className="rounded bg-bodaghee-teal px-4 py-2 text-bodaghee-navy"
          onClick={() => setShowModal(true)}
        >
          Новый сейф
        </button>
      </div>

      {vaultsLoading && <p>Загрузка...</p>}
        {vaultsError && <p className="text-bodaghee-lime">{vaultsError}</p>}
      {!vaultsLoading && !vaultsError && (
        <table className="min-w-full border text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2 text-left">ID</th>
              <th className="p-2 text-left">Название</th>
              <th className="p-2 text-left">Описание</th>
            </tr>
          </thead>
          <tbody>
            {vaults.map((v: any) => (
              <tr key={v.id} className="border-b">
                <td className="p-2">{v.id}</td>
                <td className="p-2">{v.name}</td>
                <td className="p-2">{v.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-8">
        <h2 className="mb-2 text-xl">Верификаторы</h2>
        {verifiersLoading && <p>Загрузка...</p>}
        {verifiersError && <p className="text-bodaghee-lime">{verifiersError}</p>}
        {!verifiersLoading && !verifiersError && (
          <ul className="mb-4 list-disc pl-5">
            {verifiers.map((v: any, idx: number) => (
              <li key={idx}>{v.email || v.verifier?.contact}</li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          <input
            type="email"
            className="flex-grow border p-2 text-bodaghee-navy"
            placeholder="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <button
            className="rounded bg-bodaghee-teal px-4 py-2 text-bodaghee-navy"
            onClick={handleInvite}
            disabled={inviting}
          >
            Пригласить
          </button>
        </div>
          {inviteError && <p className="mt-2 text-bodaghee-lime">{inviteError}</p>}
      </div>

      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-bodaghee-navy/50">
          <div className="w-full max-w-md rounded bg-bodaghee-teal p-6 text-bodaghee-navy">
            <h2 className="mb-4 text-xl">Новый сейф</h2>
            <div className="space-y-2">
                <input
                  className="w-full border p-2 text-bodaghee-navy"
                  placeholder="Название сейфа"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              <textarea
                className="w-full border p-2 text-bodaghee-navy"
                placeholder="Описание (необязательно)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              {verifierEmails.map((email, idx) => (
                <input
                  key={idx}
                  type="email"
                  className="w-full border p-2 text-bodaghee-navy"
                  placeholder={`Верификатор ${idx + 1} (e-mail)`}
                  value={email}
                  onChange={(e) => {
                    const next = [...verifierEmails];
                    next[idx] = e.target.value;
                    setVerifierEmails(next);
                  }}
                />
              ))}
              <p className="text-sm text-bodaghee-navy/70">
                Добавьте три человека, которым вы доверяете. Доступ откроется при
                подтверждении двух из них.
              </p>
              <input
                type="number"
                min={1}
                max={3}
                className="w-full border p-2 text-bodaghee-navy"
                value={quorum}
                onChange={(e) => setQuorum(Number(e.target.value))}
              />
            </div>
              {createError && <p className="mt-2 text-bodaghee-lime">{createError}</p>}
            <div className="mt-4 flex justify-end gap-2">
                <button className="px-4 py-2" onClick={() => setShowModal(false)}>
                  Отмена
                </button>
                <button
                className="rounded bg-bodaghee-teal px-4 py-2 text-bodaghee-navy"
                onClick={handleCreate}
                disabled={creating}
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

