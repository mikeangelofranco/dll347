"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ThemedLoader } from "@/components/themed-loader";
import {
  ApiError,
  resetPasswordWithToken,
  validateResetPasswordToken,
} from "@/lib/api";

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

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="m8.2 12.1 2.5 2.5 5.1-5.3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
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

function Divider() {
  return (
    <div className="flex items-center justify-center gap-3 text-[#d69a10]">
      <span className="h-px w-18 bg-current/90 sm:w-24" />
      <span className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-current" />
      <span className="h-px w-18 bg-current/90 sm:w-24" />
    </div>
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
  children,
  rightSlot,
}: {
  children: React.ReactNode;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="flex h-14 items-center rounded-[1.1rem] border border-[#efc78c] bg-white/80 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] sm:h-15">
      <span className="mr-3 text-[#e19a09]">
        <LockIcon />
      </span>
      <div className="min-w-0 flex-1">{children}</div>
      {rightSlot ? <div className="ml-3 text-[#8b837c]">{rightSlot}</div> : null}
    </div>
  );
}

const passwordRules = [
  "At least 8 characters",
  "One uppercase letter",
  "One lowercase letter",
  "One number or special character",
];

export function ResetPasswordScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [viewportDensity, setViewportDensity] = useState<"regular" | "compact" | "tight">(
    "regular",
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
    async function validateToken() {
      if (!token) {
        setErrorMessage("This link is expired.");
        setIsTokenValid(false);
        setIsValidatingToken(false);
        return;
      }

      try {
        await validateResetPasswordToken(token);
        setIsTokenValid(true);
        setErrorMessage("");
      } catch (error) {
        if (error instanceof ApiError) {
          setErrorMessage(
            error.code === "REQUEST_TIMEOUT"
              ? "Unable to validate this reset link right now. Please reload the page."
              : error.message || "This link is expired.",
          );
        } else {
          setErrorMessage("Unable to validate this reset link right now. Please reload the page.");
        }
        setIsTokenValid(false);
      } finally {
        setIsValidatingToken(false);
      }
    }

    void validateToken();
  }, [token]);

  const isCompactHeight = viewportDensity !== "regular";
  const isTightHeight = viewportDensity === "tight";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!token || !isTokenValid) {
      setErrorMessage("This link is expired.");
      return;
    }

    setIsSubmitting(true);

    try {
      await resetPasswordWithToken(token, newPassword, confirmPassword);
      setIsSuccessOpen(true);
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Unable to reset your password right now. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-paper relative isolate h-[100svh] overflow-hidden px-4 pb-3 pt-4 text-[#2b160d] sm:px-6 sm:pb-5 sm:pt-6">
      <StatusModal
        open={isSuccessOpen}
        title="Password reset"
        message="Your password has been updated successfully. You can now sign in again."
        onClose={() => router.push("/")}
      />
      <BackgroundSymbols />

      <div
        className={`mx-auto flex h-full w-full max-w-[26rem] flex-col justify-between ${
          isTightHeight ? "gap-0.5" : isCompactHeight ? "gap-1" : "gap-1.5"
        }`}
      >
        {isValidatingToken ? (
          <div className="flex flex-1 items-center justify-center">
            <ThemedLoader size="md" />
          </div>
        ) : !isTokenValid ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <p className="font-[family:var(--font-display-serif)] text-[2rem] text-[#2a150d]">
                {errorMessage || "This link is expired."}
              </p>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="mt-5 inline-flex items-center gap-2 text-[0.95rem] font-semibold text-[#d10000]"
              >
                <BackArrowIcon />
                <span>Back to Login</span>
              </button>
            </div>
          </div>
        ) : (
          <>
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
            Reset Your Password
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
            Enter your new password below to reset your account password.
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
                Minimum 8 characters with uppercase, lowercase, number, and
                special character.
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
              ) : null}
            </div>

            <div className="space-y-1 text-left text-[#6a625d]">
              <p
                className={
                  isTightHeight
                    ? "text-[0.72rem]"
                    : isCompactHeight
                      ? "text-[0.8rem]"
                      : "text-[0.92rem]"
                }
              >
                Password must contain:
              </p>
              <ul className={isTightHeight ? "space-y-0.5" : "space-y-1"}>
                {passwordRules.map((rule) => (
                  <li
                    key={rule}
                    className={`flex items-center gap-2 text-[#6a625d] ${
                      isTightHeight
                        ? "text-[0.72rem]"
                        : isCompactHeight
                          ? "text-[0.8rem]"
                          : "text-[0.92rem]"
                    }`}
                  >
                    <span className="text-[#c7c3c0]">
                      <CheckCircleIcon />
                    </span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex w-full items-center justify-center gap-3 rounded-[1.1rem] bg-[linear-gradient(180deg,#cb0000_0%,#b00000_100%)] px-6 font-semibold text-white shadow-[0_12px_24px_rgba(176,0,0,0.18)] transition-transform duration-200 hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-85 ${
                isTightHeight
                  ? "h-10.5 text-[0.98rem] sm:h-11"
                  : isCompactHeight
                    ? "h-12 text-[1.15rem] sm:h-13 sm:text-[1.25rem]"
                    : "h-14 text-[1.35rem] sm:h-15 sm:text-[1.45rem]"
              }`}
            >
              {isSubmitting ? <ThemedLoader size="sm" /> : <LockIcon />}
              <span>{isSubmitting ? "Resetting Password..." : "Reset Password"}</span>
            </button>

            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => router.push("/")}
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
          </form>
        </section>

        <FooterArc />
          </>
        )}
      </div>
    </main>
  );
}
