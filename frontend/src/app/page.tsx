"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { LoginScreen } from "@/components/login-screen";
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
        <Image
          src="/branding/dll347-logo.png"
          alt="Datu Lapu-Lapu Lodge No. 347 logo"
          width={220}
          height={220}
          priority
          className="dll347-launch-logo h-auto w-[clamp(8.5rem,42vw,13.75rem)] drop-shadow-[0_10px_18px_rgba(143,90,16,0.24)]"
        />
      </main>
    );
  }

  return <LoginScreen />;
}
