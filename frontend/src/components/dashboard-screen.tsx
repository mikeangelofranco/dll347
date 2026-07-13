"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { ThemedLoader } from "@/components/themed-loader";
import { DocumentsScreen } from "@/components/documents-screen";
import { MemberDashboardScreen } from "@/components/member-dashboard-screen";
import { MemberProfileSheet } from "@/components/member-profile-sheet";
import { timeBasedGreeting } from "@/lib/greeting";
import {
  ApiError,
  CurrentAccountResponse,
  MemberGroupKey,
  MemberSummaryGroup,
  SecretaryDashboardSummaryResponse,
  getCurrentAccount,
  getMemberList,
  getMemberProfile,
  getMemberSummary,
  getNextLodgeActivity,
  getSecretaryDashboardSummary,
  getUpcomingLodgeActivities,
  logoutCurrentSession,
  LodgeActivity,
  MemberListItem,
  MemberFullProfile,
} from "@/lib/api";

type SecretaryDashboardView = "home" | "members" | "profile" | "documents" | "more" | "dues";
type SecretarySheetName = "activity";
const calendarAddedStoragePrefix = "dll347-calendar-added-activity-";

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

function AwardIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <circle cx="12" cy="9" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="m8.5 13-1 7 4.5-2.5 4.5 2.5-1-7" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
      <circle cx="12" cy="9" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function InactiveIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <circle cx="10" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4.5 18a5.5 5.5 0 0 1 10.2-2.9M17 14l4 4M21 14l-4 4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </svg>
  );
}

function WorkingToolsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <path d="M4 9h16v9.5A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5V9Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M8.5 9V6.8A1.8 1.8 0 0 1 10.3 5h3.4a1.8 1.8 0 0 1 1.8 1.8V9M4 12.5h16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M10 12.5v1.8h4v-1.8" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function MoneyCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <text
        x="12"
        y="16"
        fill="currentColor"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="12"
        fontWeight="800"
        textAnchor="middle"
      >
        ₱
      </text>
    </svg>
  );
}

function TrendArrowIcon({ direction }: { direction: "up" | "down" | "flat" }) {
  if (direction === "flat") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
        <path d="M5 12h14" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`h-4 w-4 ${direction === "down" ? "rotate-90" : ""}`}>
      <path d="M6 18 18 6M10 6h8v8" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
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
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5.5 w-5.5">
      <path d="m4.2 10.5 7.8-6.3 7.8 6.3v9.1a1.2 1.2 0 0 1-1.2 1.2h-4.4v-6.2H9.8v6.2H5.4a1.2 1.2 0 0 1-1.2-1.2v-9.1Z" fill="currentColor" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5.5 w-5.5">
      <circle cx="5" cy="12" r="1.8" fill="currentColor" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <circle cx="19" cy="12" r="1.8" fill="currentColor" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5.5 w-5.5">
      <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.5 19a6.5 6.5 0 0 1 13 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5.5 w-5.5">
      <path
        d="M3.5 7.4A2.4 2.4 0 0 1 5.9 5h4.2l2 2.2h6A2.4 2.4 0 0 1 20.5 9.6v7A2.4 2.4 0 0 1 18.1 19H5.9a2.4 2.4 0 0 1-2.4-2.4V7.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path d="m9 5.5 6 6.5-6 6.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <circle cx="10.5" cy="10.5" r="6.2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="m15.2 15.2 4.3 4.3" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.5v5l3.3 2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path d="M12 21s6.5-5.6 6.5-11A6.5 6.5 0 0 0 5.5 10C5.5 15.4 12 21 12 21Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <circle cx="12" cy="10" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7">
      <path d="M6 6 18 18M18 6 6 18" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" />
    </svg>
  );
}

const emptyDashboardSummary: SecretaryDashboardSummaryResponse = {
  year: new Date().getFullYear(),
  overall_percent: 0,
  membership: {
    active_count: 0,
    total_count: 0,
    percent: 0,
  },
  growth: {
    progressing_count: 0,
    total_count: 0,
    percent: 0,
  },
  finances: {
    percent: 0,
    status: "No Treasurer report yet",
    has_data: false,
    report_month: null,
    report_year: null,
    report_period_label: null,
    source_date: null,
    cash_accountability: null,
    cash_to_date: null,
    cash_outflow: null,
    remaining_cash: null,
    cash_to_date_trend: null,
    cash_outflow_trend: null,
    net_trend: null,
    net_direction: "flat",
  },
  attendance: {
    average_count: 0,
    total_count: 0,
    meeting_count: 0,
    percent: 0,
  },
  dues_collection: {
    paid_count: 0,
    unpaid_count: 0,
    total_count: 0,
    percent: 0,
  },
};

function normalizeDashboardSummary(
  summary: Partial<SecretaryDashboardSummaryResponse>,
): SecretaryDashboardSummaryResponse {
  return {
    ...emptyDashboardSummary,
    ...summary,
    membership: {
      ...emptyDashboardSummary.membership,
      ...summary.membership,
    },
    growth: {
      ...emptyDashboardSummary.growth,
      ...summary.growth,
    },
    finances: {
      ...emptyDashboardSummary.finances,
      ...summary.finances,
    },
    attendance: {
      ...emptyDashboardSummary.attendance,
      ...summary.attendance,
    },
    dues_collection: {
      ...emptyDashboardSummary.dues_collection,
      ...summary.dues_collection,
    },
  };
}

function healthLabel(percent: number) {
  if (percent >= 80) {
    return "Excellent";
  }
  if (percent >= 60) {
    return "Healthy";
  }
  if (percent >= 40) {
    return "Needs attention";
  }
  return "Building";
}

function buildHealthRows(summary: SecretaryDashboardSummaryResponse) {
  return [
    {
      title: "Membership",
      subtitle: `${summary.membership.active_count} / ${summary.membership.total_count} active`,
      percent: summary.membership.percent,
      color: "bg-[#cf8c00]",
      iconBg: "bg-[#cf8c00]",
      icon: <CircleMembersIcon />,
    },
    {
      title: "Growth",
      subtitle: `${summary.growth.progressing_count} / ${summary.growth.total_count} EAM/FCM`,
      percent: summary.growth.percent,
      color: "bg-[#cc1313]",
      iconBg: "bg-[#cc1313]",
      icon: <GrowthIcon />,
    },
    {
      title: "Dues Collected",
      subtitle: `${summary.dues_collection.paid_count} / ${summary.dues_collection.total_count} paid`,
      percent: summary.dues_collection.percent,
      color: "bg-[#cf8c00]",
      iconBg: "bg-[#cf8c00]",
      icon: <MoneyCircleIcon />,
    },
    {
      title: "Attendance",
      subtitle: `${summary.attendance.average_count} avg per meeting`,
      percent: summary.attendance.percent,
      color: "bg-[#cf8c00]",
      iconBg: "bg-[#cf8c00]",
      icon: <CalendarIcon />,
    },
  ];
}

