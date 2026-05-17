"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ThemedLoader } from "@/components/themed-loader";
import { ApiError, getCurrentAccount, logoutCurrentSession } from "@/lib/api";

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-8 w-8">
      <path
        d="M12 3.75a4.5 4.5 0 0 0-4.5 4.5v1.09c0 .73-.22 1.45-.63 2.05l-1.3 1.96a1.5 1.5 0 0 0 1.24 2.33h10.38a1.5 1.5 0 0 0 1.24-2.33l-1.3-1.96a3.67 3.67 0 0 1-.63-2.05V8.25A4.5 4.5 0 0 0 12 3.75Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M9.75 18a2.25 2.25 0 0 0 4.5 0"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function PulseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <path
        d="M2.5 12h4l2.1-5.2L12 17l2.2-5h7.3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
    </svg>
  );
}

function CircleMembersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <path
        d="M12 12.1a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M5.6 18.3a6.6 6.6 0 0 1 12.8 0"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="M6.8 12.3a2.35 2.35 0 1 0 0-4.7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="M17.2 7.6a2.35 2.35 0 1 1 0 4.7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function GrowthIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <path
        d="m4.5 15.5 5-5 3.5 3.5 6-6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M14.5 8h4.5v4.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <path
        d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a2 2 0 0 1 2 2v2.5H14a2.5 2.5 0 0 0 0 5h6V17a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 16.5v-9Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M14 9.5h6v5h-6a2.5 2.5 0 0 1 0-5Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle cx="16.8" cy="12" r="0.8" fill="currentColor" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <rect
        x="3.5"
        y="5.5"
        width="17"
        height="15"
        rx="2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M3.5 9.5h17" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3.8v3.4M16 3.8v3.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M8.5 12.5h.01M12 12.5h.01M15.5 12.5h.01M8.5 16h.01M12 16h.01M15.5 16h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function MembersOutlineIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7">
      <path d="M12 11.6a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4.8 19.2a7.2 7.2 0 0 1 14.4 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function GavelIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7">
      <path d="m9 7 8 8" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <path d="m6 10 4-4 3 3-4 4Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="m14 18 4-4 3 3-4 4Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M4 20 14 10" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function UserBadgeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7">
      <path d="M12 11.4a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 19.2a7 7 0 0 1 14 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7">
      <path d="M7 3.8h7l4 4v12.4A1.8 1.8 0 0 1 16.2 22H7.8A1.8 1.8 0 0 1 6 20.2V5.6A1.8 1.8 0 0 1 7.8 3.8Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M14 3.8v4h4" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M9 12h6M9 16h6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function MoneyCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.3v9.4M14.9 9.1c-.5-.8-1.5-1.3-2.9-1.3-1.7 0-2.8.9-2.8 2.2 0 1.2.9 1.8 2.7 2.2 1.9.4 3.1.9 3.1 2.4 0 1.4-1.3 2.4-3.1 2.4-1.4 0-2.6-.4-3.3-1.3" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path d="M9 5.5 15.5 12 9 18.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function UpArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <path d="M7 16 17 6M9 6h8v8" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function DownArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <path d="m7 8 10 10M9 18h8v-8" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function DollarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <path d="M12 4v16M15.2 7.2c-.5-.8-1.5-1.4-3-1.4-1.8 0-3 .9-3 2.3 0 1.2.9 1.8 2.9 2.3 2.1.5 3.3 1 3.3 2.6 0 1.5-1.3 2.6-3.3 2.6-1.5 0-2.7-.5-3.5-1.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function CheckStatusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="m8.3 12.2 2.3 2.4 5-5.3" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.5v4.8l3.1 1.8" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.5v5.2" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <circle cx="12" cy="16.4" r="1" fill="currentColor" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7">
      <path d="m4.2 10.5 7.8-6.3 7.8 6.3v9.1a1.2 1.2 0 0 1-1.2 1.2h-4.4v-6.2H9.8v6.2H5.4a1.2 1.2 0 0 1-1.2-1.2v-9.1Z" fill="currentColor" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7">
      <circle cx="5" cy="12" r="1.8" fill="currentColor" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <circle cx="19" cy="12" r="1.8" fill="currentColor" />
    </svg>
  );
}

