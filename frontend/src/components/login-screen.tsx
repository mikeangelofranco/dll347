"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useEffect, useState } from "react";

import {
  ApiError,
  loginWithEmailPassword,
  requestPasswordReset,
  setupPassword,
} from "@/lib/api";
import { ThemedLoader } from "@/components/themed-loader";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const INSTALL_PROMPT_DISMISSED_KEY = "dll347_install_prompt_dismissed_v1";

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M3.75 6.75h16.5a.75.75 0 0 1 .75.75v9a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 16.5v-9a.75.75 0 0 1 .75-.75Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="m4.5 8.25 6.713 5.057a1.35 1.35 0 0 0 1.574 0L19.5 8.25"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M7.5 10.5V8.625a4.5 4.5 0 1 1 9 0V10.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <rect
        x="4.5"
        y="10.5"
        width="15"
        height="10.5"
        rx="2.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M12 14.625a1.875 1.875 0 0 0-.938 3.5v.75h1.876v-.75a1.875 1.875 0 0 0-.938-3.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7">
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <path
        d="M12 10.4v5.2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
      <circle cx="12" cy="7.25" r="1.1" fill="currentColor" />
    </svg>
  );
}

function BackArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4.5 w-4.5">
      <path
        d="M14.75 5.75 8.5 12l6.25 6.25"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function EyeIcon({ crossed = false }: { crossed?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M2.25 12s3.75-6 9.75-6 9.75 6 9.75 6-3.75 6-9.75 6-9.75-6-9.75-6Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle
        cx="12"
        cy="12"
        r="2.75"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      {crossed ? (
        <path
          d="M4.5 19.5 19.5 4.5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
      ) : null}
    </svg>
  );
}

function Divider() {
  return (
    <div className="flex items-center justify-center gap-3 text-[#d69a10]">
      <span className="h-px w-18 bg-current/90 sm:w-24" />
      <span className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-current" />
      <span className="h-px w-18 bg-current/90 sm:w-24" />
    </div>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M12 2.75 13.9 8.1 19.25 10 13.9 11.9 12 17.25 10.1 11.9 4.75 10 10.1 8.1 12 2.75Z"
        fill="currentColor"
      />
      <path
        d="M18.4 15.4 19 17.2l1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6.6-1.8Z"
        fill="currentColor"
      />
    </svg>
  );
}

function BackgroundSymbols() {
  return (
    <>
      <svg
        aria-hidden="true"
        viewBox="0 0 260 360"
        className="pointer-events-none absolute left-[-4.5rem] top-[5rem] w-[12rem] opacity-[0.08] md:left-[-1rem] md:top-[6rem] md:w-[16rem]"
      >
        <g fill="none" stroke="currentColor" strokeWidth="3" className="text-[#d8b47f]">
          <circle cx="74" cy="54" r="28" />
          <circle cx="74" cy="54" r="13" />
          <path d="M74 82 33 208" />
          <path d="M74 82 115 208" />
          <path d="M61 126 20 247" />
          <path d="M87 126 128 247" />
          <path d="M21 247 74 301l53-54" />
          <path d="M85 228 195 120" />
          <path d="m119 228 90 90" />
          <path d="M176 135 85 226" />
          {Array.from({ length: 11 }).map((_, index) => (
            <path
              key={index}
              d={`M${134 + index * 8} ${206 - index * 8} l8 8`}
            />
          ))}
        </g>
      </svg>
      <svg
        aria-hidden="true"
        viewBox="0 0 240 420"
        className="pointer-events-none absolute right-[-4.5rem] top-[5.5rem] w-[11rem] opacity-[0.08] md:right-0 md:top-[7rem] md:w-[14rem]"
      >
        <g fill="none" stroke="currentColor" strokeWidth="3" className="text-[#d8b47f]">
          <path d="M28 52h184" />
          <path d="M38 52 120 5l82 47" />
          <path d="M55 68h130" />
          <path d="M65 68v240" />
          <path d="M98 68v240" />
          <path d="M142 68v240" />
          <path d="M175 68v240" />
          <path d="M47 308h146" />
          <path d="M32 332h176" />
          <path d="M18 362h204" />
          <path d="M75 100v142" />
          <path d="M87 100v142" />
          <path d="M153 100v142" />
          <path d="M165 100v142" />
        </g>
      </svg>
    </>
  );
}

