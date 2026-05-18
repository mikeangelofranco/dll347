"use client";

import { FormEvent, startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ThemedLoader } from "@/components/themed-loader";
import {
  ApiError,
  getCurrentAccount,
  getPreidentifiedEmails,
  logoutCurrentSession,
  type PreidentifiedEmailRecord,
  savePreidentifiedEmail,
} from "@/lib/api";

const DEFAULT_PASSWORD = "dll347";

export function PreidentifiedEmailsScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "redirecting">("loading");
  const [accountEmail, setAccountEmail] = useState("");
  const [rows, setRows] = useState<PreidentifiedEmailRecord[]>([]);
  const [email, setEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const account = await getCurrentAccount();
        if (account.role !== "developer") {
          startTransition(() => {
            router.replace("/dashboard");
          });
          setStatus("redirecting");
          return;
        }

        setAccountEmail(account.email);
        const records = await getPreidentifiedEmails();
        setRows(records);
        setStatus("ready");
      } catch {
        startTransition(() => {
          router.replace("/");
        });
        setStatus("redirecting");
      }
    }

    void load();
  }, [router]);

  async function refreshList() {
    setIsRefreshing(true);

    try {
      const records = await getPreidentifiedEmails();
      setRows(records);
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setIsSaving(true);

    try {
      await savePreidentifiedEmail(email, DEFAULT_PASSWORD);
      setEmail("");
      setSuccessMessage("Preidentified email saved.");
      await refreshList();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 403) {
          startTransition(() => {
            router.replace("/");
          });
          setStatus("redirecting");
          return;
        }

        setErrorMessage(error.message);
      } else {
        setErrorMessage("Unable to save the preidentified email right now.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLogout() {
    try {
      await logoutCurrentSession();
    } finally {
      router.replace("/");
    }
  }

  if (status !== "ready") {
    return (
      <main className="login-paper flex min-h-screen items-center justify-center px-4">
        <ThemedLoader size="md" />
      </main>
    );
  }

  return (
    <main className="login-paper min-h-screen px-4 py-6 text-[#24160f] sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-3 rounded-[1.75rem] border border-[#f0e3d3] bg-white/88 p-5 shadow-[0_18px_45px_rgba(112,77,21,0.09)] backdrop-blur-[10px] sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[0.8rem] font-semibold uppercase tracking-[0.22em] text-[#b07a17]">
              Developer Access
            </p>
            <h1 className="mt-2 font-[family:var(--font-display-serif)] text-[2rem] leading-none text-[#2b170e] sm:text-[2.4rem]">
              Preidentified Emails
            </h1>
            <p className="mt-2 text-sm text-[#6d625b]">
              Authenticated as {accountEmail}. Only developer accounts can access this screen.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="inline-flex h-11 items-center justify-center rounded-full border border-[#eadbc8] bg-[#fffaf4] px-5 text-sm font-semibold text-[#5d4b3f]"
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#cb0000_0%,#b00000_100%)] px-5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(176,0,0,0.18)]"
            >
              Sign out
            </button>
          </div>
        </div>

        <section className="mt-6 rounded-[1.75rem] border border-[#f0e3d3] bg-white/90 p-5 shadow-[0_18px_45px_rgba(112,77,21,0.08)] backdrop-blur-[10px]">
          <h2 className="text-lg font-bold text-[#2b170e]">Add preidentified email</h2>
          <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#4d382d]">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="member@example.com"
                required
                disabled={isSaving}
                className="h-12 w-full rounded-[1rem] border border-[#e6d8c7] bg-[#fffdfa] px-4 outline-none transition focus:border-[#cf8c00]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#4d382d]">Default password</span>
              <input
                type="text"
                value={DEFAULT_PASSWORD}
                readOnly
                className="h-12 w-full rounded-[1rem] border border-[#e6d8c7] bg-[#f8f2ea] px-4 text-[#7a6556] outline-none"
              />
            </label>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex h-12 min-w-36 items-center justify-center rounded-full bg-[linear-gradient(180deg,#cf8c00_0%,#b97c00_100%)] px-6 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(185,124,0,0.22)] disabled:opacity-70"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>

          <div className="mt-4 min-h-6 text-sm">
            {errorMessage ? <p className="text-[#b00000]">{errorMessage}</p> : null}
            {!errorMessage && successMessage ? <p className="text-[#356722]">{successMessage}</p> : null}
          </div>
        </section>

        <section className="mt-6 rounded-[1.75rem] border border-[#f0e3d3] bg-white/90 p-5 shadow-[0_18px_45px_rgba(112,77,21,0.08)] backdrop-blur-[10px]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#2b170e]">Current list</h2>
              <p className="mt-1 text-sm text-[#6d625b]">
                The table refreshes immediately after each save.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                void refreshList();
              }}
              disabled={isRefreshing}
              className="inline-flex h-10 items-center justify-center rounded-full border border-[#eadbc8] bg-[#fffaf4] px-4 text-sm font-semibold text-[#5d4b3f] disabled:opacity-70"
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-[1.2rem] border border-[#eadbc8]">
            <table className="min-w-full border-collapse">
              <thead className="bg-[#f8f2ea] text-left text-sm text-[#5a473b]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Default Password</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-6 text-sm text-[#7a6c63]">
                      No preidentified emails saved yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-t border-[#f1e7db] bg-white text-sm">
                      <td className="px-4 py-3 text-[#24160f]">{row.email}</td>
                      <td className="px-4 py-3 font-mono text-[#7d2218]">{row.default_password}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