const healthRows = [
  {
    title: "Membership",
    subtitle: "15 / 18 active",
    percent: 83,
    color: "bg-[#cf8c00]",
    iconBg: "bg-[#cf8c00]",
    icon: <CircleMembersIcon />,
  },
  {
    title: "Growth",
    subtitle: "2 progressing, 3 visitors",
    percent: 85,
    color: "bg-[#cc1313]",
    iconBg: "bg-[#cc1313]",
    icon: <GrowthIcon />,
  },
  {
    title: "Finances",
    subtitle: "50% dues collected",
    percent: 50,
    color: "bg-[#cc1313]",
    iconBg: "bg-[#cf8c00]",
    icon: <WalletIcon />,
  },
  {
    title: "Attendance",
    subtitle: "~30 avg per meeting",
    percent: 100,
    color: "bg-[#cf8c00]",
    iconBg: "bg-[#cf8c00]",
    icon: <CalendarIcon />,
  },
];

const quickStats = [
  { value: "18", label: "Members", color: "text-[#cf8c00]", icon: <MembersOutlineIcon /> },
  { value: "8", label: "Officers", color: "text-[#d31313]", icon: <UserBadgeIcon /> },
  { value: "1", label: "Upcoming", color: "text-[#cf8c00]", icon: <CalendarIcon /> },
  { value: "2", label: "In Progress", color: "text-[#d31313]", icon: <GavelIcon /> },
  { value: "3", label: "Visitors", color: "text-[#cf8c00]", icon: <UserBadgeIcon /> },
  { value: "7", label: "Documents", color: "text-[#d31313]", icon: <DocumentIcon /> },
];

const financialStats = [
  { label: "Income", value: "₱900.00", color: "text-[#cf8c00]", icon: <UpArrowIcon />, panel: "bg-[#fdf9f3]" },
  { label: "Expenses", value: "₱1,010.50", color: "text-[#d31313]", icon: <DownArrowIcon />, panel: "bg-[#fff7f7]" },
  { label: "Net", value: "-₱110.50", color: "text-[#d31313]", icon: <DollarIcon />, panel: "bg-[#fdf9f3]" },
];

const duesStats = [
  { label: "Paid", value: "3", color: "text-[#6e9a1d]", icon: <CheckStatusIcon />, panel: "bg-[#fdf9f3]" },
  { label: "Pending", value: "2", color: "text-[#cf8c00]", icon: <ClockIcon />, panel: "bg-[#fdf9f3]" },
  { label: "Partial", value: "1", color: "text-[#cf8c00]", icon: <ClockIcon />, panel: "bg-[#fdf9f3]" },
  { label: "Overdue", value: "1", color: "text-[#d31313]", icon: <AlertIcon />, panel: "bg-[#fff7f7]" },
];

const navItems = [
  { label: "Dashboard", active: true, icon: <HomeIcon /> },
  { label: "Members", active: false, icon: <MembersOutlineIcon /> },
  { label: "Calendar", active: false, icon: <CalendarIcon /> },
  { label: "Documents", active: false, icon: <DocumentIcon /> },
  { label: "More", active: false, icon: <DotsIcon /> },
];

