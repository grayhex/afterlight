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
      <h1 className="text-2xl font-bold mb-4">Личный кабинет</h1>

      <div className="mb-4">
        <button
          className="rounded bg-blue-600 px-4 py-2 text-white"
          onClick={() => setShowModal(true)}
        >
          Новый сейф
        </button>
      </div>

      {vaultsLoading && <p>Загрузка...</p>}
      {vaultsError && <p className="text-red-500">{vaultsError}</p>}
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
        <h2 className="text-xl font-bold mb-2">Верификаторы</h2>
        {verifiersLoading && <p>Загрузка...</p>}
        {verifiersError && <p className="text-red-500">{verifiersError}</p>}
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
            className="border p-2 flex-grow"
            placeholder="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <button
            className="rounded bg-blue-600 px-4 py-2 text-white"
            onClick={handleInvite}
            disabled={inviting}
          >
            Пригласить
          </button>
        </div>
        {inviteError && <p className="text-red-500 mt-2">{inviteError}</p>}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Новый сейф</h2>
            <div className="space-y-2">
              <input
                className="w-full border p-2"
                placeholder="Название сейфа"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <textarea
                className="w-full border p-2"
                placeholder="Описание (необязательно)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              {verifierEmails.map((email, idx) => (
                <input
                  key={idx}
                  type="email"
                  className="w-full border p-2"
                  placeholder={`Верификатор ${idx + 1} (e-mail)`}
                  value={email}
                  onChange={(e) => {
                    const next = [...verifierEmails];
                    next[idx] = e.target.value;
                    setVerifierEmails(next);
                  }}
                />
              ))}
              <p className="text-sm text-gray-600">
                Добавьте три человека, которым вы доверяете. Доступ откроется при
                подтверждении двух из них.
              </p>
              <input
                type="number"
                min={1}
                max={3}
                className="w-full border p-2"
                value={quorum}
                onChange={(e) => setQuorum(Number(e.target.value))}
              />
            </div>
            {createError && <p className="text-red-500 mt-2">{createError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-4 py-2" onClick={() => setShowModal(false)}>
                Отмена
              </button>
              <button
                className="rounded bg-blue-600 px-4 py-2 text-white"
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