function formatPesoAmount(value: string | null): string {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function trendDisplay(value: number | null): string {
  if (value === null) {
    return "0.0%";
  }
  return `${Math.abs(value).toFixed(1)}%`;
}

function trendDirection(value: number | null): "up" | "down" | "flat" {
  if (value === null || value === 0) {
    return "flat";
  }
  return value > 0 ? "up" : "down";
}

function formatSourceDate(value: string | null): string {
  if (!value) {
    return "";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

type MemberGroupDisplay = MemberSummaryGroup & {
  heading: string;
  color: string;
  tint: string;
  border: string;
  icon: ReactNode;
  dashboardLabel: string;
};

const fallbackMemberSummaryGroups: MemberSummaryGroup[] = [
  { key: "active", label: "Active", section: "MASTER MASONS - ACTIVE", count: 0 },
  { key: "dual_plural", label: "Dual / Plural", section: "MASTER MASONS (DUAL/PLURAL) - ACTIVE", count: 0 },
  { key: "honorary", label: "Honorary", section: "MASTER MASONS (HONORARY)", count: 0 },
  { key: "inactive_snpd_demit", label: "Inactive / SNPD / Demit", section: "MASTER MASONS - INACTIVE, SNPD, DEMIT", count: 0 },
  { key: "dropped_working_tools", label: "Dropped Working Tools", section: "DROPED THE WORKING TOOLS", count: 0 },
];

const legacyMemberGroupPresentation: Record<string, Partial<MemberGroupDisplay>> = {
  active: { color: "#17962a", tint: "#f2fbf4", border: "#bfe8c7", icon: <MembersOutlineIcon />, dashboardLabel: "Regular", heading: "Regular" },
  dual_plural: { color: "#d18400", tint: "#fff8ec", border: "#f0cd94", icon: <MembersOutlineIcon />, dashboardLabel: "Dual/Plural", heading: "Dual/Plural" },
  honorary: { color: "#1769ba", tint: "#f1f8ff", border: "#bcd9ef", icon: <AwardIcon />, dashboardLabel: "Honorary", heading: "Honorary" },
  inactive_snpd_demit: { color: "#d00000", tint: "#fff5f5", border: "#f0b8b8", icon: <InactiveIcon />, dashboardLabel: "Inactive /\nSNPD / Demit", heading: "Inactive / SNPD / Demit" },
  dropped_working_tools: { color: "#5f5a57", tint: "#f7f6f5", border: "#d8d2cc", icon: <WorkingToolsIcon />, dashboardLabel: "Drop\nWorking Tools", heading: "Drop Working Tools" },
};

const dynamicMemberGroupPalette = [
  { color: "#0f766e", tint: "#f0fdfa", border: "#99f6e4", icon: <MembersOutlineIcon /> },
  { color: "#7c3aed", tint: "#f5f3ff", border: "#ddd6fe", icon: <MembersOutlineIcon /> },
  { color: "#be123c", tint: "#fff1f2", border: "#fecdd3", icon: <InactiveIcon /> },
  { color: "#0369a1", tint: "#f0f9ff", border: "#bae6fd", icon: <AwardIcon /> },
  { color: "#4d7c0f", tint: "#f7fee7", border: "#d9f99d", icon: <MembersOutlineIcon /> },
  { color: "#92400e", tint: "#fffbeb", border: "#fde68a", icon: <WorkingToolsIcon /> },
];

function buildMemberDisplayGroups(groups: MemberSummaryGroup[] | null): MemberGroupDisplay[] {
  const sourceGroups = groups && groups.length > 0 ? groups : fallbackMemberSummaryGroups;
  return sourceGroups.map((group, index) => {
    const legacy = legacyMemberGroupPresentation[group.key] ?? {};
    const palette = dynamicMemberGroupPalette[index % dynamicMemberGroupPalette.length];
    return {
      ...group,
      heading: legacy.heading ?? group.label,
      color: legacy.color ?? palette.color,
      tint: legacy.tint ?? palette.tint,
      border: legacy.border ?? palette.border,
      icon: legacy.icon ?? palette.icon,
      dashboardLabel: legacy.dashboardLabel ?? group.label,
    };
  });
}

function minimumLoadingDelay(ms = 250): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function formatActivityDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    weekday: "long",
  }).format(new Date(value));
}

function formatActivityTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatSheetDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
  })
    .format(new Date(value))
    .replace(" AM", " a.m.")
    .replace(" PM", " p.m.");
}