function FooterArc() {
  return (
    <div className="relative mt-2 pb-1 pt-6 text-center">
      <svg
        aria-hidden="true"
        viewBox="0 0 390 86"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 top-[-1.2rem] z-20 h-[3rem] w-full"
      >
        <path
          d="M0 84C94 49 296 49 390 84"
          fill="none"
          stroke="#d8a11a"
          strokeWidth="2"
        />
      </svg>

      <p className="relative z-10 pt-1 font-[family:var(--font-display-serif)] text-[0.92rem] text-[#2e160e] sm:text-[1.08rem]">
        Datu Lapu-Lapu Masonic Lodge No. 347
      </p>
      <p className="relative z-10 mt-1 text-[0.78rem] text-[#6f6763] sm:text-[0.9rem]">
        Copyright 2026 All rights reserved.
      </p>
    </div>
  );
}

function StatusModal({
  open,
  title,
  message,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#2b160d]/28 px-5 backdrop-blur-[2px]">
      <div className="w-full max-w-[19rem] rounded-[1.6rem] border border-[#f0d9b8] bg-[linear-gradient(180deg,rgba(255,251,245,0.98)_0%,rgba(252,246,238,0.98)_100%)] p-5 text-center shadow-[0_24px_60px_rgba(86,45,8,0.18)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,#ffebad_0%,#e0a11a_55%,#b27705_100%)] shadow-[0_8px_18px_rgba(176,128,16,0.22)]">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7 text-white">
            <path
              d="m5.5 12.5 4.2 4.2L18.5 8"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.2"
            />
          </svg>
        </div>
        <h3 className="mt-4 font-[family:var(--font-display-serif)] text-[1.8rem] leading-none text-[#2a150d]">
          {title}
        </h3>
        <p className="mt-3 text-[0.95rem] leading-6 text-[#6d635c]">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 inline-flex h-11 min-w-28 items-center justify-center rounded-full bg-[linear-gradient(180deg,#cb0000_0%,#b00000_100%)] px-5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(176,0,0,0.18)]"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function FieldShell({
  icon,
  rightSlot,
  children,
}: {
  icon: ReactNode;
  rightSlot?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-14 items-center rounded-[1.1rem] border border-[#efc78c] bg-white/80 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] sm:h-15">
      <span className="mr-3 text-[#e19a09]">{icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
      {rightSlot ? <div className="ml-3 text-[#8b837c]">{rightSlot}</div> : null}
    </div>
  );
}

function InstallPromptCard({
  open,
  isIos,
  isCompact,
  isLoading,
  onInstall,
  onDismiss,
}: {
  open: boolean;
  isIos: boolean;
  isCompact: boolean;
  isLoading: boolean;
  onInstall: () => void;
  onDismiss: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="absolute inset-x-4 top-4 z-30 sm:inset-x-auto sm:right-6 sm:top-6 sm:w-[21rem]">
      <div className="rounded-[1.25rem] border border-[#f3dfb6] bg-[linear-gradient(180deg,rgba(255,251,244,0.97)_0%,rgba(252,246,237,0.97)_100%)] p-3 shadow-[0_18px_36px_rgba(122,88,24,0.16)] backdrop-blur-[12px]">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,#ffefb9_0%,#dfa21a_55%,#b67d0e_100%)] text-white shadow-[0_10px_18px_rgba(176,128,16,0.24)]">
            <SparkIcon />
          </div>

          <div className="min-w-0 flex-1">
            <p className={`font-semibold leading-none text-[#24130d] ${isCompact ? "text-[0.88rem]" : "text-[0.95rem]"}`}>
              Install DLL347
            </p>
            <p
              className={`mt-1 text-[#665b55] ${
                isCompact ? "text-[0.74rem] leading-4.5" : "text-[0.82rem] leading-5"
              }`}
            >
              {isIos
                ? "Add DLL347 to your home screen for a cleaner app experience. On iPhone or iPad, use Share then Add to Home Screen."
                : "Install DLL347 for faster access and a cleaner full-app experience on your phone."}
            </p>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={onInstall}
                disabled={isLoading}
                className="inline-flex h-9 items-center justify-center rounded-full bg-[linear-gradient(180deg,#cb0000_0%,#b00000_100%)] px-4 text-[0.78rem] font-semibold text-white shadow-[0_10px_20px_rgba(176,0,0,0.16)] disabled:opacity-75"
              >
                {isIos ? "Show Steps" : isLoading ? "Opening..." : "Install App"}
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className="inline-flex h-9 items-center justify-center rounded-full px-3 text-[0.78rem] font-semibold text-[#7a6e67]"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LoginScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "setup-password" | "forgot-password">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [successTitle, setSuccessTitle] = useState("Successful login");
  const [successMessage, setSuccessMessage] = useState(
    "Your account has been authenticated successfully.",
  );
  const [forgotPasswordNotice, setForgotPasswordNotice] = useState("");
  const [isResetLinkSent, setIsResetLinkSent] = useState(false);
  const [viewportDensity, setViewportDensity] = useState<"regular" | "compact" | "tight">(
    "regular",
  );
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [isInstallPromptOpen, setIsInstallPromptOpen] = useState(false);
  const [isInstallPromptLoading, setIsInstallPromptLoading] = useState(false);
  const isIosInstallHint =
    typeof window !== "undefined" &&
    /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase()) &&
    !(
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
    );

  useEffect(() => {
    function updateViewportMode() {
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      if (viewportHeight <= 700) {
        setViewportDensity("tight");
      } else if (viewportHeight <= 780) {
        setViewportDensity("compact");
      } else {
        setViewportDensity("regular");
      }
    }

    updateViewportMode();

    window.addEventListener("resize", updateViewportMode);
    window.visualViewport?.addEventListener("resize", updateViewportMode);

    return () => {
      window.removeEventListener("resize", updateViewportMode);
      window.visualViewport?.removeEventListener("resize", updateViewportMode);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);

    if (isStandalone) {
      return;
    }

    if (window.localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY) === "1") {
      return;
    }

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    function openPromptAfterDelay() {
      window.setTimeout(() => {
        setIsInstallPromptOpen(true);
      }, 900);
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
      openPromptAfterDelay();
    }

    function handleAppInstalled() {
      setIsInstallPromptOpen(false);
      setInstallPromptEvent(null);
      window.localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, "1");
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    if (isIosDevice) {
      openPromptAfterDelay();
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const isCompactHeight = viewportDensity !== "regular";
  const isTightHeight = viewportDensity === "tight";

  async function changeMode(nextMode: "login" | "setup-password" | "forgot-password") {
    if (nextMode === mode) {
      return;
    }

    setIsTransitioning(true);
    await new Promise((resolve) => setTimeout(resolve, 250));
    setErrorMessage("");
    setForgotPasswordNotice("");
    setIsResetLinkSent(false);
    setMode(nextMode);
    setIsTransitioning(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setForgotPasswordNotice("");
    setIsSubmitting(true);

    try {
      if (mode === "login") {
        await loginWithEmailPassword(email, password);
        setPassword("");
        router.push("/dashboard");
      } else if (mode === "forgot-password") {
        const response = await requestPasswordReset(email);
        setForgotPasswordNotice(response.message);
        setIsResetLinkSent(true);
      } else {
        await setupPassword(email, password, newPassword, confirmPassword);
        setSuccessTitle("Password updated");
        setSuccessMessage("Your new password has been saved. You can now sign in normally.");
        setIsSuccessOpen(true);
        setMode("login");
        setPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setShowNewPassword(false);
        setShowConfirmPassword(false);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        if (mode === "login" && error.code === "PASSWORD_SETUP_REQUIRED") {
          await changeMode("setup-password");
          setNewPassword("");
          setConfirmPassword("");
          setShowNewPassword(false);
          setShowConfirmPassword(false);
          setErrorMessage("");
        } else {
          setErrorMessage(error.message);
        }
      } else {
        setErrorMessage(
          mode === "login"
            ? "Unable to complete sign in right now. Please try again."
            : mode === "forgot-password"
              ? "Unable to request a reset link right now. Please try again."
              : "Unable to update your password right now. Please try again.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleInstallPromptAction() {
    if (isIosInstallHint) {
      return;
    }

    if (!installPromptEvent) {
      return;
    }

    setIsInstallPromptLoading(true);

    try {
      await installPromptEvent.prompt();
      const result = await installPromptEvent.userChoice;
      if (result.outcome === "accepted") {
        setIsInstallPromptOpen(false);
        window.localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, "1");
      }
    } finally {
      setInstallPromptEvent(null);
      setIsInstallPromptLoading(false);
    }
  }

  function dismissInstallPrompt() {
    setIsInstallPromptOpen(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, "1");
    }
  }

  return (
    <main className="login-paper relative isolate h-[100svh] overflow-hidden px-4 pb-3 pt-4 text-[#2b160d] sm:px-6 sm:pb-5 sm:pt-6">
      <StatusModal
        open={isSuccessOpen}
        title={successTitle}
        message={successMessage}
        onClose={() => setIsSuccessOpen(false)}
      />
      {isTransitioning ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#faf7f2]/86 backdrop-blur-[2px]">
          <ThemedLoader size="md" />
        </div>
      ) : null}
      <InstallPromptCard
        open={mode === "login" && isInstallPromptOpen}
        isIos={isIosInstallHint}
        isCompact={isCompactHeight}
        isLoading={isInstallPromptLoading}
        onInstall={() => {
          void handleInstallPromptAction();
        }}
        onDismiss={dismissInstallPrompt}
      />
      <BackgroundSymbols />

      <div
        className={`mx-auto flex h-full w-full max-w-[26rem] flex-col justify-between ${
          isTightHeight ? "gap-0.5" : isCompactHeight ? "gap-1" : "gap-1.5"
        }`}
      >
        <section className="relative z-10 flex shrink-0 flex-col items-center text-center">
          <Image
            src="/branding/dll347-logo.png"
            alt="Datu Lapu-Lapu Lodge No. 347 logo"
            width={220}
            height={220}
            priority
            className={`h-auto drop-shadow-[0_10px_18px_rgba(143,90,16,0.24)] sm:w-[11rem] ${
              isTightHeight
                ? "w-[clamp(5.1rem,19vw,7rem)]"
                : isCompactHeight
                  ? "w-[clamp(5.9rem,22vw,8.4rem)]"
                  : "w-[clamp(6.5rem,24vw,9.5rem)]"
            }`}
          />

          <h1
            className={`font-[family:var(--font-display-serif)] leading-none tracking-[-0.05em] text-[#2a150d] ${
              isTightHeight
                ? "mt-0.5 text-[clamp(2rem,8vw,2.8rem)]"
                : isCompactHeight
                ? "mt-1 text-[clamp(2.2rem,9vw,3.2rem)]"
                : "mt-1.5 text-[clamp(2.45rem,10vw,3.7rem)] sm:mt-2"
            }`}
          >
            DLL347
          </h1>

          <div className={isTightHeight ? "mt-1" : isCompactHeight ? "mt-1.5" : "mt-2"}>
            <Divider />
          </div>

          <h2
            className={`font-[family:var(--font-display-serif)] font-semibold leading-none tracking-[-0.04em] text-[#2b170e] ${
              isTightHeight
                ? "mt-1 text-[clamp(1.28rem,5.6vw,1.7rem)]"
                : isCompactHeight
                ? "mt-1.5 text-[clamp(1.45rem,6vw,2rem)]"
                : "mt-2 text-[clamp(1.7rem,7vw,2.45rem)]"
            }`}
          >
            {mode === "login"
              ? "Welcome back"
              : mode === "setup-password"
                ? "Set a New Password"
                : "Forgot Password?"}
          </h2>
          <p
            className={`max-w-[16rem] text-[#7d7470] sm:max-w-none ${
              isTightHeight
                ? "mt-0.5 text-[0.75rem] leading-4 sm:text-[0.8rem]"
                : isCompactHeight
                ? "mt-0.5 text-[0.82rem] leading-4.5 sm:text-[0.88rem]"
                : "mt-1 text-[0.9rem] leading-5 sm:text-[0.98rem] sm:leading-6"
            }`}
          >
            {mode === "login"
              ? "Sign in to continue to your dashboard"
              : mode === "setup-password"
                ? "Create a new password to secure your account."
                : "No worries! Enter your email address and we'll send you a link to reset your password."}
          </p>
        </section>

        <section
          className={`relative z-10 rounded-[1.6rem] border border-white/60 bg-white/82 px-4 shadow-[0_18px_42px_rgba(169,117,42,0.12)] backdrop-blur-[10px] sm:px-5 ${
            isTightHeight
              ? "py-2 sm:py-2.5"
              : isCompactHeight
                ? "py-2.5 sm:py-3"
                : "py-3 sm:py-3.5"
          }`}
        >
          <form
            onSubmit={handleSubmit}
            className={isTightHeight ? "space-y-1.5" : isCompactHeight ? "space-y-2" : "space-y-2.5"}
          >
            {mode === "login" ? (
              <>
                <div>
                  <label
                    htmlFor="email"
                    className={`block font-semibold text-[#2d170e] ${
                      isTightHeight
                        ? "mb-1 text-[0.82rem]"
                        : isCompactHeight
                          ? "mb-1.5 text-[0.9rem]"
                          : "mb-2 text-[0.96rem]"
                    }`}
                  >
                    Email
                  </label>
                  <FieldShell icon={<MailIcon />}>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      disabled={isSubmitting}
                      required
                      className={`h-full w-full bg-transparent text-[#2b160d] outline-none placeholder:text-[#adadb3] ${
                        isTightHeight
                          ? "text-[0.84rem] sm:text-[0.88rem]"
                          : isCompactHeight
                          ? "text-[0.92rem] sm:text-[0.95rem]"
                          : "text-[0.98rem] sm:text-base"
                      }`}
                    />
                  </FieldShell>
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className={`block font-semibold text-[#2d170e] ${
                      isTightHeight
                        ? "mb-1 text-[0.82rem]"
                        : isCompactHeight
                          ? "mb-1.5 text-[0.9rem]"
                          : "mb-2 text-[0.96rem]"
                    }`}
                  >
                    Password
                  </label>
                  <FieldShell
                    icon={<LockIcon />}
                    rightSlot={
                      <button
                        type="button"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowPassword((value) => !value)}
                        className="transition-opacity hover:opacity-75"
                      >
                        <EyeIcon crossed={showPassword} />
                      </button>
                    }
                  >
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      disabled={isSubmitting}
                      required
                      className={`h-full w-full bg-transparent text-[#2b160d] outline-none placeholder:text-[#adadb3] ${
                        isTightHeight
                          ? "text-[0.84rem] sm:text-[0.88rem]"
                          : isCompactHeight
                          ? "text-[0.92rem] sm:text-[0.95rem]"
                          : "text-[0.98rem] sm:text-base"
                      }`}
                    />
                  </FieldShell>
                </div>
              </>
            ) : mode === "setup-password" ? (
              <>
                <div>
                  <label
                    htmlFor="new-password"
                    className={`block font-semibold text-[#2d170e] ${
                      isTightHeight
                        ? "mb-1 text-[0.82rem]"
                        : isCompactHeight
                          ? "mb-1.5 text-[0.9rem]"
                          : "mb-2 text-[0.96rem]"
                    }`}
                  >
                    New Password
                  </label>
                  <FieldShell
                    icon={<LockIcon />}
                    rightSlot={
                      <button
                        type="button"
                        aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                        onClick={() => setShowNewPassword((value) => !value)}
                        className="transition-opacity hover:opacity-75"
                      >
                        <EyeIcon crossed={showNewPassword} />
                      </button>
                    }
                  >
                    <input
                      id="new-password"
                      name="new-password"
                      type={showNewPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Enter your new password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      disabled={isSubmitting}
                      required
                      className={`h-full w-full bg-transparent text-[#2b160d] outline-none placeholder:text-[#adadb3] ${
                        isTightHeight
                          ? "text-[0.84rem] sm:text-[0.88rem]"
                          : isCompactHeight
                          ? "text-[0.92rem] sm:text-[0.95rem]"
                          : "text-[0.98rem] sm:text-base"
                      }`}
                    />
                  </FieldShell>
                  <p
                    className={`text-[#726966] ${
                      isTightHeight
                        ? "mt-0.5 text-[0.67rem] leading-3.5"
                        : isCompactHeight
                        ? "mt-1 text-[0.72rem] leading-4"
                        : "mt-1.5 text-[0.82rem] leading-5"
                    }`}
                  >
                    Minimum 8 characters with uppercase, lowercase, number,
                    and special character.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="confirm-password"
                    className={`block font-semibold text-[#2d170e] ${
                      isTightHeight
                        ? "mb-1 text-[0.82rem]"
                        : isCompactHeight
                          ? "mb-1.5 text-[0.9rem]"
                          : "mb-2 text-[0.96rem]"
                    }`}
                  >
                    Confirm New Password
                  </label>
                  <FieldShell
                    icon={<LockIcon />}
                    rightSlot={
                      <button
                        type="button"
                        aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                        onClick={() => setShowConfirmPassword((value) => !value)}
                        className="transition-opacity hover:opacity-75"
                      >
                        <EyeIcon crossed={showConfirmPassword} />
                      </button>
                    }
                  >
                    <input
                      id="confirm-password"
                      name="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Confirm your new password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      disabled={isSubmitting}
                      required
                      className={`h-full w-full bg-transparent text-[#2b160d] outline-none placeholder:text-[#adadb3] ${
                        isTightHeight
                          ? "text-[0.84rem] sm:text-[0.88rem]"
                          : isCompactHeight
                          ? "text-[0.92rem] sm:text-[0.95rem]"
                          : "text-[0.98rem] sm:text-base"
                      }`}
                    />
                  </FieldShell>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label
                    htmlFor="forgot-email"
                    className={`block font-semibold text-[#2d170e] ${
                      isTightHeight
                        ? "mb-1 text-[0.82rem]"
                        : isCompactHeight
                          ? "mb-1.5 text-[0.9rem]"
                          : "mb-2 text-[0.96rem]"
                    }`}
                  >
                    Email Address
                  </label>
                  <FieldShell icon={<MailIcon />}>
                    <input
                      id="forgot-email"
                      name="forgot-email"
                      type="email"
                      autoComplete="email"
                      placeholder="Enter your email address"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      disabled={isSubmitting}
                      required
                      className={`h-full w-full bg-transparent text-[#2b160d] outline-none placeholder:text-[#adadb3] ${
                        isTightHeight
                          ? "text-[0.84rem] sm:text-[0.88rem]"
                          : isCompactHeight
                          ? "text-[0.92rem] sm:text-[0.95rem]"
                          : "text-[0.98rem] sm:text-base"
                      }`}
                    />
                  </FieldShell>
                </div>

                <div
                  className={`rounded-[1.1rem] border border-[#f3dfb6] bg-[linear-gradient(180deg,rgba(255,250,242,0.94)_0%,rgba(252,245,235,0.94)_100%)] ${
                    isTightHeight ? "px-3 py-2" : "px-4 py-3"
                  }`}
                >
                  <div className="flex items-start gap-3 text-[#d79a09]">
                    <div className="shrink-0 pt-0.5">
                      <InfoIcon />
                    </div>
                    <p
                      className={`text-[#4b3d33] ${
                        isTightHeight
                          ? "text-[0.72rem] leading-4.5"
                          : isCompactHeight
                          ? "text-[0.8rem] leading-5"
                          : "text-[0.92rem] leading-6"
                      }`}
                    >
                      We&apos;ll send a secure password reset link to the email
                      address associated with your account.
                    </p>
                  </div>
                </div>
              </>
            )}

            <div
              className={
                isTightHeight
                  ? "min-h-[2rem]"
                  : isCompactHeight
                    ? "min-h-[2.45rem]"
                    : "min-h-[2.9rem]"
              }
            >
              {errorMessage ? (
                <div
                  className={`rounded-[1rem] border border-[#f2c5c5] bg-[#fff6f6] px-3 text-[#ad1111] ${
                    isTightHeight
                      ? "py-1 text-[0.7rem] leading-3.5"
                      : isCompactHeight
                      ? "py-1 text-[0.76rem] leading-4"
                      : "py-1.5 text-[0.82rem] leading-4.5"
                  }`}
                >
                  {errorMessage}
                </div>
              ) : forgotPasswordNotice && mode === "forgot-password" ? (
                <div
                  className={`rounded-[1rem] border border-[#d6e9cf] bg-[#f6fbf3] px-3 text-[#41632c] ${
                    isTightHeight
                      ? "py-1 text-[0.68rem] leading-3.5"
                      : isCompactHeight
                      ? "py-1 text-[0.74rem] leading-4"
                      : "py-1.5 text-[0.8rem] leading-4.5"
                  }`}
                >
                  {forgotPasswordNotice}
                </div>
              ) : null}
            </div>

            {mode === "login" ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    void changeMode("forgot-password");
                  }}
                  className={`font-semibold text-[#d10000] transition-opacity hover:opacity-80 ${
                    isTightHeight
                      ? "text-[0.78rem]"
                      : isCompactHeight
                        ? "text-[0.86rem]"
                        : "text-[0.95rem]"
                  }`}
                >
                  Forgot password?
                </button>
              </div>
            ) : mode === "forgot-password" ? (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    void changeMode("login");
                  }}
                  className={`inline-flex items-center gap-2 font-semibold text-[#d10000] transition-opacity hover:opacity-80 ${
                    isTightHeight
                      ? "text-[0.8rem]"
                      : isCompactHeight
                        ? "text-[0.88rem]"
                        : "text-[0.98rem]"
                  }`}
                >
                  <BackArrowIcon />
                  <span>Back to Login</span>
                </button>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting || (mode === "forgot-password" && isResetLinkSent)}
              className={`flex w-full items-center justify-center gap-3 rounded-[1.1rem] bg-[linear-gradient(180deg,#cb0000_0%,#b00000_100%)] px-6 font-semibold text-white shadow-[0_12px_24px_rgba(176,0,0,0.18)] transition-transform duration-200 hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-85 ${
                isTightHeight
                  ? "h-10.5 text-[0.98rem] sm:h-11"
                  : isCompactHeight
                  ? "h-12 text-[1.15rem] sm:h-13 sm:text-[1.25rem]"
                  : "h-14 text-[1.35rem] sm:h-15 sm:text-[1.45rem]"
              }`}
            >
              {isSubmitting ? <ThemedLoader size="sm" /> : <LockIcon />}
              <span>
                {isSubmitting
                  ? mode === "login"
                    ? "Signing In..."
                    : mode === "forgot-password"
                      ? "Sending Reset Link..."
                    : "Updating Password..."
                  : mode === "login"
                    ? "Sign In"
                    : mode === "forgot-password"
                      ? isResetLinkSent
                        ? "Reset Link Sent"
                        : "Send Reset Link"
                      : "Update Password"}
              </span>
            </button>
          </form>
        </section>

        <FooterArc />
      </div>
    </main>
  );
}
