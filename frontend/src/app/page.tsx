"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { LoginScreen } from "@/components/login-screen";
import { ThemedLoader } from "@/components/themed-loader";
import { ApiError, getCurrentAccount } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "show-login">("loading");

  useEffect(() => {
    async function resolveEntry() {
      try {
        await getCurrentAccount();
        router.replace("/dashboard");
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          setStatus("show-login");
          return;
        }

        setStatus("show-login");
      }
    }

    void resolveEntry();
  }, [router]);

  if (status === "loading") {
    return (
      <main className="login-paper flex h-[100svh] items-center justify-center">
        <ThemedLoader size="md" />
      </main>
    );
  }

  return <LoginScreen />;
}