function formatIcsDate(value: string): string {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function downloadLodgeActivityCalendar(activity: LodgeActivity) {
  const startDate = new Date(activity.starts_at);
  const endDate = activity.ends_at
    ? new Date(activity.ends_at)
    : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
  const now = new Date();
  const filename = `${activity.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "lodge-activity"}.ics`;
  const calendar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DLL347//Member PWA//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:dll347-activity-${activity.id}@dll347.local`,
    `DTSTAMP:${formatIcsDate(now.toISOString())}`,
    `DTSTART:${formatIcsDate(startDate.toISOString())}`,
    `DTEND:${formatIcsDate(endDate.toISOString())}`,
    `SUMMARY:${escapeIcsText(activity.title)}`,
    `DESCRIPTION:${escapeIcsText(activity.details || activity.title)}`,
    `LOCATION:${escapeIcsText(activity.place)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([calendar], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const openedWindow = window.open(url, "_blank", "noopener,noreferrer");
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  if (openedWindow === null) {
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function calendarAddedStorageKey(activityId: number): string {
  return `${calendarAddedStoragePrefix}${activityId}`;
}

function displayValue(value: string | null | undefined): string {
  return value && value.trim() ? value : "-";
}

function memberListDisplayName(fullName: string): string {
  const cleanName = fullName.replace(/^(Mr\.|FCM|EAM)\s+/i, "").replace(/[+*]/g, "").trim();
  if (!cleanName.includes(",")) {
    return cleanName || "Brother";
  }
  const [lastName, restName] = cleanName.split(",");
  const givenNames = restName?.trim() || "";
  return `${givenNames} ${lastName.trim()}`.trim();
}

function memberInitials(fullName: string): string {
  const display = memberListDisplayName(fullName);
  const parts = display.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "MM";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function memberGroupFromSection(section: string): MemberGroupKey {
  const normalized = section.toUpperCase();
  if (normalized.includes("DROPED") || normalized.includes("DROPPED") || normalized.includes("WORKING TOOLS")) {
    return "dropped_working_tools";
  }
  if (normalized.includes("INACTIVE") || normalized.includes("DEMIT") || normalized.includes("SUSPENDED") || normalized.includes("SNPD") || normalized.includes("NOT ACTIVE")) {
    return "inactive_snpd_demit";
  }
  if (normalized.includes("DUAL") || normalized.includes("PLURAL")) {
    return "dual_plural";
  }
  if (normalized.includes("HONORARY") || normalized.includes("AFFILIATED")) {
    return "honorary";
  }
  return "active";
}

function memberGroupDetails(group: MemberGroupKey, groups: MemberGroupDisplay[]) {
  return groups.find((filter) => filter.key === group) ?? groups[0] ?? buildMemberDisplayGroups(null)[0];
}

function memberGroupDetailsForMember(member: MemberListItem, groups: MemberGroupDisplay[]) {
  const fallbackGroup = memberGroupFromSection(member.section);
  const groupKey = member.group_key || fallbackGroup;
  const existing = groups.find((filter) => filter.key === groupKey);
  if (existing !== undefined) {
    return existing;
  }
  const fallback = memberGroupDetails(fallbackGroup, groups);
  return {
    ...fallback,
    key: groupKey,
    label: member.group_label || fallback.label,
    dashboardLabel: member.group_label || fallback.dashboardLabel,
    heading: member.group_label || fallback.heading,
  };
}

const baseNavItems = [
  { id: "dashboard" as const, label: "Dashboard", icon: <HomeIcon /> },
  { id: "profile" as const, label: "My Profile", icon: <ProfileIcon /> },
  { id: "documents" as const, label: "Documents", icon: <FolderIcon /> },
  { id: "more" as const, label: "More", icon: <DotsIcon /> },
];

export function DashboardScreen() {
  const router = useRouter();
  const [activeView, setActiveView] = useState<SecretaryDashboardView>("home");
  const [isMembersViewClosing, setIsMembersViewClosing] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "redirecting">("loading");
  const [account, setAccount] = useState<CurrentAccountResponse | null>(null);
  const [dashboardSummary, setDashboardSummary] =
    useState<SecretaryDashboardSummaryResponse>(emptyDashboardSummary);
  const [memberSummaryGroups, setMemberSummaryGroups] = useState<MemberSummaryGroup[] | null>(null);
  const [memberSummaryError, setMemberSummaryError] = useState("");
  const [activeMemberFilter, setActiveMemberFilter] = useState<MemberGroupKey>("active");
  const [memberSearch, setMemberSearch] = useState("");
  const [duesFilter, setDuesFilter] = useState<"paid" | "unpaid" | "all">("all");
  const [memberList, setMemberList] = useState<MemberListItem[]>([]);
  const [memberListCount, setMemberListCount] = useState(0);
  const [isMemberListLoading, setIsMemberListLoading] = useState(false);
  const [memberListError, setMemberListError] = useState("");
  const [selectedMemberProfile, setSelectedMemberProfile] = useState<MemberFullProfile | null>(null);
  const [isSelectedMemberProfileLoading, setIsSelectedMemberProfileLoading] = useState(false);
  const [selectedMemberProfileError, setSelectedMemberProfileError] = useState("");
  const [nextActivity, setNextActivity] = useState<LodgeActivity | null>(null);
  const [isNextActivityLoading, setIsNextActivityLoading] = useState(true);
  const [nextActivityError, setNextActivityError] = useState("");
  const [calendarAddedActivityId, setCalendarAddedActivityId] = useState<number | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<LodgeActivity | null>(null);
  const [isActivitySheetOpen, setIsActivitySheetOpen] = useState(false);
  const [upcomingActivities, setUpcomingActivities] = useState<LodgeActivity[]>([]);
  const [isUpcomingActivitiesOpen, setIsUpcomingActivitiesOpen] = useState(false);
  const [isUpcomingActivitiesLoading, setIsUpcomingActivitiesLoading] = useState(false);
  const [upcomingActivitiesError, setUpcomingActivitiesError] = useState("");
  const [closingSheet, setClosingSheet] = useState<SecretarySheetName | null>(null);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [isTightViewport, setIsTightViewport] = useState(false);
  const canAccessDocuments = account?.role === "secretary";
  const navItems = account?.role === "secretary"
    ? baseNavItems
    : baseNavItems.filter((item) => item.id !== "documents");
  const memberDisplayGroups = useMemo(
    () => buildMemberDisplayGroups(memberSummaryGroups),
    [memberSummaryGroups],
  );
  const resolvedActiveMemberFilter = memberDisplayGroups.some((group) => group.key === activeMemberFilter)
    ? activeMemberFilter
    : memberDisplayGroups[0]?.key ?? activeMemberFilter;

  const refreshDashboardSummaries = useCallback(async () => {
    try {
      const [summary, memberSummary] = await Promise.all([
        getSecretaryDashboardSummary(),
        getMemberSummary(),
      ]);
      setDashboardSummary(normalizeDashboardSummary(summary));
      setMemberSummaryGroups(memberSummary.groups);
      setMemberSummaryError("");
    } catch {
      setDashboardSummary(normalizeDashboardSummary({}));
      setMemberSummaryGroups(null);
      setMemberSummaryError("Unable to load member counts.");
    }
  }, []);

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
        const currentAccount = await getCurrentAccount();
        setAccount(currentAccount);
        if (currentAccount.role !== "member") {
          await refreshDashboardSummaries();
        }
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
  }, [refreshDashboardSummaries, router]);

  useEffect(() => {
    if (activeView !== "members" && activeView !== "dues" || memberSummaryGroups === null) {
      return;
    }

    let isMounted = true;
    const debounce = window.setTimeout(() => {
      async function loadMembers() {
        setIsMemberListLoading(true);
        setMemberListError("");
        try {
          const [response] = await Promise.all([
            getMemberList(resolvedActiveMemberFilter, memberSearch, activeView === "dues" ? duesFilter : undefined),
            minimumLoadingDelay(),
          ]);
          if (isMounted) {
            setMemberList(response.members);
            setMemberListCount(response.count);
          }
        } catch (error) {
          if (isMounted) {
            setMemberListError(error instanceof Error ? error.message : "Unable to load members.");
          }
        } finally {
          if (isMounted) {
            setIsMemberListLoading(false);
          }
        }
      }

      void loadMembers();
    }, 300);

    return () => {
      isMounted = false;
      window.clearTimeout(debounce);
    };
  }, [activeView, resolvedActiveMemberFilter, memberSearch, duesFilter, memberSummaryGroups]);

  useEffect(() => {
    let isMounted = true;

    async function loadNextActivity() {
      setIsNextActivityLoading(true);
      setNextActivityError("");
      try {
        const [response] = await Promise.all([
          getNextLodgeActivity(),
          minimumLoadingDelay(),
        ]);
        if (isMounted) {
          setNextActivity(response.activity);
          setCalendarAddedActivityId(
            response.activity && window.localStorage.getItem(calendarAddedStorageKey(response.activity.id)) === "1"
              ? response.activity.id
              : null,
          );
        }
      } catch (error) {
        if (isMounted) {
          setNextActivityError(error instanceof Error ? error.message : "Unable to load the next lodge activity.");
        }
      } finally {
        if (isMounted) {
          setIsNextActivityLoading(false);
        }
      }
    }

    void loadNextActivity();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleLogout() {
    try {
      await logoutCurrentSession();
    } finally {
      router.replace("/");
    }
  }

  function openMembersList(group: MemberGroupKey) {
    setDuesFilter("all");
    setActiveMemberFilter(group);
    setMemberSearch("");
    setMemberList([]);
    setMemberListCount(0);
    setMemberListError("");
    setIsMembersViewClosing(false);
    setActiveView("members");
  }

  function openDuesMemberList(status: "paid" | "unpaid" | "all") {
    setDuesFilter(status);
    setActiveMemberFilter("active");
    setMemberSearch("");
    setMemberList([]);
    setMemberListCount(0);
    setMemberListError("");
    setActiveView("dues");
  }

  function closeMembersList() {
    setIsMembersViewClosing(true);
    window.setTimeout(() => {
      setActiveView("home");
      setIsMembersViewClosing(false);
    }, 230);
  }

  async function openMemberProfile(memberId: number) {
    setSelectedMemberProfile(null);
    setSelectedMemberProfileError("");
    setIsSelectedMemberProfileLoading(true);
    try {
      const [profileData] = await Promise.all([
        getMemberProfile(memberId),
        minimumLoadingDelay(),
      ]);
      setSelectedMemberProfile(profileData);
    } catch (error) {
      setSelectedMemberProfileError(error instanceof Error ? error.message : "Unable to load this member profile.");
    } finally {
      setIsSelectedMemberProfileLoading(false);
    }
  }

  function closeMemberProfile() {
    setSelectedMemberProfile(null);
    setSelectedMemberProfileError("");
    setIsSelectedMemberProfileLoading(false);
  }

  function closeSheet(name: SecretarySheetName) {
    setClosingSheet(name);
    window.setTimeout(() => {
      setIsActivitySheetOpen(false);
      setClosingSheet((current) => (current === name ? null : current));
    }, 200);
  }

  async function openActivityDetails(activity: LodgeActivity) {
    setClosingSheet(null);
    setSelectedActivity(activity);
    setIsUpcomingActivitiesOpen(false);
    setUpcomingActivities([]);
    setUpcomingActivitiesError("");
    setIsActivitySheetOpen(true);
    setIsUpcomingActivitiesLoading(true);
    try {
      const [response] = await Promise.all([
        getUpcomingLodgeActivities(2, activity.id),
        minimumLoadingDelay(),
      ]);
      setUpcomingActivities(response.activities);
    } catch (error) {
      setUpcomingActivitiesError(error instanceof Error ? error.message : "Unable to load upcoming activities.");
    } finally {
      setIsUpcomingActivitiesLoading(false);
    }
  }

  function handleAddActivityToCalendar(activity: LodgeActivity) {
    downloadLodgeActivityCalendar(activity);
    window.localStorage.setItem(calendarAddedStorageKey(activity.id), "1");
    setCalendarAddedActivityId(activity.id);
  }

  if (status !== "ready") {
    return (
      <main className="login-paper flex h-[100svh] items-center justify-center">
        <ThemedLoader size="md" />
      </main>
    );
  }

  if (account?.role === "member") {
    return <MemberDashboardScreen profile={account.member_profile} onLogout={handleLogout} canManageActivities={account.can_manage_activities} canEditMembers={account.can_edit_members} />;
  }

  if (activeView === "profile") {
    return (
      <MemberDashboardScreen
        profile={account?.member_profile ?? null}
        onLogout={handleLogout}
        initialView="profile"
        onDashboardClose={() => setActiveView("home")}
        onProfileClose={() => setActiveView("home")}
        onDocumentsOpen={canAccessDocuments ? () => setActiveView("documents") : undefined}
        canManageActivities={account?.can_manage_activities ?? false}
        canEditMembers={account?.can_edit_members ?? false}
      />
    );
  }

  if (activeView === "more") {
    return (
      <MemberDashboardScreen
        profile={account?.member_profile ?? null}
        onLogout={handleLogout}
        initialTab="more"
        onDashboardClose={() => setActiveView("home")}
        onProfileClose={() => setActiveView("home")}
        onDocumentsOpen={canAccessDocuments ? () => setActiveView("documents") : undefined}
        canManageActivities={account?.can_manage_activities ?? false}
        canEditMembers={account?.can_edit_members ?? false}
      />
    );
  }

  if (activeView === "documents" && account?.role === "secretary") {
    return (
      <DocumentsScreen
        onLogout={handleLogout}
        onNavigate={(view) => setActiveView(view)}
        onMembersDataUploaded={refreshDashboardSummaries}
      />
    );
  }

  if (activeView === "members") {
    const activeFilter = memberGroupDetails(resolvedActiveMemberFilter, memberDisplayGroups);
    const isSearchingMembers = memberSearch.trim().length > 0;

    return (
      <main className={`member-dashboard-paper h-[100svh] overflow-hidden text-[#111111] ${isMembersViewClosing ? "member-page-exit" : "member-page-enter"}`}>
        <div className="relative mx-auto flex h-full w-full max-w-[26rem] flex-col overflow-hidden border-x border-[#eee7dd] bg-white/20 shadow-[0_0_35px_rgba(87,55,19,0.08)]">
          <header className="flex h-[4.4rem] shrink-0 items-center justify-between border-b border-[#eee7dd]/70 bg-white/72 px-5 backdrop-blur-md">
            <button type="button" onClick={closeMembersList} className="flex h-9 w-9 items-center justify-center text-[#1f2529]" aria-label="Back to dashboard">
              <BackIcon />
            </button>
            <h1 className="text-[1.05rem] font-bold tracking-[-0.035em]">Members</h1>
            <label className="flex h-9 w-9 items-center justify-center text-[#111111]" aria-label="Search members">
              <SearchIcon />
            </label>
          </header>

          <div className="flex-1 overflow-y-auto px-3.5 pb-[5.6rem] pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex flex-wrap gap-2 pb-2">
              {memberDisplayGroups.map((filter) => {
                const isActive = filter.key === resolvedActiveMemberFilter;
                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setActiveMemberFilter(filter.key)}
                    className="rounded-full border px-3.5 py-1.5 text-[0.68rem] font-semibold transition-colors"
                    style={{
                      color: filter.color,
                      borderColor: isActive ? filter.border : `${filter.border}99`,
                      backgroundColor: isActive ? filter.tint : "rgba(255,255,255,0.58)",
                    }}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 rounded-[1rem] border border-[#f0e5d7] bg-white/88 px-3.5 py-2.5 shadow-[0_8px_20px_rgba(75,48,20,0.04)]">
              <label className="flex items-center gap-2 text-[#716a66]">
                <SearchIcon />
                <input
                  type="search"
                  value={memberSearch}
                  onChange={(event) => setMemberSearch(event.target.value)}
                  placeholder="Search member names"
                  className="min-w-0 flex-1 bg-transparent text-[0.78rem] text-[#111111] outline-none placeholder:text-[#9a928b]"
                />
              </label>
            </div>

            <section className="mt-5 flex items-end justify-between gap-3 px-1">
              <div>
                <p className="text-[0.82rem] font-medium text-[#6c6460]">{isSearchingMembers ? "Search Results" : activeFilter.heading}</p>
                <p className="mt-1 text-[1.25rem] font-bold leading-none">{isMemberListLoading ? <ThemedLoader size="sm" /> : memberListCount}</p>
              </div>
              <button type="button" className="rounded-full border border-[#f1e9e0] bg-white/78 px-4 py-2 text-[0.72rem] font-semibold text-[#5c544f] shadow-[0_8px_18px_rgba(75,48,20,0.06)]">
                Filter
              </button>
            </section>

            <section className="mt-4 space-y-2.5">
              {memberListError ? (
                <p className="rounded-2xl bg-[#fff0f0] px-4 py-5 text-center text-[0.78rem] leading-5 text-[#c90000]">{memberListError}</p>
              ) : isMemberListLoading ? (
                <div className="flex justify-center rounded-[1rem] bg-white/88 px-4 py-8 shadow-[0_8px_20px_rgba(75,48,20,0.04)]"><ThemedLoader size="md" /></div>
              ) : memberList.length > 0 ? (
                memberList.map((member) => {
                  const groupDetails = memberGroupDetailsForMember(member, memberDisplayGroups);
                  return (
                    <button key={member.id} type="button" onClick={() => void openMemberProfile(member.id)} className="flex w-full items-center gap-2.5 rounded-[0.85rem] bg-white/90 px-2.5 py-2.5 text-left shadow-[0_8px_20px_rgba(75,48,20,0.045)]">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(145deg,#20aa38,#008a1f)] text-[0.76rem] font-bold text-white shadow-[0_8px_16px_rgba(0,128,32,0.16)]">
                        {member.profile_photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={member.profile_photo_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          memberInitials(member.name)
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.75rem] font-bold tracking-[-0.02em] text-[#111111]">{memberListDisplayName(member.name)}</span>
                        <span className="mt-0.5 block truncate text-[0.64rem] text-[#625b56]">GLP ID: {displayValue(member.glp_id_number)}</span>
                        <span className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[0.54rem] font-semibold leading-none" style={{ color: groupDetails.color, backgroundColor: groupDetails.tint }}>
                          <span className="flex h-3.5 w-3.5 items-center justify-center">{groupDetails.icon}</span>
                          <span className="truncate">{groupDetails.label}</span>
                        </span>
                      </span>
                      <span className="text-[#111111]"><ChevronIcon /></span>
                    </button>
                  );
                })
              ) : (
                <p className="rounded-2xl bg-white/88 px-4 py-8 text-center text-[0.78rem] leading-5 text-[#665d57]">No members found for this filter.</p>
              )}
            </section>
          </div>

          <nav className="absolute inset-x-0 bottom-0 z-20 rounded-t-[1.35rem] border border-[#eee8e1] bg-white/95 px-3.5 pb-[max(0.55rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-7px_24px_rgba(75,48,20,0.07)] backdrop-blur-xl">
            <div className={`${navItems.length === 4 ? "grid-cols-4" : "grid-cols-3"} grid gap-1`}>
              {navItems.map((item) => {
                const isActive = item.id === "dashboard";
                return (
                  <button
                    key={item.label}
                    type="button"
                  onClick={() => {
                    if (item.id === "dashboard") {
                      closeMembersList();
                    } else if (item.id === "profile") {
                      setActiveView("profile");
                    } else if (item.id === "documents") {
                      setActiveView("documents");
                    } else {
                      setActiveView("more");
                    }
                  }}
                    className={`flex flex-col items-center gap-1 ${isActive ? "text-[#d00000]" : "text-[#716a66]"}`}
                  >
                    {item.icon}
                    <span className="text-[0.55rem] font-medium sm:text-[0.62rem]">{item.label}</span>
                    <span className={`h-[0.12rem] w-8 rounded-full ${isActive ? "bg-[#d00000]" : "bg-transparent"}`} />
                  </button>
                );
              })}
            </div>
          </nav>
          {(isSelectedMemberProfileLoading || selectedMemberProfileError || selectedMemberProfile) ? (
            <MemberProfileSheet
              profile={selectedMemberProfile}
              isLoading={isSelectedMemberProfileLoading}
              error={selectedMemberProfileError}
              onClose={closeMemberProfile}
            />
          ) : null}
        </div>
      </main>
    );
  }

  if (activeView === "dues") {
    const duesFilterOptions: { label: string; status: "paid" | "unpaid" | "all" }[] = [
      { label: "Paid", status: "paid" },
      { label: "Unpaid", status: "unpaid" },
      { label: "All", status: "all" },
    ];

    return (
      <main className="member-dashboard-paper h-[100svh] overflow-hidden text-[#111111] member-page-enter">
        <div className="relative mx-auto flex h-full w-full max-w-[26rem] flex-col overflow-hidden border-x border-[#eee7dd] bg-white/20 shadow-[0_0_35px_rgba(87,55,19,0.08)]">
          <header className="flex shrink-0 items-center border-b border-[#eee7dd]/70 bg-white/72 px-5 pb-3 pt-4 backdrop-blur-md">
            <button type="button" onClick={() => setActiveView("home")} className="mr-3 flex h-9 w-9 items-center justify-center text-[#1f2529]" aria-label="Back to dashboard">
              <BackIcon />
            </button>
            <h1 className="flex-1 text-[1.05rem] font-bold tracking-[-0.035em]">Dues Collected</h1>
          </header>

          <div className="px-3.5 pt-4">
            <div className="flex gap-2">
              {duesFilterOptions.map((option) => {
                const isActive = duesFilter === option.status;
                const activeColor = option.status === "paid" ? "bg-[#6e9a1d] text-white border-[#6e9a1d]" : option.status === "unpaid" ? "bg-[#d31313] text-white border-[#d31313]" : "bg-[#cf8c00] text-white border-[#cf8c00]";
                const inactiveColor = option.status === "paid" ? "text-[#6e9a1d] border-[#c0d69a]" : option.status === "unpaid" ? "text-[#d31313] border-[#eabbbb]" : "text-[#cf8c00] border-[#ecd09a]";
                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => setDuesFilter(option.status)}
                    className={`rounded-full border px-4 py-1.5 text-[0.68rem] font-bold transition-colors ${isActive ? activeColor : `${inactiveColor} bg-white`}`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 rounded-[1rem] border border-[#f0e5d7] bg-white/88 px-3.5 py-2.5 shadow-[0_8px_20px_rgba(75,48,20,0.04)]">
              <label className="flex items-center gap-2 text-[#716a66]">
                <SearchIcon />
                <input
                  type="search"
                  value={memberSearch}
                  onChange={(event) => setMemberSearch(event.target.value)}
                  placeholder="Search member names"
                  className="min-w-0 flex-1 bg-transparent text-[0.78rem] text-[#111111] outline-none placeholder:text-[#9a928b]"
                />
              </label>
            </div>

            <p className="mt-5 px-1 text-[1.25rem] font-bold leading-none">{isMemberListLoading ? <ThemedLoader size="sm" /> : memberListCount}</p>
          </div>

          <div className="flex-1 overflow-y-auto px-3.5 pb-[2rem] pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <section className="space-y-2.5">
              {memberListError ? (
                <p className="rounded-2xl bg-[#fff0f0] px-4 py-5 text-center text-[0.78rem] leading-5 text-[#c90000]">{memberListError}</p>
              ) : isMemberListLoading ? (
                <div className="flex justify-center rounded-[1rem] bg-white/88 px-4 py-8 shadow-[0_8px_20px_rgba(75,48,20,0.04)]"><ThemedLoader size="md" /></div>
              ) : memberList.length > 0 ? (
                memberList.map((member) => {
                  const groupDetails = memberGroupDetailsForMember(member, memberDisplayGroups);
                  const duesPaid = member.dues_status.startsWith("Paid");
                  return (
                    <button key={member.id} type="button" onClick={() => void openMemberProfile(member.id)} className="flex w-full items-center gap-2.5 rounded-[0.85rem] bg-white/90 px-2.5 py-2.5 text-left shadow-[0_8px_20px_rgba(75,48,20,0.045)]">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(145deg,#20aa38,#008a1f)] text-[0.76rem] font-bold text-white shadow-[0_8px_16px_rgba(0,128,32,0.16)]">
                        {member.profile_photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={member.profile_photo_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          memberInitials(member.name)
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.75rem] font-bold tracking-[-0.02em] text-[#111111]">{memberListDisplayName(member.name)}</span>
                        <span className="mt-0.5 block truncate text-[0.64rem] text-[#625b56]">GLP ID: {displayValue(member.glp_id_number)}</span>
                        <span className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[0.54rem] font-semibold leading-none" style={{ color: groupDetails.color, backgroundColor: groupDetails.tint }}>
                          <span className="flex h-3.5 w-3.5 items-center justify-center">{groupDetails.icon}</span>
                          <span className="truncate">{groupDetails.label}</span>
                        </span>
                      </span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.55rem] font-bold ${duesPaid ? "bg-[#eef8f0] text-[#6e9a1d]" : "bg-[#fff7f7] text-[#d31313]"}`}>
                        {duesPaid ? "Paid" : "Unpaid"}
                      </span>
                    </button>
                  );
                })
              ) : (
                <p className="rounded-2xl bg-white/88 px-4 py-8 text-center text-[0.78rem] leading-5 text-[#665d57]">No members found for this filter.</p>
              )}
            </section>
          </div>
        </div>
      </main>
    );
  }

  const healthRows = buildHealthRows(dashboardSummary);
  const overallPercent = dashboardSummary.overall_percent;
  const currentDuesYear = dashboardSummary.year;
  const greeting = timeBasedGreeting();
  const finances = dashboardSummary.finances;
  const cashToDateDirection = trendDirection(finances.cash_to_date_trend);
  const cashOutflowDirection = trendDirection(finances.cash_outflow_trend);
  const netDirection = finances.net_direction;
  const netTrendColor = netDirection === "down" ? "text-[#cc1313]" : netDirection === "flat" ? "text-[#6f6763]" : "text-[#168234]";
   const duesStats: Array<{
      label: string;
      value: string;
      color: string;
      icon: ReactNode;
      panel: string;
      status?: "paid" | "unpaid" | "all";
    }> = [
    {
      label: "Paid",
      value: String(dashboardSummary.dues_collection.paid_count),
      color: "text-[#6e9a1d]",
      icon: <CheckStatusIcon />,
      panel: "bg-[#fdf9f3]",
      status: "paid" as const,
    },
    {
      label: "Unpaid",
      value: String(dashboardSummary.dues_collection.unpaid_count),
      color: "text-[#d31313]",
      icon: <AlertIcon />,
      panel: "bg-[#fff7f7]",
      status: "unpaid" as const,
    },
    {
      label: "Total",
      value: String(dashboardSummary.dues_collection.total_count),
      color: "text-[#cf8c00]",
      icon: <MembersOutlineIcon />,
      panel: "bg-[#fdf9f3]",
      status: "all" as const,
    },
    {
      label: "Rate",
      value: `${dashboardSummary.dues_collection.percent}%`,
      color: "text-[#cf8c00]",
      icon: <MoneyCircleIcon />,
      panel: "bg-[#fdf9f3]",
    },
  ];

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
                {greeting},
                <br />
                Brother 👋
              </h1>
            </div>
          </div>

          <div className={`ml-2 flex shrink-0 flex-col items-end ${isTightViewport ? "gap-1 pt-1" : "gap-2 pt-2"}`}>
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
                  {overallPercent}%
                </div>
                <div
                  className={`mt-1 font-bold text-[#62980d] ${
                    isTightViewport ? "text-[0.68rem]" : "text-[0.72rem]"
                  }`}
                >
                  {healthLabel(overallPercent)}
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
                        } ${row.percent === 100 || row.title === "Membership" || row.title === "Dues Collected" || row.title === "Attendance" ? "text-[#cf8c00]" : "text-[#cc1313]"}`}
                      >
                        {row.percent}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-4 rounded-[1.85rem] border border-[#f1ece4] bg-white/88 px-4 py-4 shadow-[0_14px_34px_rgba(149,110,46,0.08)] backdrop-blur-[10px]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(145deg,#eda600,#c77900)] text-white shadow-[0_8px_20px_rgba(205,133,0,0.2)]">
                <MembersOutlineIcon />
              </div>
              <h2 className="text-[0.92rem] font-extrabold tracking-[-0.04em] text-[#c98200]">
                Members
              </h2>
            </div>

            <div className="mt-3.5 grid grid-cols-4 gap-1.5 min-[400px]:grid-cols-5">
              {memberDisplayGroups.map((group) => {
                const value = group.count;
                return (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => openMembersList(group.key)}
                    className="flex min-h-[6.5rem] flex-col items-center rounded-[0.85rem] border border-[#f2ebe3] bg-[#fffdfb] px-1 py-2.5 text-center shadow-[0_5px_14px_rgba(75,48,20,0.03)]"
                  >
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full text-white"
                      style={{ backgroundColor: group.color }}
                    >
                      {group.icon}
                    </span>
                    <span
                      className="mt-1.5 min-h-7 whitespace-pre-line text-[0.55rem] font-medium leading-[1.22]"
                      style={{ color: group.color }}
                    >
                      {group.dashboardLabel}
                    </span>
                    <span className="mt-auto text-base font-bold text-[#18130f]">
                      {value}
                    </span>
                  </button>
                );
              })}
            </div>
            {memberSummaryError ? (
              <p className="mt-3 rounded-xl bg-[#fff0f0] px-3 py-2 text-[0.68rem] text-[#c90000]">
                {memberSummaryError}
              </p>
            ) : null}
          </section>

          <section className="relative mt-4 overflow-hidden rounded-[1.85rem] border border-[#f1ece4] bg-white/88 px-4 py-4 shadow-[0_14px_34px_rgba(149,110,46,0.08)] backdrop-blur-[10px]">
            <div className="relative z-10 flex items-start gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(145deg,#e30909,#bd0000)] text-white shadow-[0_8px_20px_rgba(194,0,0,0.2)]">
                <CalendarIcon />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[0.68rem] font-semibold text-[#d00000]">Next Lodge Activity</div>
                <h2 className="mt-1.5 text-[1.18rem] font-bold leading-none tracking-[-0.045em]">
                  {isNextActivityLoading ? <ThemedLoader size="sm" /> : nextActivity?.title ?? "No upcoming activity"}
                </h2>
              </div>
            </div>
            {nextActivity ? (
              <>
                <div className="relative z-10 mt-4 space-y-2 text-[0.68rem] text-[#3d3733]">
                  <div className="flex items-center gap-2 text-[#6a6460]"><CalendarIcon /><span className="text-[#3d3733]">{formatActivityDate(nextActivity.starts_at)}</span></div>
                  <div className="flex items-center gap-2 text-[#6a6460]"><ClockIcon /><span className="text-[#3d3733]">{formatActivityTime(nextActivity.starts_at)}</span></div>
                  <div className="flex items-center gap-2 text-[#6a6460]"><PinIcon /><span className="text-[#3d3733]">{nextActivity.place}</span></div>
                </div>
                <div className="relative z-10 mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void openActivityDetails(nextActivity)} className="w-fit whitespace-nowrap rounded-[0.8rem] bg-[#d40000] px-4 py-2 text-[10px] font-semibold text-white shadow-[0_8px_18px_rgba(208,0,0,0.17)]">View Details</button>
                  <button type="button" disabled={calendarAddedActivityId === nextActivity.id} onClick={() => handleAddActivityToCalendar(nextActivity)} className={`flex w-fit items-center justify-center gap-1 whitespace-nowrap rounded-[0.8rem] border px-4 py-2 text-[10px] font-semibold ${calendarAddedActivityId === nextActivity.id ? "border-[#cfe7d5] bg-[#f0fbf2] text-[#13802a]" : "border-[#d40000] bg-white/65 text-[#d00000]"}`}><CalendarIcon /><span>{calendarAddedActivityId === nextActivity.id ? "Added to Calendar" : "Add to Calendar"}</span></button>
                </div>
              </>
            ) : isNextActivityLoading ? null : (
              <p className="relative z-10 mt-4 text-[0.68rem] leading-5 text-[#655e59]">Please check back soon for the next lodge schedule.</p>
            )}
            {nextActivityError ? <p className="relative z-10 mt-3 rounded-xl bg-[#fff0f0] px-3 py-2 text-[0.68rem] text-[#c90000]">{nextActivityError}</p> : null}
          </section>

          <section className="mt-4 rounded-[1.85rem] border border-[#f1ece4] bg-white/88 px-4 py-4 shadow-[0_14px_34px_rgba(149,110,46,0.08)] backdrop-blur-[10px]">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-[#fff7f7] p-1.5 text-[#d31313]">
                <MoneyCircleIcon />
              </div>
              <h2 className="text-[0.92rem] font-extrabold tracking-[-0.04em] text-[#18130f]">
                {currentDuesYear} Dues Collection
              </h2>
            </div>

            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <div className="text-[0.76rem] text-[#5f5854]">Collected</div>
              </div>
              <div className="text-[0.84rem] text-[#18130f]">
                {dashboardSummary.dues_collection.paid_count} / {dashboardSummary.dues_collection.total_count} members
              </div>
            </div>

            <div className="mt-2 h-[0.38rem] overflow-hidden rounded-full bg-[#f5eaea]">
              <div
                className="h-full rounded-full bg-[#cb1414]"
                style={{ width: `${dashboardSummary.dues_collection.percent}%` }}
              />
            </div>

            <div className="mt-2 text-right text-[0.72rem] text-[#6f6763]">
              {dashboardSummary.dues_collection.percent}% collected
            </div>

            <div className="mt-4 grid grid-cols-4 gap-3">
              {duesStats.map((item) => (
                item.status !== undefined ? (
                  <button key={item.label} type="button" onClick={() => openDuesMemberList(item.status!)} className={`rounded-[1.15rem] px-2 py-3 text-center transition-all active:scale-95 ${item.panel} hover:shadow-[0_4px_14px_rgba(0,0,0,0.1)] cursor-pointer`}>
                    <div className={`mx-auto flex justify-center ${item.color}`}>{item.icon}</div>
                    <div className="mt-2 text-[1.05rem] font-bold leading-none text-[#18130f]">{item.value}</div>
                    <div className="mt-1 text-[0.7rem] leading-none text-[#18130f]">{item.label}</div>
                  </button>
                ) : (
                  <div key={item.label} className={`rounded-[1.15rem] px-2 py-3 text-center ${item.panel}`}>
                    <div className={`mx-auto flex justify-center ${item.color}`}>{item.icon}</div>
                    <div className="mt-2 text-[1.05rem] font-bold leading-none text-[#18130f]">{item.value}</div>
                    <div className="mt-1 text-[0.7rem] leading-none text-[#18130f]">{item.label}</div>
                  </div>
                )
              ))}
            </div>
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
              <div className="text-right text-[0.58rem] leading-4 text-[#766d67]">
                <div className="font-semibold text-[#18130f]">
                  {finances.report_period_label ? `As of ${finances.report_period_label}` : "No report yet"}
                </div>
                {finances.source_date ? <div>Uploaded {formatSourceDate(finances.source_date)}</div> : null}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 rounded-[1.15rem] bg-[#fdf9f3] px-2 py-5 text-center shadow-[inset_0_0_0_1px_rgba(246,238,226,0.55)]">
              <div className="px-1.5">
                <div className="text-[0.68rem] font-medium leading-tight text-[#18130f]">Cash to Date</div>
                <div className="mt-4 text-[0.9rem] font-extrabold leading-tight text-[#168234] tracking-[-0.02em]">
                  {formatPesoAmount(finances.cash_to_date)}
                </div>
                <div className="mt-5 text-[0.66rem] leading-5 text-[#6f6763]">
                  <div>vs last month</div>
                  <div className={`flex items-center justify-center gap-1 font-extrabold ${cashToDateDirection === "down" ? "text-[#cc1313]" : cashToDateDirection === "flat" ? "text-[#6f6763]" : "text-[#168234]"}`}>
                    <TrendArrowIcon direction={cashToDateDirection} />
                    <span>{trendDisplay(finances.cash_to_date_trend)}</span>
                  </div>
                </div>
              </div>

              <div className="border-x border-[#eadfd6] px-1.5">
                <div className="text-[0.68rem] font-medium leading-tight text-[#18130f]">Cash Outflow</div>
                <div className="mt-4 text-[0.9rem] font-extrabold leading-tight text-[#cc1313] tracking-[-0.02em]">
                  {formatPesoAmount(finances.cash_outflow)}
                </div>
                <div className="mt-5 text-[0.66rem] leading-5 text-[#6f6763]">
                  <div>vs last month</div>
                  <div className={`flex items-center justify-center gap-1 font-extrabold ${cashOutflowDirection === "down" ? "text-[#168234]" : cashOutflowDirection === "flat" ? "text-[#6f6763]" : "text-[#cc1313]"}`}>
                    <TrendArrowIcon direction={cashOutflowDirection} />
                    <span>{trendDisplay(finances.cash_outflow_trend)}</span>
                  </div>
                </div>
              </div>

              <div className="px-1.5">
                <div className="text-[0.68rem] font-medium leading-tight text-[#18130f]">Net Trend</div>
                <div className={`mx-auto mt-4 flex w-fit items-center justify-center gap-1 rounded-full px-3 py-2 text-[0.84rem] font-extrabold ${netDirection === "down" ? "bg-[#fff0f0] text-[#cc1313]" : netDirection === "flat" ? "bg-white text-[#6f6763]" : "bg-[#e8f6eb] text-[#168234]"}`}>
                  <TrendArrowIcon direction={netDirection} />
                  <span>{trendDisplay(finances.net_trend)}</span>
                </div>
                <div className="mt-5 text-[0.66rem] leading-4 text-[#6f6763]">
                  <div>vs last month</div>
                  <div>Cash position is</div>
                  <div className={`font-extrabold ${netTrendColor}`}>
                    {netDirection === "flat" ? "flat" : netDirection}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <nav className="absolute inset-x-0 bottom-0 z-20 rounded-t-[1.35rem] border border-[#eee8e1] bg-white/95 px-3.5 pb-[max(0.55rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-7px_24px_rgba(75,48,20,0.07)] backdrop-blur-xl">
          <div className={`${navItems.length === 4 ? "grid-cols-4" : "grid-cols-3"} grid gap-1`}>
            {navItems.map((item) => {
              const isActive = item.id === "dashboard";
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    if (item.id === "dashboard") {
                      setActiveView("home");
                    } else if (item.id === "profile") {
                      setActiveView("profile");
                    } else if (item.id === "documents") {
                      setActiveView("documents");
                    } else if (item.id === "more") {
                      setActiveView("more");
                    }
                  }}
                  className={`flex flex-col items-center gap-1 ${isActive ? "text-[#d00000]" : "text-[#716a66]"}`}
                >
                  {item.icon}
                  <span className="text-[0.55rem] font-medium sm:text-[0.62rem]">{item.label}</span>
                  <span className={`h-[0.12rem] w-8 rounded-full ${isActive ? "bg-[#d00000]" : "bg-transparent"}`} />
                </button>
              );
            })}
          </div>
        </nav>

        {isActivitySheetOpen && selectedActivity !== null ? (
          <div className={`absolute inset-0 z-40 flex items-end bg-[#171717]/58 backdrop-blur-[1px] ${closingSheet === "activity" ? "member-sheet-backdrop-exit" : "member-sheet-backdrop-enter"}`}>
            <section className={`max-h-[82%] w-full overflow-hidden rounded-t-[1.35rem] bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_45px_rgba(0,0,0,0.24)] ${closingSheet === "activity" ? "member-sheet-panel-exit" : "member-sheet-panel-enter"}`}>
              <div className="mx-auto h-1 w-9 rounded-full bg-[#9b9b9b]" />
              <div className="mt-5 flex items-center justify-between">
                <button type="button" onClick={() => closeSheet("activity")} className="flex h-9 w-9 items-center justify-center text-[#111111]" aria-label="Close lodge activity details">
                  <CloseIcon />
                </button>
                <h2 className="min-w-0 flex-1 truncate px-2 text-center text-[1.05rem] font-bold tracking-[-0.035em]">{selectedActivity.title}</h2>
                <span className="h-9 w-9" />
              </div>

              <div className="mt-5 max-h-[calc(82svh-7rem)] space-y-4 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <section className="rounded-[1.05rem] border border-[#f1e8de] bg-white px-4 py-4 shadow-[0_10px_26px_rgba(75,48,20,0.07)]">
                  <h3 className="text-[0.82rem] font-bold text-[#423c37]">Details</h3>
                  <p className="mt-4 text-[0.82rem] leading-6 text-[#151515]">{selectedActivity.details || "No additional details have been recorded for this activity yet."}</p>
                  <div className="mt-5 border-t border-[#e7ddd2]">
                    <div className="flex gap-3 border-b border-[#e7ddd2] py-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f0e9e3] text-[#5f5751]"><CalendarIcon /></span>
                      <span className="min-w-0">
                        <span className="block text-[0.8rem] font-semibold text-[#423c37]">Starts At</span>
                        <span className="mt-0.5 block text-[0.78rem] leading-5 text-[#111111]">{formatSheetDateTime(selectedActivity.starts_at)}</span>
                      </span>
                    </div>
                    <div className="flex gap-3 pt-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f0e9e3] text-[#5f5751]"><PinIcon /></span>
                      <span className="min-w-0">
                        <span className="block text-[0.8rem] font-semibold text-[#423c37]">Place</span>
                        <span className="mt-0.5 block text-[0.78rem] leading-5 text-[#111111]">{selectedActivity.place}</span>
                      </span>
                    </div>
                  </div>
                </section>

                <section className="rounded-[1.05rem] border border-[#f1e8de] bg-white px-4 py-4 shadow-[0_10px_26px_rgba(75,48,20,0.07)]">
                  <button type="button" onClick={() => setIsUpcomingActivitiesOpen((current) => !current)} className="flex w-full items-center justify-between gap-3 text-left">
                    <h3 className="text-[0.95rem] font-bold tracking-[-0.03em] text-[#111111]">Upcoming Activities (Top 2)</h3>
                    <span className={`text-[#111111] transition-transform duration-200 ${isUpcomingActivitiesOpen ? "-rotate-90" : "rotate-90"}`}><ChevronIcon /></span>
                  </button>
                  {isUpcomingActivitiesOpen ? (
                    <div className="mt-4">
                      {isUpcomingActivitiesLoading ? (
                        <div className="flex justify-center rounded-2xl bg-[#fbf7f0] px-4 py-6"><ThemedLoader size="md" /></div>
                      ) : upcomingActivitiesError ? (
                        <p className="rounded-2xl bg-[#fff0f0] px-4 py-5 text-center text-[0.78rem] leading-5 text-[#c90000]">{upcomingActivitiesError}</p>
                      ) : upcomingActivities.length > 0 ? (
                        upcomingActivities.map((activity) => (
                          <article key={activity.id} className="flex items-start gap-3 border-b border-[#eadfd3] py-3 last:border-b-0">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f0e9e3] text-[#5f5751]"><CalendarIcon /></span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[0.82rem] font-bold leading-tight text-[#111111]">{activity.title}</span>
                              <span className="mt-0.5 block text-[0.74rem] leading-5 text-[#38322e]">{formatSheetDateTime(activity.starts_at)}</span>
                              <span className="block text-[0.74rem] leading-5 text-[#38322e]">{activity.place}</span>
                            </span>
                            <span className="rounded-md bg-[#eee7e1] px-3 py-2 text-[0.62rem] font-medium text-[#423c37]">{activity.status}</span>
                          </article>
                        ))
                      ) : (
                        <p className="rounded-2xl bg-[#fbf7f0] px-4 py-5 text-center text-[0.78rem] leading-5 text-[#665d57]">No other upcoming activities are currently scheduled.</p>
                      )}
                    </div>
                  ) : null}
                </section>

                <button type="button" onClick={() => closeSheet("activity")} className="w-full rounded-[0.9rem] border border-[#ead8c7] bg-[#fffdfb] px-4 py-3 text-[0.8rem] font-semibold text-[#111111] shadow-[0_8px_18px_rgba(75,48,20,0.04)]">Close</button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