export function DashboardScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "redirecting">("loading");
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [isTightViewport, setIsTightViewport] = useState(false);

  useEffect(() => {
    function updateViewportMode() {
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
      setIsCompactViewport(viewportHeight <= 760 || viewportWidth <= 390);
      setIsTightViewport(viewportHeight <= 700 || viewportWidth <= 375);
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
    async function loadAccount() {
      try {
        await getCurrentAccount();
        setStatus("ready");
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          router.replace("/");
          setStatus("redirecting");
          return;
        }

        router.replace("/");
        setStatus("redirecting");
      }
    }

    void loadAccount();
  }, [router]);

  async function handleLogout() {
    try {
      await logoutCurrentSession();
    } finally {
      router.replace("/");
    }
  }

  if (status !== "ready") {
    return (
      <main className="login-paper flex h-[100svh] items-center justify-center">
        <ThemedLoader size="md" />
      </main>
    );
  }

  return (
    <main className="login-paper h-[100svh] overflow-hidden px-4 pt-4 text-[#18130f] sm:px-5 sm:pt-5">
      <div className="mx-auto flex h-full w-full max-w-[26rem] flex-col overflow-hidden">
        <section className="flex items-start justify-between">
          <div className={`flex min-w-0 items-center ${isTightViewport ? "gap-2.5" : "gap-3"}`}>
            <Image
              src="/branding/dll347-logo.png"
              alt="Datu Lapu-Lapu Lodge No. 347 logo"
              width={88}
              height={88}
              priority
              className={`shrink-0 drop-shadow-[0_10px_18px_rgba(143,90,16,0.22)] ${
                isTightViewport ? "h-[4.2rem] w-[4.2rem]" : isCompactViewport ? "h-[4.7rem] w-[4.7rem]" : "h-[5.3rem] w-[5.3rem]"
              }`}
            />
            <div className="min-w-0 pt-1">
              <h1
                className={`font-[family:var(--font-body-sans)] font-extrabold leading-[1.12] tracking-[-0.05em] text-[#111111] ${
                  isTightViewport ? "text-[0.88rem]" : isCompactViewport ? "text-[0.98rem]" : "text-[1.1rem]"
                }`}
              >
                Good morning,
                <br />
                Brother 👋
              </h1>
            </div>
          </div>

          <div className={`ml-2 flex shrink-0 flex-col items-end ${isTightViewport ? "gap-1 pt-1" : "gap-2 pt-2"}`}>
            <button
              type="button"
              aria-label="Notifications"
              className={`relative flex items-center justify-center rounded-full border border-[#f1ece4] bg-white/84 text-[#101010] shadow-[0_8px_20px_rgba(120,90,40,0.08)] ${
                isTightViewport ? "h-10 w-10" : isCompactViewport ? "h-11 w-11" : "h-12 w-12"
              }`}
            >
              <div className={isTightViewport ? "scale-[0.82]" : isCompactViewport ? "scale-[0.9]" : "scale-100"}>
                <BellIcon />
              </div>
              <span
                className={`absolute flex items-center justify-center rounded-full bg-[#c10000] font-bold text-white shadow-[0_8px_20px_rgba(193,0,0,0.22)] ${
                  isTightViewport
                    ? "right-[0.04rem] top-[0.08rem] h-5 w-5 text-[0.72rem]"
                    : isCompactViewport
                      ? "right-[0.02rem] top-[0.05rem] h-5.5 w-5.5 text-[0.8rem]"
                      : "right-[0.02rem] top-[0.02rem] h-7 w-7 text-[0.95rem]"
                }`}
              >
                3
              </span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className={`rounded-full border border-[#f2d7d7] bg-white/78 font-semibold leading-none text-[#c10000] shadow-[0_6px_16px_rgba(120,90,40,0.05)] ${
                isTightViewport
                  ? "px-2.5 py-1.5 text-[0.66rem]"
                  : isCompactViewport
                    ? "px-3 py-1.5 text-[0.68rem]"
                    : "px-3.5 py-1.5 text-[0.72rem]"
              }`}
            >
              Sign out
            </button>
          </div>
        </section>

        <div className="mt-4 flex-1 overflow-y-auto pb-[6.6rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <section className="rounded-[1.85rem] border border-[#f1ece4] bg-white/88 px-4 py-4 shadow-[0_14px_34px_rgba(149,110,46,0.08)] backdrop-blur-[10px]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="text-[#cf8c00]">
                  <PulseIcon />
                </div>
                <h2
                  className={`font-extrabold tracking-[-0.04em] text-[#18130f] ${
                    isTightViewport ? "text-[0.86rem]" : "text-[0.92rem]"
                  }`}
                >
                  Lodge Health Indicator
                </h2>
              </div>
              <div className="text-right leading-none">
                <div
                  className={`font-black tracking-[-0.06em] text-[#cf8c00] ${
                    isTightViewport ? "text-[1.9rem]" : "text-[2.1rem]"
                  }`}
                >
                  86%
                </div>
                <div
                  className={`mt-1 font-bold text-[#62980d] ${
                    isTightViewport ? "text-[0.68rem]" : "text-[0.72rem]"
                  }`}
                >
                  Excellent
                </div>
              </div>
            </div>

            <div className={isTightViewport ? "mt-4 space-y-3.5" : "mt-4 space-y-4"}>
              {healthRows.map((row) => (
                <div
                  key={row.title}
                  className={`grid items-center ${
                    isTightViewport
                      ? "grid-cols-[7.4rem_minmax(0,1fr)] gap-x-2.5"
                      : "grid-cols-[8.6rem_minmax(0,1fr)] gap-x-3"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`flex shrink-0 items-center justify-center rounded-full text-white ${row.iconBg} ${
                        isTightViewport ? "h-9 w-9" : "h-10 w-10"
                      }`}
                    >
                      {row.icon}
                    </div>
                    <div className="min-w-0">
                      <div
                        className={`font-extrabold leading-none tracking-[-0.04em] text-[#18130f] ${
                          isTightViewport ? "text-[0.84rem]" : "text-[0.88rem]"
                        }`}
                      >
                        {row.title}
                      </div>
                      <div
                        className={`mt-1 text-[#23201d] ${
                          isTightViewport
                            ? "text-[0.68rem] leading-[1.05]"
                            : "text-[0.72rem] leading-[1.08]"
                        }`}
                      >
                        {row.subtitle}
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className={`flex items-center ${isTightViewport ? "gap-2" : "gap-3"}`}>
                      <div
                        className={`flex-1 overflow-hidden rounded-full bg-[#f5eaea] ${
                          isTightViewport ? "h-[0.32rem]" : "h-[0.36rem]"
                        }`}
                      >
                        <div
                          className={`h-full rounded-full ${row.color}`}
                          style={{ width: `${row.percent}%` }}
                        />
                      </div>
                      <span
                        className={`shrink-0 text-right font-bold ${
                          isTightViewport ? "w-8 text-[0.68rem]" : "w-10 text-[0.72rem]"
                        } ${row.percent === 100 || row.title === "Membership" || row.title === "Attendance" ? "text-[#cf8c00]" : "text-[#cc1313]"}`}
                      >
                        {row.percent}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-4 grid grid-cols-3 gap-3">
            {quickStats.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`rounded-[1.35rem] border border-[#f1ece4] bg-white/86 text-left shadow-[0_10px_24px_rgba(149,110,46,0.07)] backdrop-blur-[10px] ${
                  isCompactViewport ? "px-2.5 py-2.5" : "px-3 py-3"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className={`${item.color} shrink-0`}>{item.icon}</div>
                    <div className="min-w-0">
                      <div
                        className={`font-black leading-none tracking-[-0.07em] text-[#121212] ${
                          isCompactViewport ? "text-[1.85rem]" : "text-[2.05rem]"
                        }`}
                      >
                        {item.value}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 pt-1 text-[#6f6763]">
                    <ArrowRightIcon />
                  </div>
                </div>
                <div className={`leading-none text-[#18130f] ${isCompactViewport ? "mt-1.5 text-[0.68rem]" : "mt-2 text-[0.7rem]"}`}>
                  {item.label}
                </div>
              </button>
            ))}
          </section>

          <section className="mt-4 rounded-[1.85rem] border border-[#f1ece4] bg-white/88 px-4 py-4 shadow-[0_14px_34px_rgba(149,110,46,0.08)] backdrop-blur-[10px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-[#cf8c00]">
                  <WalletIcon />
                </div>
                <h2 className="text-[0.92rem] font-extrabold tracking-[-0.04em] text-[#18130f]">
                  Financial Summary
                </h2>
              </div>
              <button type="button" className="text-[0.82rem] font-bold text-[#d31313]">
                View all
              </button>
            </div>

            <div className="mt-4">
              <div className="text-[0.76rem] text-[#5f5854]">Current Balance</div>
              <div className="mt-1 text-[2.2rem] font-black leading-none tracking-[-0.07em] text-[#111111]">
                ₱12,847.50
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              {financialStats.map((item) => (
                <div key={item.label} className={`rounded-[1.15rem] px-3 py-3 text-center ${item.panel}`}>
                  <div className={`mx-auto flex justify-center ${item.color}`}>{item.icon}</div>
                  <div className="mt-2 text-[0.72rem] text-[#18130f]">{item.label}</div>
                  <div className={`mt-1 text-[0.95rem] font-bold ${item.color}`}>{item.value}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-4 rounded-[1.85rem] border border-[#f1ece4] bg-white/88 px-4 py-4 shadow-[0_14px_34px_rgba(149,110,46,0.08)] backdrop-blur-[10px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-[#fff7f7] p-1.5 text-[#d31313]">
                  <MoneyCircleIcon />
                </div>
                <h2 className="text-[0.92rem] font-extrabold tracking-[-0.04em] text-[#18130f]">
                  2026 Dues Collection
                </h2>
              </div>
              <button type="button" className="text-[0.82rem] font-bold text-[#d31313]">
                View report
              </button>
            </div>

            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <div className="text-[0.76rem] text-[#5f5854]">Collected</div>
              </div>
              <div className="text-[0.84rem] text-[#18130f]">₱525.00 / ₱1,050.00</div>
            </div>

            <div className="mt-2 h-[0.38rem] overflow-hidden rounded-full bg-[#f5eaea]">
              <div className="h-full w-1/2 rounded-full bg-[#cb1414]" />
            </div>

            <div className="mt-2 text-right text-[0.72rem] text-[#6f6763]">50% collected</div>

            <div className="mt-4 grid grid-cols-4 gap-3">
              {duesStats.map((item) => (
                <div key={item.label} className={`rounded-[1.15rem] px-2 py-3 text-center ${item.panel}`}>
                  <div className={`mx-auto flex justify-center ${item.color}`}>{item.icon}</div>
                  <div className="mt-2 text-[1.05rem] font-bold leading-none text-[#18130f]">{item.value}</div>
                  <div className="mt-1 text-[0.7rem] leading-none text-[#18130f]">{item.label}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <nav className="absolute inset-x-4 bottom-0 z-20 mx-auto max-w-[26rem] rounded-t-[1.8rem] border border-[#f0ece7] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(255,251,246,0.98)_100%)] px-4 pb-3 pt-3 shadow-[0_-8px_24px_rgba(120,90,40,0.08)] backdrop-blur-[14px]">
          <div className="grid grid-cols-5 gap-2">
            {navItems.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`flex flex-col items-center gap-1 ${item.active ? "text-[#d31313]" : "text-[#5c5652]"}`}
              >
                <div>{item.icon}</div>
                <span className="text-[0.68rem] font-medium">{item.label}</span>
                <span className={`h-[0.12rem] w-8 rounded-full ${item.active ? "bg-[#d31313]" : "bg-transparent"}`} />
              </button>
            ))}
          </div>
        </nav>
      </div>
    </main>
  );
}
