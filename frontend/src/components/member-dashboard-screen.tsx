"use client";

import Image from "next/image";
import { ChangeEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { ThemedLoader } from "@/components/themed-loader";
import { MemberProfileSheet } from "@/components/member-profile-sheet";
import { PetitionerDashboardCard } from "@/components/petitioner-dashboard-card";
import { PetitionerListScreen } from "@/components/petitioner-list-screen";
import { timeBasedGreeting } from "@/lib/greeting";
import { useIdleTimeout } from "@/lib/use-idle-timeout";
import { ActivityScreen, activateMemberLogin, activatePetitionerLogin, createLodgeActivity, DashboardCardVisibility, defaultDashboardCardVisibility, deactivateMemberLogin, deactivatePetitionerLogin, deleteLodgeActivity, getEditableMemberProfile, getEditablePetitionerProfile, getManagedLodgeActivities, getMemberAccountStatus, getMemberList, getMemberProfile, getMemberSummary, getMyMemberProfile, getMyPositionsHeld, getNextLodgeActivity, getPetitionerAccountStatus, getPetitionerList, getSecretaryDashboardSummary, getUpcomingLodgeActivities, getYearActivities, LodgeActivity, LodgeActivityFormPayload, MemberDashboardProfile, MemberEditableProfile, MemberFullProfile, MemberGroupKey, MemberListItem, MemberPositionHeld, MemberPositionHeldPayload, MemberProfileUpdatePayload, MemberSummaryGroup, PetitionerEditableProfile, PetitionerListItem, PetitionerProfileUpdatePayload, PetitionerStage, SecretaryDashboardSummaryResponse, trackScreenView, trackUserAction, updateMemberProfile, updatePetitionerProfile, uploadMemberProfilePhotoById, uploadPetitionerProfilePhotoById } from "@/lib/api";

type MemberDashboardScreenProps = {
  profile: MemberDashboardProfile | null;
  onLogout: () => Promise<void>;
  initialView?: "home" | "profile";
  initialTab?: MemberDashboardTab;
  onDashboardClose?: () => void;
  onProfileClose?: () => void;
  onDocumentsOpen?: () => void;
  canManageActivities?: boolean;
  canEditMembers?: boolean;
  canEditPetitioners?: boolean;
  dashboardCardVisibility?: DashboardCardVisibility;
};

type MemberDashboardTab = "dashboard" | "profile" | "more";
type MemberDashboardView = "home" | "profile" | "members" | "petitioners" | "activity" | "member-edit" | "petitioner-edit" | "dues";
type MemberSheetName = "appendant" | "positions" | "activity" | "eventlist" | "payment";
type SecretaryNavItemId = "dashboard" | "profile" | "documents" | "more";
type ActivityTimePickerTarget = "start" | "end";
type ActivityScreenTab = "create" | "list";

type CropState = {
  zoom: number;
  x: number;
  y: number;
};

type CropImageMeta = {
  width: number;
  height: number;
};

type ActivityTimePickerState = {
  target: ActivityTimePickerTarget;
  hour: string;
  minute: string;
  period: "AM" | "PM";
};

type WorkbookAddSheetKind = "meeting" | "monthly" | "dues";

type AppendantBodyItem = {
  key: string;
  name: string;
  subtitle: string;
  logoPath: string;
};

type WorkbookCellRow = {
  key: string;
  value: string;
  original: unknown;
};

type EditableMemberForm = Omit<
  MemberProfileUpdatePayload,
  "appendant_bodies" | "meeting_attendance" | "monthly_attendance" | "annual_dues"
> & {
  appendantBodiesRows: WorkbookCellRow[];
  meetingAttendanceRows: WorkbookCellRow[];
  monthlyAttendanceRows: WorkbookCellRow[];
  annualDuesRows: WorkbookCellRow[];
};

const calendarAddedStoragePrefix = "dll347-calendar-added-activity-";
const defaultWorkbookMeetingName = "WB";
const monthOptions = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function Icon({ children, className = "h-5 w-5" }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      {children}
    </svg>
  );
}

function PersonIcon({ group = false }: { group?: boolean }) {
  return (
    <Icon className="h-5.5 w-5.5">
      <circle cx={group ? "9" : "12"} cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d={group ? "M3.8 19a5.2 5.2 0 0 1 10.4 0" : "M5.5 19a6.5 6.5 0 0 1 13 0"} fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      {group ? <><path d="M15.3 6.2a2.7 2.7 0 0 1 0 5.2" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" /><path d="M17 14.2a4.4 4.4 0 0 1 3.2 4.2" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" /></> : null}
    </Icon>
  );
}

function CalendarIcon({ plus = false }: { plus?: boolean }) {
  return <Icon><rect x="4" y="5.5" width="16" height="14.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M4 9.5h16M8 3.5v4M16 3.5v4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />{plus ? <path d="M12 12v5M9.5 14.5h5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /> : <path d="M8 13h2M13 13h2M8 16.5h2M13 16.5h2" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />}</Icon>;
}

function TextIcon() {
  return <span className="text-[0.82rem] font-extrabold leading-none text-[#897b6d]">Tt</span>;
}

function ToolbarIcon({ label }: { label: string }) {
  return <span className="flex h-7 w-7 items-center justify-center text-[0.78rem] font-bold text-[#8b7d70]">{label}</span>;
}

function TargetIcon() {
  return <Icon className="h-5 w-5"><circle cx="12" cy="12" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /><circle cx="12" cy="12" r="1.8" fill="currentColor" /></Icon>;
}

function ClockIcon() {
  return <Icon><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M12 7.5v5l3.3 2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></Icon>;
}

function PinIcon() {
  return <Icon><path d="M12 21s6-5.8 6-11a6 6 0 0 0-12 0c0 5.2 6 11 6 11Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /><circle cx="12" cy="10" r="2" fill="none" stroke="currentColor" strokeWidth="1.8" /></Icon>;
}

function ChevronIcon() {
  return <Icon className="h-5 w-5"><path d="m9 5.5 6 6.5-6 6.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></Icon>;
}

function CheckIcon() {
  return <Icon className="h-6 w-6"><path d="m5 12.5 4.3 4.2L19 7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" /></Icon>;
}

function CameraIcon() {
  return <Icon><path d="M8.5 7.2 10 5h4l1.5 2.2H19A2 2 0 0 1 21 9.2v8.3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.2a2 2 0 0 1 2-2h3.5Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /><circle cx="12" cy="13.3" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" /></Icon>;
}

function AwardIcon() {
  return <Icon><circle cx="12" cy="9" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="m8.5 13-1 7 4.5-2.5 4.5 2.5-1-7" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" /><circle cx="12" cy="9" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.5" /></Icon>;
}

function InactiveIcon() {
  return <Icon><circle cx="10" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M4.5 18a5.5 5.5 0 0 1 10.2-2.9M17 14l4 4M21 14l-4 4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" /></Icon>;
}

function WorkingToolsIcon() {
  return <Icon><path d="M4 9h16v9.5A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5V9Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /><path d="M8.5 9V6.8A1.8 1.8 0 0 1 10.3 5h3.4a1.8 1.8 0 0 1 1.8 1.8V9M4 12.5h16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /><path d="M10 12.5v1.8h4v-1.8" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></Icon>;
}

function PersonCheckIcon() {
  return (
    <Icon className="h-5.5 w-5.5">
      <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.5 19a6.5 6.5 0 0 1 13 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      <path d="m8 15 2.5 2.5 5.5-5.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </Icon>
  );
}

function PersonXIcon() {
  return (
    <Icon className="h-5.5 w-5.5">
      <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.5 19a6.5 6.5 0 0 1 13 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      <path d="m9.5 16 5 5M14.5 16l-5 5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </Icon>
  );
}

function PersonPlusIcon() {
  return (
    <Icon className="h-5.5 w-5.5">
      <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.5 19a6.5 6.5 0 0 1 13 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      <path d="M12 14v5M9.5 16.5h5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </Icon>
  );
}

function PulseIcon() {
  return (
    <Icon className="h-6 w-6">
      <path
        d="M2.5 12h4l2.1-5.2L12 17l2.2-5h7.3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
    </Icon>
  );
}

function MembersOutlineIcon() {
  return (
    <Icon className="h-7 w-7">
      <path d="M12 11.6a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4.8 19.2a7.2 7.2 0 0 1 14.4 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </Icon>
  );
}

function GrowthIcon() {
  return (
    <Icon className="h-6 w-6">
      <path d="m4.5 15.5 5-5 3.5 3.5 6-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M14.5 8h4.5v4.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </Icon>
  );
}

function WalletIcon() {
  return (
    <Icon className="h-6 w-6">
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a2 2 0 0 1 2 2v2.5H14a2.5 2.5 0 0 0 0 5h6V17a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 16.5v-9Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M14 9.5h6v5h-6a2.5 2.5 0 0 1 0-5Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <circle cx="16.8" cy="12" r="0.8" fill="currentColor" />
    </Icon>
  );
}

function MoneyCircleIcon() {
  return (
    <Icon className="h-7 w-7">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <text x="12" y="16" fill="currentColor" fontFamily="Arial, Helvetica, sans-serif" fontSize="12" fontWeight="800" textAnchor="middle">₱</text>
    </Icon>
  );
}

function CheckStatusIcon() {
  return (
    <Icon className="h-6 w-6">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="m8.3 12.2 2.3 2.4 5-5.3" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </Icon>
  );
}

function PercentIcon() {
  return (
    <Icon className="h-6 w-6">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <text x="12" y="16.2" textAnchor="middle" fontSize="11" fontWeight="800" fill="currentColor">%</text>
    </Icon>
  );
}

function AlertIcon() {
  return (
    <Icon className="h-6 w-6">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.5v5.2" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <circle cx="12" cy="16.4" r="1" fill="currentColor" />
    </Icon>
  );
}

function HomeIcon() {
  return <Icon className="h-5.5 w-5.5"><path d="m4 10.5 8-6.5 8 6.5v9a1.5 1.5 0 0 1-1.5 1.5h-4.2v-6.3H9.7V21H5.5A1.5 1.5 0 0 1 4 19.5v-9Z" fill="currentColor" /></Icon>;
}

function FolderIcon() {
  return <Icon className="h-5.5 w-5.5"><path d="M3.5 7.4A2.4 2.4 0 0 1 5.9 5h4.2l2 2.2h6A2.4 2.4 0 0 1 20.5 9.6v7A2.4 2.4 0 0 1 18.1 19H5.9a2.4 2.4 0 0 1-2.4-2.4V7.4Z" fill="currentColor" /></Icon>;
}

function DotsIcon() {
  return <Icon className="h-5.5 w-5.5"><circle cx="5" cy="12" r="1.7" fill="currentColor" /><circle cx="12" cy="12" r="1.7" fill="currentColor" /><circle cx="19" cy="12" r="1.7" fill="currentColor" /></Icon>;
}

function SearchIcon() {
  return <Icon className="h-6 w-6"><circle cx="10.5" cy="10.5" r="6.2" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m15.2 15.2 4.3 4.3" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" /></Icon>;
}

function LodgeWatermark() {
  return (
    <svg viewBox="0 0 300 220" aria-hidden="true" className="pointer-events-none absolute bottom-7 right-1 h-36 w-44 text-[#d58d00] opacity-[0.12] sm:h-40 sm:w-52">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path strokeWidth="4" d="M60 190h180M78 178h144M92 166h116" />
        <g strokeWidth="2.7">
          <path d="M66 166V76M49 166h34M49 76h34M56 66h20M56 56h20M62 46h8" />
          <path d="M234 166V76M217 166h34M217 76h34M224 66h20M224 56h20M230 46h8" />
          <path d="M58 86c16-8 14 8 0 4M226 86c16-8 14 8 0 4" />
        </g>
        <g strokeWidth="5">
          <path d="M92 170 150 56l58 114" />
          <path d="M88 112 150 174l62-62" />
          <path d="M107 101 150 144l43-43" />
        </g>
        <g strokeWidth="3">
          <path d="M112 170h76M125 148h50M134 126h32" />
          <circle cx="150" cy="62" r="20" />
          <path d="M150 36v52M132 62h36" />
          <path d="M142 28h16M138 20h24" />
        </g>
      </g>
      <text x="150" y="132" textAnchor="middle" fill="currentColor" fontSize="48" fontWeight="700" fontFamily="Georgia, serif">G</text>
    </svg>
  );
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
  { key: "regular", label: "Regular", section: "REGULAR", count: 0 },
  { key: "dual_plural", label: "Dual/Plural", section: "DUAL/PLURAL", count: 0 },
  { key: "affiliated", label: "Affiliated", section: "AFFILIATED", count: 0 },
  { key: "honorary", label: "Honorary", section: "HONORARY", count: 0 },
  { key: "demit", label: "Demit", section: "DEMIT", count: 0 },
  { key: "suspended", label: "Suspended", section: "SUSPENDED", count: 0 },
  { key: "dropped_working_tools", label: "Dropped Working Tools", section: "DROPED THE WORKING TOOLS", count: 0 },
];

const petitionerEditGroups: MemberGroupDisplay[] = [
  { key: "fcm", label: "FCM", section: "PETITIONER - FCM", count: 0, heading: "FCM Petitioners", color: "#2f6fbd", tint: "#e9f3ff", border: "#b6d3f3", icon: <PersonIcon />, dashboardLabel: "FCM" },
  { key: "eam", label: "EAM", section: "PETITIONER - EAM", count: 0, heading: "EAM Petitioners", color: "#6b9fd5", tint: "#f0f6fd", border: "#cbdff2", icon: <PersonIcon />, dashboardLabel: "EAM" },
  { key: "balloted", label: "Balloted", section: "PETITIONER - BALLOTED", count: 0, heading: "Balloted Petitioners", color: "#4c7fc1", tint: "#edf4fc", border: "#c4d9ef", icon: <PersonIcon group />, dashboardLabel: "Balloted" },
  { key: "re_apply", label: "Re-Apply", section: "PETITIONER - RE-APPLY", count: 0, heading: "Re-Apply Petitioners", color: "#477dbf", tint: "#edf4fc", border: "#c4d9ef", icon: <PersonIcon />, dashboardLabel: "Re-Apply" },
  { key: "circulated", label: "Circulated", section: "PETITIONER - CIRCULATED", count: 0, heading: "Circulated Petitioners", color: "#477dbf", tint: "#edf4fc", border: "#c4d9ef", icon: <PersonIcon />, dashboardLabel: "Circulated" },
  { key: "inactive", label: "Inactive", section: "PETITIONER - INACTIVE", count: 0, heading: "Inactive Petitioners", color: "#6b7280", tint: "#f4f6f8", border: "#d5d9df", icon: <PersonIcon />, dashboardLabel: "Inactive" },
];

const GROUP_ORDER: string[] = [
  "Regular",
  "Dual/Plural",
  "Affiliated",
  "Honorary",
  "Demit",
  "Suspended",
  "Dropped Working Tools",
];

function groupPresentationForLabel(label: string): {
  color: string;
  tint: string;
  border: string;
  icon: ReactNode;
  heading: string;
  dashboardLabel: string;
} {
  const key = label.toLowerCase();
  if (key.includes("drop") || key.includes("working tools")) {
    return {
      color: "#5f5a57", tint: "#f7f6f5", border: "#d8d2cc",
      icon: <PersonPlusIcon />, heading: "Drop Working Tools", dashboardLabel: "Drop\nWorking Tools",
    };
  }
  if (key.includes("suspended")) {
    return {
      color: "#d00000", tint: "#fff5f5", border: "#f0b8b8",
      icon: <PersonXIcon />, heading: "Suspended", dashboardLabel: "Suspended",
    };
  }
  if (key.includes("demit")) {
    return {
      color: "#1769ba", tint: "#f1f8ff", border: "#bcd9ef",
      icon: <PersonCheckIcon />, heading: "Demit", dashboardLabel: "Demit",
    };
  }
  return {
    color: "#17962a", tint: "#f2fbf4", border: "#bfe8c7",
    icon: <PersonCheckIcon />, heading: label, dashboardLabel: label,
  };
}

function buildMemberDisplayGroups(groups: MemberSummaryGroup[] | null): MemberGroupDisplay[] {
  const sourceGroups = groups && groups.length > 0 ? groups : fallbackMemberSummaryGroups;
  const displayGroups: MemberGroupDisplay[] = sourceGroups.map((group) => {
    const pres = groupPresentationForLabel(group.label);
    return {
      ...group,
      heading: pres.heading,
      color: pres.color,
      tint: pres.tint,
      border: pres.border,
      icon: pres.icon,
      dashboardLabel: pres.dashboardLabel,
    };
  });
  const orderIndex: Record<string, number> = {};
  GROUP_ORDER.forEach((name, i) => { orderIndex[name] = i; });
  displayGroups.sort((a, b) => {
    const ai = orderIndex[a.label] ?? GROUP_ORDER.length;
    const bi = orderIndex[b.label] ?? GROUP_ORDER.length;
    return ai - bi;
  });
  return displayGroups;
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
  petitioner: {
    fcm: 0,
    eam: 0,
    balloted: 0,
    re_apply: 0,
    circulated: 0,
    inactive: 0,
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
    previous_balance: null,
    cash_received: null,
    cash_outflow: null,
    cash_on_hand: null,
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
    petitioner: {
      ...emptyDashboardSummary.petitioner,
      ...summary.petitioner,
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
      subtitle: `${summary.membership.active_count} / ${summary.membership.total_count} members`,
      percent: summary.membership.percent,
      color: "bg-[#14812a]",
      iconBg: "bg-[#14812a]",
      icon: <MembersOutlineIcon />,
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
      icon: <PercentIcon />,
    },
    {
      title: "Attendance",
      subtitle: `${summary.attendance.average_count} attended last meeting`,
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

const navItems = [
  { id: "dashboard" as const, label: "Dashboard", icon: <HomeIcon /> },
  { id: "profile" as const, label: "My Profile", icon: <PersonIcon /> },
];

const secretaryNavItems: { id: SecretaryNavItemId; label: string; icon: ReactNode }[] = [
  { id: "dashboard", label: "Dashboard", icon: <HomeIcon /> },
  { id: "profile", label: "My Profile", icon: <PersonIcon /> },
  { id: "documents", label: "Documents", icon: <FolderIcon /> },
  { id: "more", label: "More", icon: <DotsIcon /> },
];

const appendantBodyDetails: Record<string, { name: string; subtitle: string; logoPath: string }> = {
  "A&ASR": {
    name: "Ancient & Accepted Scottish Rite",
    subtitle: "A&ASR",
    logoPath: "/branding/appendant-bodies/aasr.png",
  },
  "YORK RITE": {
    name: "York Rite",
    subtitle: "York Rite",
    logoPath: "/branding/appendant-bodies/york-rite.png",
  },
  "AAONMS (SHRINER)": {
    name: "Shriner",
    subtitle: "AAONMS (Shriner)",
    logoPath: "/branding/appendant-bodies/shriner.png",
  },
  GGOKCS: {
    name: "GGOKCS",
    subtitle: "Appendant body / club",
    logoPath: "/branding/appendant-bodies/ggokcs.png",
  },
  "PAK (TURTLE)": {
    name: "PAK (Turtle)",
    subtitle: "Appendant body / club",
    logoPath: "/branding/appendant-bodies/pak-turtle.png",
  },
  OSM: {
    name: "OSM",
    subtitle: "Appendant body / club",
    logoPath: "/branding/appendant-bodies/osm.png",
  },
  BIRTH: {
    name: "BIRTH",
    subtitle: "Appendant body / club",
    logoPath: "/branding/appendant-bodies/birth.png",
  },
  BAGWIS: {
    name: "BAGWIS",
    subtitle: "Appendant body / club",
    logoPath: "/branding/appendant-bodies/bagwis.png",
  },
  "PNPA BEST": {
    name: "PNPA BEST",
    subtitle: "Appendant body / club",
    logoPath: "/branding/appendant-bodies/pnpa_best.png",
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function minimumLoadingDelay(ms = 250): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function localDateTimeToIso(dateValue: string, timeValue: string): string | null {
  const parsedDate = parseActivityDateInput(dateValue);
  const parsedTime = parseActivityTimeInput(timeValue);
  if (parsedDate === null || parsedTime === null) {
    return null;
  }
  return new Date(
    parsedDate.year,
    parsedDate.monthIndex,
    parsedDate.day,
    parsedTime.hour,
    parsedTime.minute,
  ).toISOString();
}

function parseActivityDateInput(value: string): { year: number; monthIndex: number; day: number } | null {
  const normalized = value.trim();
  const isoMatch = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const slashMatch = normalized.match(/^(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})$/);
  const parts = isoMatch
    ? { year: Number(isoMatch[1]), month: Number(isoMatch[2]), day: Number(isoMatch[3]) }
    : slashMatch
      ? { year: Number(slashMatch[3]), month: Number(slashMatch[1]), day: Number(slashMatch[2]) }
      : null;
  if (parts === null || parts.month < 1 || parts.month > 12 || parts.day < 1 || parts.day > 31) {
    return null;
  }
  const date = new Date(parts.year, parts.month - 1, parts.day);
  if (date.getFullYear() !== parts.year || date.getMonth() !== parts.month - 1 || date.getDate() !== parts.day) {
    return null;
  }
  return { year: parts.year, monthIndex: parts.month - 1, day: parts.day };
}

function parseActivityTimeInput(value: string): { hour: number; minute: number } | null {
  const normalized = value.trim().replace(/\s*:\s*/g, ":").replace(/\s+/g, " ");
  const match = normalized.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) {
    return null;
  }
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (minute < 0 || minute > 59) {
    return null;
  }
  if (meridiem) {
    if (hour < 1 || hour > 12) {
      return null;
    }
    if (meridiem === "AM") {
      hour = hour === 12 ? 0 : hour;
    } else {
      hour = hour === 12 ? 12 : hour + 12;
    }
  } else if (hour < 0 || hour > 23) {
    return null;
  }
  return { hour, minute };
}

function formatActivityDateInput(value: string): string {
  const parsed = parseActivityDateInput(value);
  if (parsed === null) {
    return value;
  }
  return `${String(parsed.monthIndex + 1).padStart(2, "0")}/${String(parsed.day).padStart(2, "0")}/${parsed.year}`;
}

function datePickerValueToDisplay(value: string): string {
  return formatActivityDateInput(value);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to read this image."));
    image.src = src;
  });
}

function getCropSourceRect(image: CropImageMeta, crop: CropState) {
  const baseCropSize = Math.min(image.width, image.height);
  const sourceSize = Math.max(1, baseCropSize / crop.zoom);
  const maxSourceX = Math.max(0, image.width - sourceSize);
  const maxSourceY = Math.max(0, image.height - sourceSize);
  const centerX = maxSourceX / 2;
  const centerY = maxSourceY / 2;
  const sourceX = clamp(centerX + (crop.x / 100) * centerX, 0, maxSourceX);
  const sourceY = clamp(centerY + (crop.y / 100) * centerY, 0, maxSourceY);

  return { sourceX, sourceY, sourceSize };
}

function getCropPreviewStyle(meta: CropImageMeta | null, crop: CropState) {
  if (meta === null) {
    return undefined;
  }

  const previewSize = 208;
  const { sourceX, sourceY, sourceSize } = getCropSourceRect(meta, crop);
  const scale = previewSize / sourceSize;

  return {
    width: `${meta.width * scale}px`,
    height: `${meta.height * scale}px`,
    maxWidth: "none",
    transform: `translate(${-sourceX * scale}px, ${-sourceY * scale}px)`,
    transformOrigin: "top left",
  };
}

async function createCroppedProfilePhotoBlob(src: string, crop: CropState): Promise<Blob> {
  const image = await loadImage(src);
  const canvas = document.createElement("canvas");
  const outputSize = 512;
  canvas.width = outputSize;
  canvas.height = outputSize;
  const { sourceX, sourceY, sourceSize } = getCropSourceRect(
    { width: image.naturalWidth, height: image.naturalHeight },
    crop,
  );

  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Your browser could not prepare the cropped photo.");
  }

  context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, outputSize, outputSize);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob === null) {
          reject(new Error("Your browser could not export the cropped photo."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      0.88,
    );
  });
}

function formatMemberSince(value: string | null): string {
  if (!value) {
    return "Membership date not recorded";
  }
  return `Member since ${new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`))}`;
}

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
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
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function calendarAddedStorageKey(activityId: number): string {
  return `${calendarAddedStoragePrefix}${activityId}`;
}

function displayValue(value: string | null | undefined): string {
  return value && value.trim() ? value : "-";
}

function excelSerialToDate(value: string): string {
  const num = parseFloat(value);
  if (!Number.isFinite(num) || num < 1 || num > 100000) return value;
  const utc = new Date(Date.UTC(1899, 11, 30 + Math.floor(num)));
  return `${utc.getFullYear()}-${String(utc.getMonth()+1).padStart(2,'0')}-${String(utc.getDate()).padStart(2,'0')}`;
}

function dateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const num = parseFloat(value);
  if (Number.isFinite(num) && num > 36526 && num < 100000) {
    return excelSerialToDate(value);
  }
  return value.slice(0, 10);
}

function nullableDate(value: string): string | null {
  return value ? value : null;
}

function currentYearString(): string {
  return String(new Date().getFullYear());
}

function workbookCellValue(cell: unknown): string {
  if (cell === null || cell === undefined) {
    return "";
  }
  if (typeof cell === "object" && !Array.isArray(cell) && "value" in cell) {
    const obj = cell as { value?: unknown };
    const value = obj.value;
    if (value === null || value === undefined) return "";
    const num = typeof value === "number" ? value : parseFloat(String(value));
    if (Number.isFinite(num) && num > 36526 && num < 100000) {
      const utc = new Date(Date.UTC(1899, 11, 30 + Math.floor(num)));
      return `${utc.getFullYear()}-${String(utc.getMonth()+1).padStart(2,'0')}-${String(utc.getDate()).padStart(2,'0')}`;
    }
    return String(value);
  }
  return String(cell);
}

function createWorkbookCell(value = "") {
  return {
    value,
    formula: null,
    style_id: null,
    number_format: "builtin:0",
  };
}

function workbookRecordToRows(record: Record<string, unknown>): WorkbookCellRow[] {
  return Object.entries(record ?? {}).map(([key, original]) => ({
    key,
    value: workbookCellValue(original),
    original,
  }));
}

function appendantKeyForCode(code: string): string {
  return `APPENDANT BODIES / CLUB / ${code}`;
}

function appendantRows(record: Record<string, unknown>): WorkbookCellRow[] {
  const importedRows = workbookRecordToRows(record);
  const importedByCode = new Map(importedRows.map((row) => [appendantBodyCode(row.key).toUpperCase(), row]));
  const seen = new Set<string>();
  const knownRows = Object.keys(appendantBodyDetails)
    .filter((code) => {
      const upper = code.toUpperCase();
      if (seen.has(upper)) return false;
      seen.add(upper);
      return true;
    })
    .map((code) => {
      const existing = importedByCode.get(code.toUpperCase());
      return existing ?? {
        key: appendantKeyForCode(code),
        value: "",
        original: createWorkbookCell(""),
      };
    });
  const extraRows = importedRows.filter((row) => {
    const code = appendantBodyCode(row.key).toUpperCase();
    return !appendantBodyDetails[code]
      && !appendantBodyDetails[code.replace(/^SHRINER$/, "AAONMS (SHRINER)").replace(/^AAONMS$/, "AAONMS (SHRINER)").replace(/^PAK \(TURTLE\)$/i, "PAK (TURTLE)")];
  });
  return [...knownRows, ...extraRows];
}

function workbookKeyYear(key: string): number {
  const match = key.match(/(?:^|\D)(20\d{2}|19\d{2})(?:\D|$)/);
  return match ? Number(match[1]) : 0;
}

function workbookKeyMonthIndex(key: string): number {
  const normalized = key.toLowerCase();
  const index = monthOptions.findIndex((month) => normalized.includes(month.toLowerCase()));
  return index;
}

function sortedWorkbookRows(rows: WorkbookCellRow[], type: "meeting" | "monthly" | "dues"): WorkbookCellRow[] {
  return [...rows].sort((a, b) => {
    const yearDiff = workbookKeyYear(b.key) - workbookKeyYear(a.key);
    if (yearDiff !== 0) {
      return yearDiff;
    }
    if (type === "monthly") {
      const monthDiff = workbookKeyMonthIndex(b.key) - workbookKeyMonthIndex(a.key);
      if (monthDiff !== 0) {
        return monthDiff;
      }
    }
    return b.key.localeCompare(a.key);
  });
}

function workbookRowsToRecord(rows: WorkbookCellRow[]): Record<string, unknown> {
  return rows.reduce<Record<string, unknown>>((result, row) => {
    const key = row.key.trim();
    if (!key) {
      return result;
    }
    if (row.original && typeof row.original === "object" && !Array.isArray(row.original)) {
      result[key] = { ...row.original, value: row.value };
    } else {
      result[key] = row.value;
    }
    return result;
  }, {});
}

function editableMemberForm(profile: MemberEditableProfile | PetitionerEditableProfile): EditableMemberForm {
  const positions = profile.positions_held.map((position) => ({
    title: position.title,
    date_range: position.date_range,
    start_date: position.start_date,
    end_date: position.end_date,
    notes: position.notes,
    source: position.source,
  }));
  return {
    section: profile.section,
    member_number: profile.member_number,
    name: profile.name,
    glp_id_number: "glp_id_number" in profile ? profile.glp_id_number : "",
    date_of_birth: "date_of_birth" in profile ? profile.date_of_birth : undefined,
    initiation_date: profile.initiation_date,
    passing_date: profile.passing_date,
    raising_date: profile.raising_date,
    proficiency_date: profile.proficiency_date,
    date_presented: profile.date_presented ?? null,
    date_balloted: profile.date_balloted ?? null,
    suspension: profile.suspension,
    restored: profile.restored,
    demit: profile.demit,
    lml: profile.lml,
    dual_plural_honorary_date: profile.dual_plural_honorary_date,
    address: "address" in profile ? profile.address : undefined,
    telephone: profile.telephone,
    email: profile.email,
    blood_type: profile.blood_type,
    widow_or_sister: profile.widow_or_sister,
    widow_or_sister_date_of_birth: profile.widow_or_sister_date_of_birth,
    positions_held: positions,
    appendantBodiesRows: appendantRows(profile.appendant_bodies),
    meetingAttendanceRows: sortedWorkbookRows(workbookRecordToRows(profile.meeting_attendance), "meeting"),
    monthlyAttendanceRows: sortedWorkbookRows(workbookRecordToRows(profile.monthly_attendance), "monthly"),
    annualDuesRows: sortedWorkbookRows(workbookRecordToRows(profile.annual_dues), "dues"),
  };
}

function appendantBodyCode(rawKey: string): string {
  return rawKey.split("/").at(-1)?.trim() ?? rawKey.trim();
}

function hasAppendantBodyValue(value: unknown): boolean {
  if (value === null || value === undefined || value === "") {
    return false;
  }
  if (typeof value === "object" && "value" in value) {
    const cellValue = (value as { value?: unknown }).value;
    return cellValue !== null && cellValue !== undefined && cellValue !== "";
  }
  return true;
}

function appendantBodyItems(appendantBodies: Record<string, unknown>): AppendantBodyItem[] {
  return Object.entries(appendantBodies)
    .filter(([, value]) => hasAppendantBodyValue(value))
    .map(([key]) => {
      const code = appendantBodyCode(key);
      const details = appendantBodyDetails[code.toUpperCase()] ?? {
        name: code,
        subtitle: "Appendant body / club",
        logoPath: "/branding/appendant-bodies/placeholder.svg",
      };
      return {
        key,
        name: details.name,
        subtitle: details.subtitle,
        logoPath: details.logoPath,
      };
    });
}

function profileDisplayName(fullName: string): string {
  const cleanName = fullName.replace(/^(Mr\.|FCM|EAM)\s+/i, "").replace(/[+*]/g, "").trim();
  if (!cleanName.includes(",")) {
    return cleanName || "Brother";
  }
  const [lastName, restName] = cleanName.split(",");
  const firstName = restName?.trim().split(/\s+/)[0] || "Brother";
  return `${firstName} ${lastName.trim()}`;
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
  if (normalized.includes("SUSPENDED")) {
    return "suspended";
  }
  if (normalized.includes("DEMIT")) {
    return "demit";
  }
  if (normalized.includes("HONORARY")) {
    return "honorary";
  }
  if (normalized.includes("DUAL") || normalized.includes("PLURAL") || normalized.includes("AFFILIATED")) {
    return "dual_plural";
  }
  return "regular";
}

function memberGroupLabel(status: string): string {
  const normalized = status.toUpperCase();
  if (normalized.includes("DROPED") || normalized.includes("DROPPED") || normalized.includes("WORKING TOOLS")) {
    return "Dropped Working Tools";
  }
  if (normalized.includes("SUSPENDED")) {
    return "Suspended";
  }
  if (normalized.includes("DEMIT")) {
    return "Demit";
  }
  if (normalized.includes("HONORARY")) {
    return "Honorary";
  }
  if (normalized.includes("DUAL") || normalized.includes("PLURAL")) {
    return "Dual/Plural";
  }
  if (normalized.includes("AFFILIATED")) {
    return "Affiliated";
  }
  return "Regular";
}

function memberGroupDetails(group: MemberGroupKey, groups: MemberGroupDisplay[]) {
  return groups.find((filter) => filter.key === group) ?? groups[0] ?? buildMemberDisplayGroups(null)[0];
}

function memberGroupDetailsForMember(member: MemberListItem | PetitionerListItem, groups: MemberGroupDisplay[]) {
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

function petitionerStageForRecord(name: string, section: string): PetitionerStage {
  const normalizedName = name.trim().toUpperCase();
  const normalizedSection = section.trim().toUpperCase();
  const combined = `${normalizedSection} ${normalizedName}`;
  if (normalizedSection.includes("NOT ACTIVE") || normalizedSection.includes("INACTIVE")) return "inactive";
  if (combined.includes("RE-APPLY") || combined.includes("RE APPLY") || combined.includes("REAPPLY")) return "re_apply";
  if (combined.includes("CIRCULAT")) return "circulated";
  if (combined.includes("BALLOT")) return "balloted";
  if (/\bFCM\b/.test(normalizedSection)) return "fcm";
  if (/\bEAM\b/.test(normalizedSection)) return "eam";
  if (normalizedName.startsWith("FCM ")) return "fcm";
  if (normalizedName.startsWith("EAM ")) return "eam";
  return "circulated";
}

function petitionerGroupDetails(stage: PetitionerStage) {
  return petitionerEditGroups.find((group) => group.key === stage) ?? petitionerEditGroups[4];
}

function workbookRowLabel(key: string): string {
  const parts = key.split("/");
  return (parts.at(-1) ?? key).trim() || key;
}

function WorkbookRowsEditor({
  title,
  rows,
  emptyText,
  mode = "text",
  addLabel,
  onAdd,
  onChange,
}: {
  title: string;
  rows: WorkbookCellRow[];
  emptyText: string;
  mode?: "mark" | "text" | "date";
  addLabel?: string;
  onAdd?: () => void;
  onChange: (rows: WorkbookCellRow[]) => void;
}) {
  function updateRow(index: number, value: string) {
    onChange(rows.map((row, rowIndex) => rowIndex === index ? { ...row, value } : row));
  }

  function clearFilledRows() {
    onChange(rows.map((row) => ({ ...row, value: "" })));
  }

  function toggleMarked(index: number) {
    onChange(rows.map((row, rowIndex) => (
      rowIndex === index ? { ...row, value: row.value.trim() ? "" : "a" } : row
    )));
  }

  const filledCount = rows.filter((row) => row.value.trim()).length;

  return (
    <div className="rounded-[0.82rem] border border-[#efe4d8] bg-[#fffdfb] p-2.5">
      <div className="flex items-center justify-between gap-3">
        <span>
          <span className="block text-[0.7rem] font-bold text-[#111111]">{title}</span>
          <span className="mt-0.5 block text-[0.58rem] text-[#706760]">{filledCount} of {rows.length}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {rows.length > 0 ? (
            <button type="button" onClick={clearFilledRows} className="rounded-full bg-[#fff4e3] px-2.5 py-1 text-[0.58rem] font-bold text-[#a76a00]">
              Clear
            </button>
          ) : null}
          {onAdd ? (
            <button type="button" onClick={onAdd} className="rounded-full bg-[#d40000] px-2.5 py-1 text-[0.58rem] font-bold text-white">
              {addLabel ?? "Add"}
            </button>
          ) : null}
        </span>
      </div>
      <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {rows.length > 0 ? rows.map((row, index) => (
          <div key={`${row.key}-${index}`} className="grid grid-cols-[minmax(0,1.2fr)_minmax(4.8rem,0.72fr)] items-center gap-2 rounded-[0.62rem] border border-[#f1e8de] bg-white px-2 py-1.5">
            <span className="min-w-0">
              <span className="block truncate text-[0.63rem] font-semibold text-[#2f2925]">{workbookRowLabel(row.key)}</span>
              <span className="mt-0.5 block truncate text-[0.5rem] text-[#817871]">{row.key}</span>
            </span>
            {mode === "mark" ? (
              <button
                type="button"
                onClick={() => toggleMarked(index)}
                className={`h-8 min-w-0 rounded-[0.48rem] border px-2 text-[0.6rem] font-extrabold ${row.value.trim() ? "border-[#bfe8c7] bg-[#f2fbf4] text-[#009622]" : "border-[#ded6cf] bg-[#fffdfb] text-[#817871]"}`}
                aria-pressed={Boolean(row.value.trim())}
              >
                {row.value.trim() ? "Marked" : "Blank"}
              </button>
            ) : mode === "date" ? (
              <input
                type="date"
                value={dateInputValue(row.value)}
                onChange={(event) => updateRow(index, event.target.value)}
                className="h-8 min-w-0 rounded-[0.48rem] border border-[#ded6cf] bg-[#fffdfb] px-1.5 text-[0.62rem] font-semibold text-[#111111] outline-none [color-scheme:light]"
              />
            ) : (
              <input
                value={row.value}
                onChange={(event) => updateRow(index, event.target.value)}
                placeholder="-"
                className="h-8 min-w-0 rounded-[0.48rem] border border-[#ded6cf] bg-[#fffdfb] px-2 text-[0.66rem] font-semibold text-[#111111] outline-none placeholder:text-[#b0a7a0]"
              />
            )}
          </div>
        )) : (
          <p className="rounded-[0.62rem] bg-[#fbf7f0] px-3 py-3 text-center text-[0.64rem] text-[#665d57]">{emptyText}</p>
        )}
      </div>
    </div>
  );
}

export function MemberDashboardScreen({
  profile,
  onLogout,
  initialView = "home",
  initialTab = "dashboard",
  onDashboardClose,
  onProfileClose,
  onDocumentsOpen,
  canManageActivities = false,
  canEditMembers = false,
  canEditPetitioners = false,
  dashboardCardVisibility = defaultDashboardCardVisibility,
}: MemberDashboardScreenProps) {
  useIdleTimeout();

  const isProfileOnly = initialView === "profile";
  const usesSecretaryNav = onDashboardClose !== undefined || onProfileClose !== undefined;
  const hasAccountTools = canManageActivities || canEditMembers || canEditPetitioners;
  const contextualNavItems = usesSecretaryNav
    ? secretaryNavItems.filter((item) => item.id !== "documents" || onDocumentsOpen !== undefined)
    : hasAccountTools ? [...navItems, { id: "more" as const, label: "More", icon: <DotsIcon /> }] : navItems;
  const contextualNavGridClass = usesSecretaryNav
    ? contextualNavItems.length === 4 ? "grid-cols-4" : "grid-cols-3"
    : contextualNavItems.length === 3 ? "grid-cols-3" : "grid-cols-2";
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activityStartDateRef = useRef<HTMLInputElement | null>(null);
  const activityEndDateRef = useRef<HTMLInputElement | null>(null);
  const activityStartDatePickerRef = useRef<HTMLInputElement | null>(null);
  const activityEndDatePickerRef = useRef<HTMLInputElement | null>(null);
  const editMemberDetailsRef = useRef<HTMLElement | null>(null);
  const [activeView, setActiveView] = useState<MemberDashboardView>(initialView);
  const [isProfileViewClosing, setIsProfileViewClosing] = useState(false);
  const [isMembersViewClosing, setIsMembersViewClosing] = useState(false);
  const [isActivityFormClosing, setIsActivityFormClosing] = useState(false);
  const [isMemberEditClosing, setIsMemberEditClosing] = useState(false);
  const [editReturnView, setEditReturnView] = useState<MemberDashboardView>("home");
  const [memberAccountStatus, setMemberAccountStatus] = useState<{ status: string; account_exists: boolean; account_is_active: boolean; preidentified_exists: boolean; email: string } | null>(null);
  const [isAccountActionLoading, setIsAccountActionLoading] = useState(false);
  const [fullProfile, setFullProfile] = useState<MemberFullProfile | null>(null);
  const [activeTab, setActiveTab] = useState<MemberDashboardTab>(initialTab);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [cropImageMeta, setCropImageMeta] = useState<CropImageMeta | null>(null);
  const [crop, setCrop] = useState<CropState>({ zoom: 1, x: 0, y: 0 });
  const [photoError, setPhotoError] = useState("");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [memberSummaryGroups, setMemberSummaryGroups] = useState<MemberSummaryGroup[] | null>(null);
  const [isMemberSummaryLoading, setIsMemberSummaryLoading] = useState(true);
  const [memberSummaryError, setMemberSummaryError] = useState("");
  const [activeMemberFilter, setActiveMemberFilter] = useState<MemberGroupKey>("active");
  const [memberSearch, setMemberSearch] = useState("");
  const [duesFilter, setDuesFilter] = useState<"paid" | "unpaid" | "all">("all");
  const [activePetitionerStage, setActivePetitionerStage] = useState<PetitionerStage>("circulated");
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
  const [isEventListMode, setIsEventListMode] = useState(false);
  const [isEventListSheetOpen, setIsEventListSheetOpen] = useState(false);
  const [eventListActivities, setEventListActivities] = useState<LodgeActivity[]>([]);
  const [isEventListLoading, setIsEventListLoading] = useState(false);
  const [eventListError, setEventListError] = useState("");
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [isAppendantSheetOpen, setIsAppendantSheetOpen] = useState(false);
  const [isPaymentSheetOpen, setIsPaymentSheetOpen] = useState(false);
  const [isPositionsSheetOpen, setIsPositionsSheetOpen] = useState(false);
  const [closingSheet, setClosingSheet] = useState<MemberSheetName | null>(null);
  const [positionsHeld, setPositionsHeld] = useState<MemberPositionHeld[] | null>(null);
  const [isPositionsLoading, setIsPositionsLoading] = useState(false);
  const [positionsError, setPositionsError] = useState("");
  const [activityTitle, setActivityTitle] = useState("");
  const [activityDetails, setActivityDetails] = useState("");
  const [activityPlace, setActivityPlace] = useState("");
  const [activityStartDate, setActivityStartDate] = useState("");
  const [activityStartTime, setActivityStartTime] = useState("");
  const [activityEndDate, setActivityEndDate] = useState("");
  const [activityEndTime, setActivityEndTime] = useState("");
  const [activityStatus, setActivityStatus] = useState<LodgeActivityFormPayload["status"]>("scheduled");
  const [isActivityPublished, setIsActivityPublished] = useState(true);
  const [isSavingActivity, setIsSavingActivity] = useState(false);
  const [activityFormError, setActivityFormError] = useState("");
  const [activitySuccessToast, setActivitySuccessToast] = useState("");
  const [activityTimePicker, setActivityTimePicker] = useState<ActivityTimePickerState | null>(null);
  const [activityScreenTab, setActivityScreenTab] = useState<ActivityScreenTab>("create");
  const [managedActivities, setManagedActivities] = useState<LodgeActivity[]>([]);
  const [managedActivitySearch, setManagedActivitySearch] = useState("");
  const [isManagedActivitiesLoading, setIsManagedActivitiesLoading] = useState(false);
  const [managedActivitiesError, setManagedActivitiesError] = useState("");
  const [activityToDelete, setActivityToDelete] = useState<LodgeActivity | null>(null);
  const [isDeletingActivity, setIsDeletingActivity] = useState(false);
  const [activityDeleteError, setActivityDeleteError] = useState("");
  const [editMemberSearch, setEditMemberSearch] = useState("");
  const [editMemberFilter, setEditMemberFilter] = useState<MemberGroupKey>("active");
  const [editPetitionerStage, setEditPetitionerStage] = useState<PetitionerStage>("circulated");
  const [editMemberList, setEditMemberList] = useState<Array<MemberListItem | PetitionerListItem>>([]);
  const [editMemberListCount, setEditMemberListCount] = useState(0);
  const [isEditMemberListLoading, setIsEditMemberListLoading] = useState(false);
  const [editMemberListError, setEditMemberListError] = useState("");
  const [selectedEditMember, setSelectedEditMember] = useState<MemberEditableProfile | PetitionerEditableProfile | null>(null);
  const [editMemberForm, setEditMemberForm] = useState<EditableMemberForm | null>(null);
  const [isEditMemberLoading, setIsEditMemberLoading] = useState(false);
  const [editMemberFormError, setEditMemberFormError] = useState("");
  const [editMemberSuccessToast, setEditMemberSuccessToast] = useState("");
  const [isSavingMemberEdit, setIsSavingMemberEdit] = useState(false);
  const [workbookAddSheet, setWorkbookAddSheet] = useState<WorkbookAddSheetKind | null>(null);
  const [workbookAddYear, setWorkbookAddYear] = useState(currentYearString());
  const [workbookAddMeeting, setWorkbookAddMeeting] = useState(defaultWorkbookMeetingName);
  const [workbookAddPeriod, setWorkbookAddPeriod] = useState(monthOptions[new Date().getMonth()]);
  const [workbookAddValue, setWorkbookAddValue] = useState("a");
  const [workbookAddError, setWorkbookAddError] = useState("");
  const [dashboardSummary, setDashboardSummary] =
    useState<SecretaryDashboardSummaryResponse>(emptyDashboardSummary);

  const memberDisplayGroups = useMemo(
    () => buildMemberDisplayGroups(memberSummaryGroups),
    [memberSummaryGroups],
  );
  const resolvedActiveMemberFilter = memberDisplayGroups.some((group) => group.key === activeMemberFilter)
    ? activeMemberFilter
    : memberDisplayGroups[0]?.key ?? activeMemberFilter;
  const resolvedEditMemberFilter = memberDisplayGroups.some((group) => group.key === editMemberFilter)
    ? editMemberFilter
    : memberDisplayGroups[0]?.key ?? editMemberFilter;
  const isPetitionerEdit = activeView === "petitioner-edit";

  useEffect(() => {
    return () => {
      if (selectedPhotoUrl !== null) {
        URL.revokeObjectURL(selectedPhotoUrl);
      }
    };
  }, [selectedPhotoUrl]);

  useEffect(() => {
    if (usesSecretaryNav) {
      return;
    }
    const screenByView: Record<Exclude<MemberDashboardView, "home">, ActivityScreen> = {
      profile: "My Profile",
      members: "Members",
      petitioners: "Petitioners",
      activity: "Activity Management",
      "member-edit": "Edit Member",
      "petitioner-edit": "Edit Petitioner",
      dues: "Dues",
    };
    const screen = activeView === "home"
      ? (activeTab === "profile" ? "My Profile" : activeTab === "more" ? "More" : "Dashboard")
      : screenByView[activeView];
    trackScreenView(screen);
  }, [activeTab, activeView, usesSecretaryNav]);

  useEffect(() => {
    let isMounted = true;

    async function loadMemberSummary() {
      setIsMemberSummaryLoading(true);
      setMemberSummaryError("");
      try {
        const [summary] = await Promise.all([
          getMemberSummary(),
          minimumLoadingDelay(),
        ]);
        if (isMounted) {
          setMemberSummaryGroups(summary.groups);
        }
      } catch (error) {
        if (isMounted) {
          setMemberSummaryError(error instanceof Error ? error.message : "Unable to load member summary.");
        }
      } finally {
        if (isMounted) {
          setIsMemberSummaryLoading(false);
        }
      }
    }

    void loadMemberSummary();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardSummary() {
      try {
        const summary = await getSecretaryDashboardSummary();
        if (isMounted) {
          setDashboardSummary(normalizeDashboardSummary(summary));
        }
      } catch {
        if (isMounted) {
          setDashboardSummary(normalizeDashboardSummary({}));
        }
      }
    }

    void loadDashboardSummary();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isProfileOnly || profile === null || fullProfile !== null || isProfileLoading) {
      return;
    }

    void openFullProfile();
  }, [profile, fullProfile, isProfileLoading, isProfileOnly]);

  useEffect(() => {
    if ((activeView !== "members" && activeView !== "dues") || memberSummaryGroups === null) {
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
    const canLoadMembers = activeView === "member-edit" && canEditMembers && memberSummaryGroups !== null;
    const canLoadPetitioners = activeView === "petitioner-edit" && canEditPetitioners;
    if (!canLoadMembers && !canLoadPetitioners) {
      return;
    }

    let isMounted = true;
    const debounce = window.setTimeout(() => {
      async function loadEditableMembers() {
        setIsEditMemberListLoading(true);
        setEditMemberListError("");
        try {
          const [response] = await Promise.all([
            canLoadPetitioners
              ? getPetitionerList(editPetitionerStage, editMemberSearch)
              : getMemberList(resolvedEditMemberFilter, editMemberSearch),
            minimumLoadingDelay(),
          ]);
          if (isMounted) {
            setEditMemberList("petitioners" in response ? response.petitioners : response.members);
            setEditMemberListCount(response.count);
          }
        } catch (error) {
          if (isMounted) {
            setEditMemberListError(error instanceof Error ? error.message : `Unable to load ${canLoadPetitioners ? "petitioners" : "members"}.`);
          }
        } finally {
          if (isMounted) {
            setIsEditMemberListLoading(false);
          }
        }
      }

      void loadEditableMembers();
    }, 300);

    return () => {
      isMounted = false;
      window.clearTimeout(debounce);
    };
  }, [activeView, canEditMembers, canEditPetitioners, resolvedEditMemberFilter, editPetitionerStage, editMemberSearch, memberSummaryGroups]);

  useEffect(() => {
    if (activeView !== "activity" || activityScreenTab !== "list") {
      return;
    }

    let isMounted = true;
    const debounce = window.setTimeout(() => {
      async function loadManagedActivities() {
        setIsManagedActivitiesLoading(true);
        setManagedActivitiesError("");
        try {
          const [response] = await Promise.all([
            getManagedLodgeActivities(managedActivitySearch),
            minimumLoadingDelay(),
          ]);
          if (isMounted) {
            setManagedActivities(response.activities);
          }
        } catch (error) {
          if (isMounted) {
            setManagedActivitiesError(error instanceof Error ? error.message : "Unable to load activities.");
          }
        } finally {
          if (isMounted) {
            setIsManagedActivitiesLoading(false);
          }
        }
      }

      void loadManagedActivities();
    }, 300);

    return () => {
      isMounted = false;
      window.clearTimeout(debounce);
    };
  }, [activeView, activityScreenTab, managedActivitySearch]);

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

  function openPhotoSelector() {
    setPhotoError("");
    fileInputRef.current?.click();
  }

  async function handlePhotoSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setPhotoError("Please select an image file.");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setPhotoError("Please choose an image smaller than 8 MB.");
      return;
    }

    if (selectedPhotoUrl !== null) {
      URL.revokeObjectURL(selectedPhotoUrl);
    }
    const nextUrl = URL.createObjectURL(file);
    try {
      const image = await loadImage(nextUrl);
      setSelectedPhotoUrl(nextUrl);
      setCropImageMeta({ width: image.naturalWidth, height: image.naturalHeight });
      setCrop({ zoom: 1, x: 0, y: 0 });
      setPhotoError("");
      setIsPhotoModalOpen(true);
    } catch (error) {
      URL.revokeObjectURL(nextUrl);
      setPhotoError(error instanceof Error ? error.message : "Unable to read this image.");
    }
  }

  async function saveProfilePhoto(memberId: number) {
    if (selectedPhotoUrl === null) {
      setPhotoError("Please choose a photo first.");
      return;
    }

    setIsUploadingPhoto(true);
    setPhotoError("");
    try {
      const croppedPhoto = await createCroppedProfilePhotoBlob(selectedPhotoUrl, crop);
      const [response] = await Promise.all([
        isPetitionerEdit
          ? uploadPetitionerProfilePhotoById(memberId, croppedPhoto)
          : uploadMemberProfilePhotoById(memberId, croppedPhoto),
        minimumLoadingDelay(),
      ]);
      if (selectedEditMember) {
        setSelectedEditMember((prev) => prev ? { ...prev, profile_photo_url: response.member_profile.profile_photo_url } : prev);
      }
      setIsPhotoModalOpen(false);
      URL.revokeObjectURL(selectedPhotoUrl);
      setSelectedPhotoUrl(null);
      setCropImageMeta(null);
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "Unable to upload this photo.");
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  async function openFullProfile() {
    setIsProfileLoading(true);
    setProfileError("");
    setFullProfile(null);
    setIsProfileViewClosing(false);
    setActiveView("profile");
    try {
      const [profileData] = await Promise.all([
        getMyMemberProfile(),
        minimumLoadingDelay(150),
      ]);
      setFullProfile(profileData);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Unable to load your member profile.");
    } finally {
      setIsProfileLoading(false);
    }
  }

  function closeFullProfile(nextTab?: MemberDashboardTab) {
    setIsProfileViewClosing(true);
    window.setTimeout(() => {
      if (isProfileOnly) {
        (onDashboardClose ?? onProfileClose)?.();
        setIsProfileViewClosing(false);
        return;
      }
      setActiveView("home");
      setIsProfileViewClosing(false);
      if (nextTab !== undefined) {
        setActiveTab(nextTab);
      }
    }, 230);
  }

  function openMembersList(group: MemberGroupKey) {
    setActiveMemberFilter(group);
    setMemberSearch("");
    setMemberList([]);
    setMemberListCount(0);
    setMemberListError("");
    setIsMembersViewClosing(false);
    setActiveView("members");
  }

  function openPetitionerList(stage: PetitionerStage) {
    setActivePetitionerStage(stage);
    setActiveView("petitioners");
  }

  function closeMembersList(nextTab?: MemberDashboardTab) {
    setIsMembersViewClosing(true);
    window.setTimeout(() => {
      setActiveView("home");
      setIsMembersViewClosing(false);
      if (nextTab !== undefined) {
        setActiveTab(nextTab);
      }
    }, 230);
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

  function openActivityForm() {
    resetActivityForm();
    setActivityFormError("");
    setActivitySuccessToast("");
    setActivityScreenTab("create");
    setManagedActivitySearch("");
    setManagedActivitiesError("");
    setActivityToDelete(null);
    setIsActivityFormClosing(false);
    setActiveView("activity");
  }

  function closeActivityForm() {
    setIsActivityFormClosing(true);
    window.setTimeout(() => {
      setActiveView("home");
      setActiveTab("dashboard");
      setIsActivityFormClosing(false);
    }, 230);
  }

  function openMemberEdit() {
    setEditReturnView(activeView);
    setEditMemberFormError("");
    setEditMemberSuccessToast("");
    setSelectedEditMember(null);
    setEditMemberForm(null);
    setIsEditMemberLoading(false);
    setIsMemberEditClosing(false);
    setActiveView("member-edit");
  }

  function openPetitionerEdit() {
    setEditReturnView(activeView);
    setEditMemberFormError("");
    setEditMemberSuccessToast("");
    setSelectedEditMember(null);
    setEditMemberForm(null);
    setEditMemberList([]);
    setEditMemberListCount(0);
    setIsEditMemberLoading(false);
    setIsMemberEditClosing(false);
    setActiveView("petitioner-edit");
  }

  function closeMemberEdit() {
    setIsMemberEditClosing(true);
    window.setTimeout(() => {
      const returnView = editReturnView;
      if (usesSecretaryNav && returnView === "home" && onDashboardClose !== undefined) {
        setIsMemberEditClosing(false);
        onDashboardClose();
        return;
      }
      setActiveView(returnView);
      if (returnView === "home") {
        setActiveTab("dashboard");
      }
      setIsMemberEditClosing(false);
    }, 230);
  }

  async function openEditMemberFor(memberId: number) {
    setEditReturnView(activeView);
    setEditMemberFormError("");
    setEditMemberSuccessToast("");
    setSelectedEditMember(null);
    setEditMemberForm(null);
    setIsMemberEditClosing(false);
    setActiveView("member-edit");
    await selectEditableMember(memberId);
  }

  async function selectEditableMember(memberId: number) {
    setMemberAccountStatus(null);
    setIsEditMemberLoading(true);
    setEditMemberFormError("");
    setEditMemberSuccessToast("");
    try {
      const [profileData] = await Promise.all([
        isPetitionerEdit ? getEditablePetitionerProfile(memberId) : getEditableMemberProfile(memberId),
        minimumLoadingDelay(),
      ]);
      setSelectedEditMember(profileData);
      setEditMemberForm(editableMemberForm(profileData));
      const getAccountStatus = isPetitionerEdit ? getPetitionerAccountStatus : getMemberAccountStatus;
      getAccountStatus(memberId).then(setMemberAccountStatus).catch(() => setMemberAccountStatus(null));
      window.setTimeout(() => {
        editMemberDetailsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 80);
    } catch (error) {
      setEditMemberFormError(error instanceof Error ? error.message : `Unable to load this ${isPetitionerEdit ? "petitioner" : "member"} record.`);
    } finally {
      setIsEditMemberLoading(false);
    }
  }

  async function handleActivateLogin() {
    if (!selectedEditMember) return;
    setIsAccountActionLoading(true);
    try {
      const response = isPetitionerEdit
        ? await activatePetitionerLogin(selectedEditMember.id)
        : await activateMemberLogin(selectedEditMember.id);
      setMemberAccountStatus({
        status: response.status,
        account_exists: response.status === "activated",
        account_is_active: response.status === "activated",
        preidentified_exists: response.status === "pending",
        email: selectedEditMember.email ?? "",
      });
      setEditMemberSuccessToast(response.message);
    } catch (error) {
      setEditMemberFormError(error instanceof Error ? error.message : `Unable to activate ${isPetitionerEdit ? "petitioner" : "member"} login.`);
    } finally {
      setIsAccountActionLoading(false);
    }
  }

  async function handleDeactivateLogin() {
    if (!selectedEditMember) return;
    setIsAccountActionLoading(true);
    try {
      const response = isPetitionerEdit
        ? await deactivatePetitionerLogin(selectedEditMember.id)
        : await deactivateMemberLogin(selectedEditMember.id);
      setMemberAccountStatus({
        status: response.status,
        account_exists: false,
        account_is_active: false,
        preidentified_exists: false,
        email: selectedEditMember.email ?? "",
      });
      setEditMemberSuccessToast(response.message);
    } catch (error) {
      setEditMemberFormError(error instanceof Error ? error.message : `Unable to deactivate ${isPetitionerEdit ? "petitioner" : "member"} login.`);
    } finally {
      setIsAccountActionLoading(false);
    }
  }

  function updateEditMemberField<K extends keyof EditableMemberForm>(field: K, value: EditableMemberForm[K]) {
    setEditMemberForm((current) => current ? { ...current, [field]: value } : current);
  }

  function updateEditMemberPosition(index: number, field: keyof MemberPositionHeldPayload, value: string | null) {
    setEditMemberForm((current) => {
      if (current === null) {
        return current;
      }
      const positions = current.positions_held.map((position, positionIndex) => (
        positionIndex === index ? { ...position, [field]: value } : position
      ));
      return { ...current, positions_held: positions };
    });
  }

  function addEditMemberPosition() {
    setEditMemberForm((current) => current ? {
      ...current,
      positions_held: [
        ...current.positions_held,
        { title: "", date_range: "", start_date: null, end_date: null, notes: "", source: "manual" },
      ],
    } : current);
  }

  function removeEditMemberPosition(index: number) {
    setEditMemberForm((current) => current ? {
      ...current,
      positions_held: current.positions_held.filter((_, positionIndex) => positionIndex !== index),
    } : current);
  }

  function openWorkbookAddSheet(kind: WorkbookAddSheetKind) {
    setWorkbookAddSheet(kind);
    setWorkbookAddYear(currentYearString());
    setWorkbookAddMeeting(defaultWorkbookMeetingName);
    setWorkbookAddPeriod(kind === "monthly" ? monthOptions[new Date().getMonth()] : kind === "meeting" ? "UD" : "");
    setWorkbookAddValue(kind === "dues" ? "Paid" : "a");
    setWorkbookAddError("");
  }

  function closeWorkbookAddSheet() {
    setWorkbookAddSheet(null);
    setWorkbookAddError("");
  }

  function upsertWorkbookRow(rows: WorkbookCellRow[], nextRow: WorkbookCellRow, type: "meeting" | "monthly" | "dues"): WorkbookCellRow[] {
    const nextKey = nextRow.key.trim().toLowerCase();
    const updated = rows.some((row) => row.key.trim().toLowerCase() === nextKey)
      ? rows.map((row) => row.key.trim().toLowerCase() === nextKey ? { ...row, value: nextRow.value } : row)
      : [nextRow, ...rows];
    return sortedWorkbookRows(updated, type);
  }

  function saveWorkbookAddSheet() {
    if (editMemberForm === null || workbookAddSheet === null) {
      return;
    }
    const year = workbookAddYear.trim();
    const meeting = workbookAddMeeting.trim();
    const period = workbookAddPeriod.trim();
    const value = workbookAddValue.trim();
    if (!/^\d{4}$/.test(year)) {
      setWorkbookAddError("Enter a valid year.");
      return;
    }
    if (workbookAddSheet !== "dues" && (!meeting || !period)) {
      setWorkbookAddError("Meeting and period are required.");
      return;
    }
    if (workbookAddSheet === "dues" && !value) {
      setWorkbookAddError("Annual dues value is required.");
      return;
    }

    if (workbookAddSheet === "dues") {
      const row = {
        key: `ANNUAL DUES / ${year}`,
        value,
        original: createWorkbookCell(value),
      };
      setEditMemberForm((current) => current ? {
        ...current,
        annualDuesRows: upsertWorkbookRow(current.annualDuesRows, row, "dues"),
      } : current);
    } else if (workbookAddSheet === "monthly") {
      const row = {
        key: `${year} - ${meeting} / ${period}`,
        value: value || "a",
        original: createWorkbookCell(value || "a"),
      };
      setEditMemberForm((current) => current ? {
        ...current,
        monthlyAttendanceRows: upsertWorkbookRow(current.monthlyAttendanceRows, row, "monthly"),
      } : current);
    } else {
      const row = {
        key: `${year} - ${meeting} / ${period}`,
        value: value || "a",
        original: createWorkbookCell(value || "a"),
      };
      setEditMemberForm((current) => current ? {
        ...current,
        meetingAttendanceRows: upsertWorkbookRow(current.meetingAttendanceRows, row, "meeting"),
      } : current);
    }
    closeWorkbookAddSheet();
  }

  async function saveMemberEdit() {
    if (selectedEditMember === null || editMemberForm === null) {
      setEditMemberFormError(`Please select a ${isPetitionerEdit ? "petitioner" : "member"} first.`);
      return;
    }
    if (!editMemberForm.name.trim()) {
      setEditMemberFormError("Name is required.");
      return;
    }

    const petitionerPayload: PetitionerProfileUpdatePayload = {
      section: editMemberForm.section,
      member_number: editMemberForm.member_number,
      name: editMemberForm.name.trim(),
      date_of_birth: editMemberForm.date_of_birth,
      initiation_date: editMemberForm.initiation_date,
      passing_date: editMemberForm.passing_date,
      raising_date: editMemberForm.raising_date,
      proficiency_date: editMemberForm.proficiency_date,
      date_presented: editMemberForm.date_presented,
      date_balloted: editMemberForm.date_balloted,
      suspension: editMemberForm.suspension,
      restored: editMemberForm.restored,
      demit: editMemberForm.demit,
      lml: editMemberForm.lml,
      dual_plural_honorary_date: editMemberForm.dual_plural_honorary_date,
      address: editMemberForm.address,
      telephone: editMemberForm.telephone,
      email: editMemberForm.email,
      appendant_bodies: workbookRowsToRecord(editMemberForm.appendantBodiesRows),
      blood_type: editMemberForm.blood_type,
      widow_or_sister: editMemberForm.widow_or_sister,
      widow_or_sister_date_of_birth: editMemberForm.widow_or_sister_date_of_birth,
      meeting_attendance: workbookRowsToRecord(editMemberForm.meetingAttendanceRows),
      monthly_attendance: workbookRowsToRecord(editMemberForm.monthlyAttendanceRows),
      annual_dues: workbookRowsToRecord(editMemberForm.annualDuesRows),
      positions_held: editMemberForm.positions_held,
    };
    const memberPayload: MemberProfileUpdatePayload = {
      ...petitionerPayload,
      glp_id_number: editMemberForm.glp_id_number,
    };

    setIsSavingMemberEdit(true);
    setEditMemberFormError("");
    setEditMemberSuccessToast("");
    try {
      const [response] = await Promise.all([
        isPetitionerEdit
          ? updatePetitionerProfile(selectedEditMember.id, petitionerPayload)
          : updateMemberProfile(selectedEditMember.id, memberPayload),
        minimumLoadingDelay(),
      ]);
      setSelectedEditMember(response.member);
      setEditMemberForm(editableMemberForm(response.member));
      setEditMemberSuccessToast(response.message);
      window.setTimeout(() => setEditMemberSuccessToast(""), 3200);
    } catch (error) {
      setEditMemberFormError(error instanceof Error ? error.message : `Unable to save ${isPetitionerEdit ? "petitioner" : "member"} record.`);
    } finally {
      setIsSavingMemberEdit(false);
    }
  }

  function resetActivityForm() {
    setActivityTitle("");
    setActivityDetails("");
    setActivityPlace("");
    setActivityStartDate("");
    setActivityStartTime("");
    setActivityEndDate("");
    setActivityEndTime("");
    setActivityStatus("scheduled");
    setIsActivityPublished(true);
  }

  function openNativePicker(input: HTMLInputElement | null) {
    if (!input) {
      return;
    }
    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }
    input.click();
    input.focus();
  }

  function openActivityTimePicker(target: ActivityTimePickerTarget) {
    const currentValue = target === "start" ? activityStartTime : activityEndTime;
    const parsed = parseActivityTimeInput(currentValue);
    let hour = "05";
    let minute = "00";
    let period: "AM" | "PM" = "PM";
    if (parsed !== null) {
      period = parsed.hour >= 12 ? "PM" : "AM";
      hour = String(parsed.hour % 12 || 12).padStart(2, "0");
      minute = String(parsed.minute).padStart(2, "0");
    }
    setActivityTimePicker({ target, hour, minute, period });
  }

  function applyActivityTimePicker() {
    if (activityTimePicker === null) {
      return;
    }
    const nextTime = `${activityTimePicker.hour}:${activityTimePicker.minute} ${activityTimePicker.period}`;
    if (activityTimePicker.target === "start") {
      setActivityStartTime(nextTime);
    } else {
      setActivityEndTime(nextTime);
    }
    setActivityTimePicker(null);
  }

  async function saveActivity() {
    const title = activityTitle.trim();
    const details = activityDetails.trim();
    const place = activityPlace.trim();
    const startDate = activityStartDate || activityStartDateRef.current?.value || "";
    const startTime = activityStartTime;
    const endDate = activityEndDate || activityEndDateRef.current?.value || "";
    const endTime = activityEndTime;
    const missingFields = [
      !title ? "Title" : "",
      !place ? "Place" : "",
      !startDate ? "Starts At date" : "",
      !startTime ? "Starts At time" : "",
      !endDate ? "Ends At date" : "",
      !endTime ? "Ends At time" : "",
    ].filter(Boolean);
    if (missingFields.length > 0) {
      setActivityFormError(`Missing: ${missingFields.join(", ")}.`);
      return;
    }

    const startsAt = localDateTimeToIso(startDate, startTime);
    const endsAt = localDateTimeToIso(endDate, endTime);
    if (startsAt === null || endsAt === null) {
      setActivityFormError("Please use valid dates and times, like 07/02/2026 and 05:30 PM.");
      return;
    }
    if (new Date(endsAt) <= new Date(startsAt)) {
      setActivityFormError("Ends At must be after Starts At.");
      return;
    }

    setIsSavingActivity(true);
    setActivityFormError("");
    setActivitySuccessToast("");
    try {
      const [response] = await Promise.all([
        createLodgeActivity({
          title,
          details,
          place,
          starts_at: startsAt,
          ends_at: endsAt,
          status: activityStatus,
          is_published: isActivityPublished,
        }),
        minimumLoadingDelay(),
      ]);
      resetActivityForm();
      setActivitySuccessToast(response.message);
      window.setTimeout(() => setActivitySuccessToast(""), 3200);
      setNextActivity((current) => {
        if (response.activity.status !== "scheduled") {
          return current;
        }
        if (current === null || new Date(response.activity.starts_at) < new Date(current.starts_at)) {
          return response.activity;
        }
        return current;
      });
      setManagedActivities((current) => [response.activity, ...current].sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()));
    } catch (error) {
      setActivityFormError(error instanceof Error ? error.message : "Unable to save activity.");
    } finally {
      setIsSavingActivity(false);
    }
  }

  async function confirmDeleteActivity() {
    if (activityToDelete === null) {
      return;
    }
    setIsDeletingActivity(true);
    setActivityDeleteError("");
    try {
      const [response] = await Promise.all([
        deleteLodgeActivity(activityToDelete.id),
        minimumLoadingDelay(),
      ]);
      setManagedActivities((current) => current.filter((activity) => activity.id !== activityToDelete.id));
      setUpcomingActivities((current) => current.filter((activity) => activity.id !== activityToDelete.id));
      setNextActivity((current) => current?.id === activityToDelete.id ? null : current);
      setActivitySuccessToast(response.message);
      window.setTimeout(() => setActivitySuccessToast(""), 3200);
      setActivityToDelete(null);
    } catch (error) {
      setActivityDeleteError(error instanceof Error ? error.message : "Unable to delete activity.");
    } finally {
      setIsDeletingActivity(false);
    }
  }

  async function openMemberProfile(memberId: number) {
    trackUserAction("Members", "View Member Profile");
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

  function openAppendantSheet() {
    setClosingSheet(null);
    setIsAppendantSheetOpen(true);
  }

  function closeSheet(name: MemberSheetName) {
    setClosingSheet(name);
    window.setTimeout(() => {
      if (name === "appendant") {
        setIsAppendantSheetOpen(false);
      } else if (name === "activity") {
        setIsActivitySheetOpen(false);
        setIsEventListMode(false);
      } else if (name === "eventlist") {
        setIsEventListSheetOpen(false);
      } else if (name === "payment") {
        setIsPaymentSheetOpen(false);
      } else {
        setIsPositionsSheetOpen(false);
      }
      setClosingSheet((current) => (current === name ? null : current));
    }, 200);
  }

  async function openPositionsSheet() {
    setClosingSheet(null);
    setIsPositionsSheetOpen(true);
    setIsPositionsLoading(true);
    setPositionsError("");
    try {
      const [response] = await Promise.all([
        getMyPositionsHeld(),
        minimumLoadingDelay(),
      ]);
      setPositionsHeld(response.positions);
      setFullProfile((current) => current === null ? current : { ...current, positions_held: response.positions });
    } catch (error) {
      setPositionsError(error instanceof Error ? error.message : "Unable to load positions held.");
    } finally {
      setIsPositionsLoading(false);
    }
  }

  async function openActivityDetails(activity: LodgeActivity, eventList = false) {
    trackUserAction("Dashboard", "View Activity Details");
    setClosingSheet(null);
    setSelectedActivity(activity);
    setIsUpcomingActivitiesOpen(eventList);
    setIsEventListMode(eventList);
    setUpcomingActivities([]);
    setUpcomingActivitiesError("");
    setIsActivitySheetOpen(true);
    setIsUpcomingActivitiesLoading(true);
    try {
      const [response] = await Promise.all([
        getUpcomingLodgeActivities(eventList ? 50 : 2, activity.id),
        minimumLoadingDelay(),
      ]);
      setUpcomingActivities(response.activities);
    } catch (error) {
      setUpcomingActivitiesError(error instanceof Error ? error.message : "Unable to load upcoming activities.");
    } finally {
      setIsUpcomingActivitiesLoading(false);
    }
  }

  async function openEventList() {
    trackUserAction("Dashboard", "View Event List" as any);
    setClosingSheet(null);
    setIsEventListSheetOpen(true);
    setEventListActivities([]);
    setEventListError("");
    setIsEventListLoading(true);
    try {
      const response = await getYearActivities();
      setEventListActivities(response.activities);
    } catch (error) {
      setEventListError(error instanceof Error ? error.message : "Unable to load events.");
    } finally {
      setIsEventListLoading(false);
    }
  }

  function handleAddActivityToCalendar(activity: LodgeActivity) {
    trackUserAction("Dashboard", "Add Activity to Calendar");
    downloadLodgeActivityCalendar(activity);
    window.localStorage.setItem(calendarAddedStorageKey(activity.id), "1");
    setCalendarAddedActivityId(activity.id);
  }

  if (profile === null) {
    return (
      <main className="member-dashboard-paper flex h-[100svh] items-center justify-center px-6 text-[#111111]">
        <section className="w-full max-w-[28rem] rounded-[2rem] border border-white/80 bg-white/90 p-7 text-center shadow-[0_14px_38px_rgba(74,48,19,0.1)]">
          <Image src="/branding/dll347-logo.png" alt="Datu Lapu-Lapu Lodge No. 347 logo" width={112} height={112} priority className="mx-auto h-24 w-24 drop-shadow-[0_8px_16px_rgba(116,72,12,0.2)]" />
          <h1 className="mt-5 text-2xl font-bold tracking-[-0.04em]">Member record not yet linked</h1>
          <p className="mt-3 text-sm leading-6 text-[#655e59]">
            We could not find a lodge member record matching your login email. Please contact the Lodge Secretary to have your account properly linked.
          </p>
          <button
            type="button"
            onClick={() => {
              if (isProfileOnly) {
                onProfileClose?.();
              } else {
                void onLogout();
              }
            }}
            className="mt-6 rounded-full border border-[#edcccc] px-6 py-2.5 text-sm font-semibold text-[#c90000]"
          >
            {isProfileOnly ? "Back to dashboard" : "Sign out"}
          </button>
        </section>
      </main>
    );
  }

  if (activeView === "profile" && fullProfile === null) {
    return (
      <main className="member-dashboard-paper flex h-[100svh] items-center justify-center text-[#111111]">
        <ThemedLoader size="md" />
      </main>
    );
  }

  if (activeView === "member-edit" || activeView === "petitioner-edit") {
    const editGroups = isPetitionerEdit ? petitionerEditGroups : memberDisplayGroups;
    const selectedGroup = isPetitionerEdit
      ? petitionerGroupDetails(editPetitionerStage)
      : memberGroupDetails(resolvedEditMemberFilter, memberDisplayGroups);
    const textInputClass = "mt-1.5 h-9 w-full rounded-[0.55rem] border border-[#ded6cf] bg-white px-2.5 text-[0.68rem] text-[#111111] outline-none placeholder:text-[#9a928b]";
    const labelClass = "text-[0.66rem] font-bold text-[#2f2925]";

    return (
      <main className={`member-dashboard-paper h-[100svh] overflow-hidden text-[#111111] ${isMemberEditClosing ? "member-page-exit" : "member-page-enter"}`}>
        <div className="relative mx-auto flex h-full w-full max-w-[26rem] flex-col overflow-hidden border-x border-[#eee7dd] bg-white/20 shadow-[0_0_35px_rgba(87,55,19,0.08)]">
          {editMemberSuccessToast ? (
            <div className="pointer-events-none absolute left-1/2 top-3 z-40 w-[min(22rem,calc(100%-2rem))] -translate-x-1/2 rounded-[0.8rem] border border-[#bfe8c7] bg-white/96 px-3.5 py-3 text-[0.7rem] font-semibold text-[#16802e] shadow-[0_12px_26px_rgba(45,98,39,0.14)] backdrop-blur-md">
              {editMemberSuccessToast}
            </div>
          ) : null}
          <header className="flex h-[4.4rem] shrink-0 items-center justify-between border-b border-[#eee7dd]/70 bg-white/72 px-4 backdrop-blur-md">
            <button type="button" onClick={closeMemberEdit} className="flex h-9 w-9 items-center justify-center text-[#1f2529]" aria-label="Back to more">
              <Icon className="h-6 w-6"><path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" /></Icon>
            </button>
            <h1 className="text-[1.02rem] font-bold tracking-[-0.04em]">Edit {isPetitionerEdit ? "Petitioner" : "Member"}</h1>
            <span className="h-9 w-9" />
          </header>

          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoSelected} />

          <div className="flex-1 overflow-y-auto px-3.5 pb-[7rem] pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <section className="rounded-[1rem] border border-white/80 bg-white/92 p-3.5 shadow-[0_10px_26px_rgba(74,48,19,0.07)]">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#d40000] text-white"><PersonIcon /></span>
                <span className="min-w-0">
                  <span className="block text-[0.92rem] font-extrabold tracking-[-0.035em]">Select {isPetitionerEdit ? "Petitioner" : "Member"}</span>
                  <span className="mt-0.5 block text-[0.64rem] leading-4 text-[#6a625e]">Choose a classification, search, then edit the selected record.</span>
                </span>
              </div>
              <div className="relative mt-3">
                <div className="flex gap-2 overflow-x-scroll pb-1.5 pr-6 scrollbar-thin [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]">
                  {editGroups.map((filter) => {
                    const isActive = isPetitionerEdit ? editPetitionerStage === filter.key : resolvedEditMemberFilter === filter.key;
                    return (
                      <button
                        key={filter.key}
                        type="button"
                        onClick={() => isPetitionerEdit ? setEditPetitionerStage(filter.key as PetitionerStage) : setEditMemberFilter(filter.key)}
                        className="shrink-0 rounded-full border px-3 py-1.5 text-[0.62rem] font-bold"
                        style={{ color: filter.color, borderColor: isActive ? filter.border : `${filter.border}99`, backgroundColor: isActive ? filter.tint : "rgba(255,255,255,0.7)" }}
                      >
                        {filter.label}
                      </button>
                    );
                  })}
                </div>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex w-8 items-center justify-end bg-gradient-to-l from-white/90 via-white/70 to-transparent pr-0.5">
                  <svg viewBox="0 0 16 24" className="h-5 w-4 text-[#9b928b]" aria-hidden="true">
                    <path d="m4 5 7 7-7 7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                  </svg>
                </div>
              </div>
              <label className="mt-2 flex h-10 items-center gap-2 rounded-[0.7rem] border border-[#f0e5d7] bg-white px-3 text-[#716a66]">
                <SearchIcon />
                <input type="search" value={editMemberSearch} onChange={(event) => setEditMemberSearch(event.target.value)} placeholder={`Search ${isPetitionerEdit ? "petitioner" : "member"} names`} className="min-w-0 flex-1 bg-transparent text-[0.72rem] text-[#111111] outline-none placeholder:text-[#9a928b]" />
              </label>
              <div className="mt-3 flex items-center justify-between px-1">
                <span className="text-[0.66rem] font-semibold" style={{ color: selectedGroup.color }}>{editMemberSearch.trim() ? "Search Results" : selectedGroup.heading}</span>
                <span className="text-[0.8rem] font-bold">{isEditMemberListLoading ? <ThemedLoader size="sm" /> : editMemberListCount}</span>
              </div>
              <div className="mt-2 max-h-56 space-y-2 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {editMemberListError ? (
                  <p className="rounded-xl bg-[#fff0f0] px-3 py-2 text-[0.68rem] text-[#c90000]">{editMemberListError}</p>
                ) : isEditMemberListLoading ? (
                  <div className="flex justify-center rounded-[0.85rem] bg-white/88 px-4 py-5"><ThemedLoader size="sm" /></div>
                ) : editMemberList.length > 0 ? (
                  editMemberList.map((member) => {
                    const isSelected = selectedEditMember?.id === member.id;
                    const groupDetails = isPetitionerEdit
                      ? petitionerGroupDetails(petitionerStageForRecord(member.name, member.section))
                      : memberGroupDetailsForMember(member, memberDisplayGroups);
                    return (
                      <button key={member.id} type="button" onClick={() => void selectEditableMember(member.id)} className={`flex w-full items-center gap-2.5 rounded-[0.78rem] px-2.5 py-2 text-left shadow-[0_8px_18px_rgba(75,48,20,0.04)] ${isSelected ? "bg-[#fff4e3] ring-1 ring-[#d68a00]" : "bg-white/90"}`}>
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full ${isPetitionerEdit ? "bg-[linear-gradient(145deg,#5b7dba,#2f6fbd)]" : "bg-[linear-gradient(145deg,#20aa38,#008a1f)]"} text-[0.68rem] font-bold text-white`}>
                          {member.profile_photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={member.profile_photo_url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                          ) : memberInitials(member.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.7rem] font-bold text-[#111111]">{memberListDisplayName(member.name)}</span>
                          {!isPetitionerEdit && "glp_id_number" in member ? (
                            <span className="mt-0.5 block truncate text-[0.58rem] text-[#625b56]">GLP ID: {displayValue(member.glp_id_number)}</span>
                          ) : null}
                        </span>
                        <span className="shrink-0 rounded-full px-2 py-0.5 text-[0.52rem] font-semibold" style={{ color: groupDetails.color, backgroundColor: groupDetails.tint }}>{groupDetails.label}</span>
                      </button>
                    );
                  })
                ) : (
                  <p className="rounded-xl bg-white/88 px-3 py-5 text-center text-[0.7rem] text-[#665d57]">No {isPetitionerEdit ? "petitioners" : "members"} found.</p>
                )}
              </div>
            </section>

            {isEditMemberLoading ? <div className="mt-3 flex justify-center rounded-[1rem] bg-white/88 px-4 py-7"><ThemedLoader size="md" /></div> : null}

            {editMemberForm ? (
              <section ref={editMemberDetailsRef} className="mt-3 scroll-mt-3 space-y-3">
                <div className="rounded-[1rem] border border-white/80 bg-white/92 p-3 shadow-[0_10px_26px_rgba(74,48,19,0.07)]">
                  <h2 className="text-[0.72rem] font-bold">Category</h2>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {editGroups.map((group) => {
                      const isActive = isPetitionerEdit
                        ? petitionerStageForRecord(editMemberForm.name, editMemberForm.section) === group.key
                        : editMemberForm.section.trim().toUpperCase() === group.section.trim().toUpperCase();
                      return (
                        <button
                          key={group.key}
                          type="button"
                          onClick={() => updateEditMemberField("section", group.section)}
                          className="flex items-center gap-1 rounded-full px-2.5 py-1 text-center transition-colors"
                          style={{
                            color: isActive ? "#fff" : group.color,
                            backgroundColor: isActive ? group.color : group.tint,
                            borderColor: group.color,
                            borderWidth: "1px",
                            borderStyle: "solid",
                          }}
                        >
                          <span className="flex h-4 w-4 items-center justify-center rounded-full text-[0.52rem]" style={{ backgroundColor: isActive ? "rgba(255,255,255,0.25)" : group.color, color: "#fff" }}>
                            {isActive ? <Icon className="h-2.5 w-2.5"><path d="m5 13 4 4 9-9" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" /></Icon> : group.label.charAt(0)}
                          </span>
                          <span className="text-[0.55rem] font-bold leading-tight">{group.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-[1rem] border border-white/80 bg-white/92 p-3.5 shadow-[0_10px_26px_rgba(74,48,19,0.07)]">
                  <h2 className="text-[0.78rem] font-bold">{isPetitionerEdit ? "Petitioner" : "Member"} Login</h2>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className={`flex h-9 w-9 items-center justify-center rounded-full ${memberAccountStatus?.status === "activated" ? "bg-[#eef8f0] text-[#168129]" : memberAccountStatus?.status === "pending" ? "bg-[#fff8e6] text-[#cd8600]" : memberAccountStatus?.status === "deactivated" ? "bg-[#fff0f0] text-[#c90000]" : "bg-[#f5f0eb] text-[#938b83]"}`}>
                        {memberAccountStatus?.status === "activated" ? (
                          <Icon className="h-5 w-5"><path d="m5 13 4 4 9-9" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" /></Icon>
                        ) : memberAccountStatus?.status === "pending" ? (
                          <Icon className="h-5 w-5"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M12 7v5l3 2" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></Icon>
                        ) : memberAccountStatus?.status === "deactivated" ? (
                          <Icon className="h-5 w-5"><path d="M18 6 6 18M6 6l12 12" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" /></Icon>
                        ) : (
                          <Icon className="h-5 w-5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="9" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="2" /></Icon>
                        )}
                      </span>
                      <div>
                        <div className="text-[0.68rem] font-bold text-[#3a342f]">
                          {memberAccountStatus?.status === "activated" ? "Login Activated" :
                           memberAccountStatus?.status === "pending" ? "Pending Setup" :
                           memberAccountStatus?.status === "deactivated" ? "Login Deactivated" :
                           memberAccountStatus?.status === "no_email" ? "No Email on File" :
                           "No Login Setup"}
                        </div>
                        <div className="mt-0.5 text-[0.55rem] text-[#90887e]">
                          {memberAccountStatus?.status === "activated" ? `${isPetitionerEdit ? "Petitioner" : "Member"} can access the app.` :
                           memberAccountStatus?.status === "pending" ? "Waiting for account setup." :
                           memberAccountStatus?.status === "deactivated" ? `${isPetitionerEdit ? "Petitioner" : "Member"} cannot log in.` :
                           memberAccountStatus?.status === "no_email" ? "Add an email address first." :
                           `${isPetitionerEdit ? "Petitioner" : "Member"} has not been given login access.`}
                        </div>
                      </div>
                    </div>
                    {memberAccountStatus !== null && memberAccountStatus.status !== "no_email" ? (
                      memberAccountStatus.status === "activated" || memberAccountStatus.status === "pending" ? (
                        <button type="button" onClick={() => void handleDeactivateLogin()} disabled={isAccountActionLoading} className="rounded-full border border-[#e8c0c0] px-3 py-1.5 text-[0.58rem] font-bold text-[#c90000] disabled:opacity-50">
                          {isAccountActionLoading ? <ThemedLoader size="sm" /> : "Deactivate"}
                        </button>
                      ) : (
                        <button type="button" onClick={() => void handleActivateLogin()} disabled={isAccountActionLoading} className="rounded-full border border-[#b8e3c2] bg-[#eef8f0] px-3 py-1.5 text-[0.58rem] font-bold text-[#138122] disabled:opacity-50">
                          {isAccountActionLoading ? <ThemedLoader size="sm" /> : "Activate"}
                        </button>
                      )
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[1rem] border border-white/80 bg-white/92 p-3.5 shadow-[0_10px_26px_rgba(74,48,19,0.07)]">
                  <h2 className="text-[0.78rem] font-bold">{isPetitionerEdit ? "Petitioner" : "Member"} Identity</h2>
                  <div className="mt-3 grid grid-cols-2 gap-2.5">
                    <label className={labelClass}>Name<input value={editMemberForm.name} onChange={(event) => updateEditMemberField("name", event.target.value)} className={textInputClass} /></label>
                    {!isPetitionerEdit ? <label className={labelClass}>GLP ID<input value={editMemberForm.glp_id_number} onChange={(event) => updateEditMemberField("glp_id_number", event.target.value)} className={textInputClass} /></label> : null}
                    <label className={labelClass}>{isPetitionerEdit ? "Petitioner" : "Member"} No.<input value={editMemberForm.member_number} onChange={(event) => updateEditMemberField("member_number", event.target.value)} className={textInputClass} /></label>
                    <label className={labelClass}>Section<select value={editMemberForm.section} onChange={(event) => updateEditMemberField("section", event.target.value)} className={textInputClass}>
                      {editGroups.filter((g) => isPetitionerEdit || !g.key.startsWith("trestle_board")).map((group) => (
                        <option key={group.key} value={group.section}>{group.label}</option>
                      ))}
                      {!editGroups.some((g) => g.section.trim().toUpperCase() === editMemberForm.section.trim().toUpperCase()) ? (
                        <option value={editMemberForm.section}>Current: {editMemberForm.section || "-"}</option>
                      ) : null}
                    </select></label>
                  </div>
                </div>

                {selectedEditMember ? (
                  <div className="rounded-[1rem] border border-white/80 bg-white/92 p-3.5 shadow-[0_10px_26px_rgba(74,48,19,0.07)]">
                    <h2 className="text-[0.78rem] font-bold">Profile Photo</h2>
                    <div className="mt-3 flex items-center gap-3">
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f7efe5] text-[#d58d00] shadow-[inset_0_0_0_1px_rgba(220,171,91,0.18)]">
                        {selectedEditMember.profile_photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={selectedEditMember.profile_photo_url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                        ) : (
                          <CameraIcon />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[0.68rem] text-[#655e59]">Upload a new profile photo for this {isPetitionerEdit ? "petitioner" : "member"}.</span>
                        <button
                          type="button"
                          onClick={openPhotoSelector}
                          disabled={isUploadingPhoto}
                          className="mt-2 rounded-full border border-[#d40000] px-3 py-1 text-[0.62rem] font-bold text-[#d40000] disabled:opacity-50"
                        >
                          {isUploadingPhoto ? "Uploading..." : "Choose Photo"}
                        </button>
                      </span>
                    </div>
                    {photoError ? <p className="mt-3 rounded-xl bg-[#fff0f0] px-3 py-2 text-[0.68rem] text-[#c90000]">{photoError}</p> : null}
                  </div>
                ) : null}

                <div className="rounded-[1rem] border border-white/80 bg-white/92 p-3.5 shadow-[0_10px_26px_rgba(74,48,19,0.07)]">
                  <h2 className="text-[0.78rem] font-bold">Contact</h2>
                  <div className="mt-3 space-y-2.5">
                    <label className={labelClass}>Email<input value={editMemberForm.email} onChange={(event) => updateEditMemberField("email", event.target.value)} className={textInputClass} /></label>
                    <label className={labelClass}>Phone<input value={editMemberForm.telephone} onChange={(event) => updateEditMemberField("telephone", event.target.value)} className={textInputClass} /></label>
                    {editMemberForm.address !== undefined ? <label className={labelClass}>Address<textarea value={editMemberForm.address} onChange={(event) => updateEditMemberField("address", event.target.value)} className="mt-1.5 h-20 w-full resize-none rounded-[0.55rem] border border-[#ded6cf] bg-white px-2.5 py-2 text-[0.68rem] leading-5 text-[#111111] outline-none" /></label> : null}
                  </div>
                </div>

                <div className="rounded-[1rem] border border-white/80 bg-white/92 p-3.5 shadow-[0_10px_26px_rgba(74,48,19,0.07)]">
                  <h2 className="text-[0.78rem] font-bold">Personal</h2>
                  <div className="mt-3 grid grid-cols-2 gap-2.5">
                    {editMemberForm.date_of_birth !== undefined ? <label className={labelClass}>Birthdate<input type="date" value={dateInputValue(editMemberForm.date_of_birth)} onChange={(event) => updateEditMemberField("date_of_birth", nullableDate(event.target.value))} className={textInputClass} /></label> : null}
                    <label className={labelClass}>Blood Type<input value={editMemberForm.blood_type} onChange={(event) => updateEditMemberField("blood_type", event.target.value)} className={textInputClass} /></label>
                    <label className={labelClass}>Widow / Sister<input value={editMemberForm.widow_or_sister} onChange={(event) => updateEditMemberField("widow_or_sister", event.target.value)} className={textInputClass} /></label>
                    <label className={labelClass}>W/S Birthdate<input type="date" value={dateInputValue(editMemberForm.widow_or_sister_date_of_birth)} onChange={(event) => updateEditMemberField("widow_or_sister_date_of_birth", nullableDate(event.target.value))} className={textInputClass} /></label>
                  </div>
                </div>

                <div className="rounded-[1rem] border border-white/80 bg-white/92 p-3.5 shadow-[0_10px_26px_rgba(74,48,19,0.07)]">
                  <h2 className="text-[0.78rem] font-bold">Membership History</h2>
                  <div className="mt-3 grid grid-cols-2 gap-2.5">
                    <label className={labelClass}>Initiated<input type="date" value={dateInputValue(editMemberForm.initiation_date)} onChange={(event) => updateEditMemberField("initiation_date", nullableDate(event.target.value))} className={textInputClass} /></label>
                    <label className={labelClass}>Passed<input type="date" value={dateInputValue(editMemberForm.passing_date)} onChange={(event) => updateEditMemberField("passing_date", nullableDate(event.target.value))} className={textInputClass} /></label>
                    <label className={labelClass}>Date Presented<input type="date" value={dateInputValue(editMemberForm.date_presented)} onChange={(event) => updateEditMemberField("date_presented", nullableDate(event.target.value))} className={textInputClass} /></label>
                    <label className={labelClass}>Date Balloted<input type="date" value={dateInputValue(editMemberForm.date_balloted)} onChange={(event) => updateEditMemberField("date_balloted", nullableDate(event.target.value))} className={textInputClass} /></label>
                    <label className={labelClass}>Raised<input type="date" value={dateInputValue(editMemberForm.raising_date)} onChange={(event) => updateEditMemberField("raising_date", nullableDate(event.target.value))} className={textInputClass} /></label>
                    <label className={labelClass}>Proficiency<input type="date" value={dateInputValue(editMemberForm.proficiency_date)} onChange={(event) => updateEditMemberField("proficiency_date", nullableDate(event.target.value))} className={textInputClass} /></label>
                    <label className={labelClass}>Suspension<input type="date" value={dateInputValue(editMemberForm.suspension)} onChange={(event) => updateEditMemberField("suspension", event.target.value)} className={textInputClass} /></label>
                    <label className={labelClass}>Restored<input type="date" value={dateInputValue(editMemberForm.restored)} onChange={(event) => updateEditMemberField("restored", event.target.value)} className={textInputClass} /></label>
                    <label className={labelClass}>Demit<input type="date" value={dateInputValue(editMemberForm.demit)} onChange={(event) => updateEditMemberField("demit", event.target.value)} className={textInputClass} /></label>
                    <label className={labelClass}>LML<input type="date" value={dateInputValue(editMemberForm.lml)} onChange={(event) => updateEditMemberField("lml", event.target.value)} className={textInputClass} /></label>
                  </div>
                  <label className={`${labelClass} mt-2.5 block`}>Dual / Plural / Honorary Date<input type="date" value={dateInputValue(editMemberForm.dual_plural_honorary_date)} onChange={(event) => updateEditMemberField("dual_plural_honorary_date", event.target.value)} className={textInputClass} /></label>
                </div>

                <div className="rounded-[1rem] border border-white/80 bg-white/92 p-3.5 shadow-[0_10px_26px_rgba(74,48,19,0.07)]">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[0.78rem] font-bold">Positions Held</h2>
                    <button type="button" onClick={addEditMemberPosition} className="rounded-full bg-[#fff4e3] px-3 py-1.5 text-[0.62rem] font-bold text-[#a76a00]">Add</button>
                  </div>
                  <div className="mt-3 space-y-2.5">
                    {editMemberForm.positions_held.map((position, index) => (
                      <div key={index} className="rounded-[0.8rem] border border-[#efe4d8] bg-[#fffdfb] p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <input value={position.title} onChange={(event) => updateEditMemberPosition(index, "title", event.target.value)} placeholder="Title" className="min-w-0 flex-1 bg-transparent text-[0.68rem] font-bold outline-none placeholder:text-[#9a928b]" />
                          <button type="button" onClick={() => removeEditMemberPosition(index)} className="text-[0.62rem] font-bold text-[#c10000]">Remove</button>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <input value={position.date_range} onChange={(event) => updateEditMemberPosition(index, "date_range", event.target.value)} placeholder="Date range" className={textInputClass} />
                          <input value={position.source} onChange={(event) => updateEditMemberPosition(index, "source", event.target.value)} placeholder="Source" className={textInputClass} />
                        </div>
                        <textarea value={position.notes} onChange={(event) => updateEditMemberPosition(index, "notes", event.target.value)} placeholder="Notes" className="mt-2 h-14 w-full resize-none rounded-[0.55rem] border border-[#ded6cf] bg-white px-2.5 py-2 text-[0.64rem] leading-4 outline-none" />
                      </div>
                    ))}
                    {editMemberForm.positions_held.length === 0 ? <p className="rounded-xl bg-[#fbf7f0] px-3 py-4 text-center text-[0.68rem] text-[#665d57]">No positions recorded.</p> : null}
                  </div>
                </div>

                <div className="rounded-[1rem] border border-white/80 bg-white/92 p-3.5 shadow-[0_10px_26px_rgba(74,48,19,0.07)]">
                  <h2 className="text-[0.78rem] font-bold">Workbook Data</h2>
                  <div className="mt-3 space-y-2.5">
                    <WorkbookRowsEditor
                      title="Appendant Bodies & Club"
                      rows={editMemberForm.appendantBodiesRows}
                      emptyText="No appendant body columns were imported for this member."
                      mode="mark"
                      onChange={(rows) => updateEditMemberField("appendantBodiesRows", rows)}
                    />
                    <WorkbookRowsEditor
                      title="Meeting Attendance"
                      rows={editMemberForm.meetingAttendanceRows}
                      emptyText="No meeting attendance columns were imported for this member."
                      mode="mark"
                      addLabel="Add"
                      onAdd={() => openWorkbookAddSheet("meeting")}
                      onChange={(rows) => updateEditMemberField("meetingAttendanceRows", rows)}
                    />
                    <WorkbookRowsEditor
                      title="Monthly Attendance"
                      rows={editMemberForm.monthlyAttendanceRows}
                      emptyText="No monthly attendance columns were imported for this member."
                      mode="mark"
                      addLabel="Add"
                      onAdd={() => openWorkbookAddSheet("monthly")}
                      onChange={(rows) => updateEditMemberField("monthlyAttendanceRows", rows)}
                    />
                    <WorkbookRowsEditor
                      title="Annual Dues"
                      rows={editMemberForm.annualDuesRows}
                      emptyText="No annual dues columns were imported for this member."
                      mode="date"
                      addLabel="Add"
                      onAdd={() => openWorkbookAddSheet("dues")}
                      onChange={(rows) => updateEditMemberField("annualDuesRows", rows)}
                    />
                  </div>
                </div>
              </section>
            ) : !isEditMemberLoading ? (
              <section className="mt-3 rounded-[1rem] border border-white/80 bg-white/92 px-4 py-6 text-center shadow-[0_10px_26px_rgba(74,48,19,0.07)]">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#fff4e3] text-[#d68a00]">
                  <PersonIcon />
                </div>
                <h2 className="mt-3 text-[0.82rem] font-bold">No {isPetitionerEdit ? "petitioner" : "member"} selected</h2>
                <p className="mt-1 text-[0.66rem] leading-5 text-[#6a625e]">Select a {isPetitionerEdit ? "petitioner" : "member"} above to open the edit form.</p>
              </section>
            ) : null}

            {editMemberFormError ? <p className="mt-3 rounded-xl bg-[#fff0f0] px-3 py-2 text-[0.68rem] text-[#c90000]">{editMemberFormError}</p> : null}
          </div>

          {workbookAddSheet ? (
            <div className="absolute inset-0 z-40 flex items-end bg-[#171717]/42 backdrop-blur-[1px]">
              <section className="w-full rounded-t-[1.2rem] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_45px_rgba(0,0,0,0.22)] member-sheet-panel-enter">
                <div className="mx-auto h-1 w-9 rounded-full bg-[#9b9b9b]" />
                <div className="mt-4 flex items-center justify-between">
                  <button type="button" onClick={closeWorkbookAddSheet} className="h-9 px-1 text-[0.72rem] font-bold text-[#c10000]">Cancel</button>
                  <h2 className="text-[0.92rem] font-bold tracking-[-0.03em]">
                    {workbookAddSheet === "dues" ? "Add Annual Dues" : workbookAddSheet === "monthly" ? "Add Monthly Attendance" : "Add Meeting Attendance"}
                  </h2>
                  <button type="button" onClick={saveWorkbookAddSheet} className="h-9 px-1 text-[0.72rem] font-bold text-[#d68a00]">Save</button>
                </div>

                <div className="mt-4 rounded-[1rem] border border-[#f0e5d7] bg-[#fffdfb] p-3.5 shadow-[0_8px_20px_rgba(75,48,20,0.04)]">
                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="text-[0.66rem] font-bold text-[#2f2925]">
                      Year
                      <input value={workbookAddYear} onChange={(event) => setWorkbookAddYear(event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" className="mt-1.5 h-10 w-full rounded-[0.55rem] border border-[#ded6cf] bg-white px-2.5 text-[0.72rem] text-[#111111] outline-none" />
                    </label>

                    {workbookAddSheet === "dues" ? (
                      <label className="text-[0.66rem] font-bold text-[#2f2925]">
                        Date
                        <input type="date" value={workbookAddValue} onChange={(event) => setWorkbookAddValue(event.target.value)} className="mt-1.5 h-10 w-full rounded-[0.55rem] border border-[#ded6cf] bg-white px-2.5 text-[0.72rem] text-[#111111] outline-none [color-scheme:light]" />
                      </label>
                    ) : (
                      <label className="text-[0.66rem] font-bold text-[#2f2925]">
                        Meeting
                        <input value={workbookAddMeeting} onChange={(event) => setWorkbookAddMeeting(event.target.value)} placeholder="WB" className="mt-1.5 h-10 w-full rounded-[0.55rem] border border-[#ded6cf] bg-white px-2.5 text-[0.72rem] text-[#111111] outline-none" />
                      </label>
                    )}
                  </div>

                  {workbookAddSheet !== "dues" ? (
                    <div className="mt-3 grid grid-cols-2 gap-2.5">
                      <label className="text-[0.66rem] font-bold text-[#2f2925]">
                        {workbookAddSheet === "monthly" ? "Month" : "Code"}
                        {workbookAddSheet === "monthly" ? (
                          <select value={workbookAddPeriod} onChange={(event) => setWorkbookAddPeriod(event.target.value)} className="mt-1.5 h-10 w-full rounded-[0.55rem] border border-[#ded6cf] bg-white px-2.5 text-[0.72rem] text-[#111111] outline-none">
                            {monthOptions.map((month) => <option key={month} value={month}>{month}</option>)}
                          </select>
                        ) : (
                          <input value={workbookAddPeriod} onChange={(event) => setWorkbookAddPeriod(event.target.value)} placeholder="UD" className="mt-1.5 h-10 w-full rounded-[0.55rem] border border-[#ded6cf] bg-white px-2.5 text-[0.72rem] text-[#111111] outline-none" />
                        )}
                      </label>
                      <label className="text-[0.66rem] font-bold text-[#2f2925]">
                        Mark
                        <button type="button" onClick={() => setWorkbookAddValue((value) => value.trim() ? "" : "a")} className={`mt-1.5 h-10 w-full rounded-[0.55rem] border px-2 text-[0.68rem] font-extrabold ${workbookAddValue.trim() ? "border-[#bfe8c7] bg-[#f2fbf4] text-[#009622]" : "border-[#ded6cf] bg-white text-[#817871]"}`} aria-pressed={Boolean(workbookAddValue.trim())}>
                          {workbookAddValue.trim() ? "Marked" : "Blank"}
                        </button>
                      </label>
                    </div>
                  ) : null}

                  {workbookAddError ? <p className="mt-3 rounded-xl bg-[#fff0f0] px-3 py-2 text-[0.66rem] text-[#c90000]">{workbookAddError}</p> : null}
                </div>
              </section>
            </div>
          ) : null}

          <div className="absolute inset-x-0 bottom-0 z-20 border-t border-[#eee8e1] bg-white/95 px-3.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-7px_24px_rgba(75,48,20,0.07)] backdrop-blur-xl">
            <div className="grid grid-cols-[0.9fr_1.8fr] gap-2.5">
              <button type="button" onClick={closeMemberEdit} className="h-11 rounded-[0.62rem] border border-[#eadfda] bg-white text-[0.72rem] font-bold text-[#c10000]">Cancel</button>
              <button type="button" onClick={() => void saveMemberEdit()} disabled={isSavingMemberEdit || editMemberForm === null} className="flex h-11 items-center justify-center gap-2 rounded-[0.62rem] bg-[linear-gradient(145deg,#f1a51c,#d88400)] text-[0.72rem] font-extrabold text-white shadow-[0_10px_20px_rgba(205,133,0,0.2)] disabled:cursor-not-allowed disabled:opacity-60">
                {isSavingMemberEdit ? <ThemedLoader size="sm" className="brightness-125" /> : <PersonIcon />}
                <span>{isSavingMemberEdit ? "Saving..." : `Save ${isPetitionerEdit ? "Petitioner" : "Member"}`}</span>
              </button>
            </div>
          </div>
          {isPhotoModalOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1b130c]/45 px-4 backdrop-blur-sm">
              <section className="w-full max-w-[22rem] rounded-[1.6rem] border border-white/80 bg-[#fffdfb] p-4 text-center shadow-[0_22px_60px_rgba(42,24,8,0.22)]">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#d40000] text-white shadow-[0_8px_18px_rgba(208,0,0,0.2)]"><CameraIcon /></div>
                <h2 className="mt-3 text-lg font-bold tracking-[-0.04em]">Crop profile photo</h2>
                <p className="mt-1 text-[0.68rem] leading-5 text-[#655e59]">Move and zoom the photo until it looks right inside the circle.</p>
                <div className="mx-auto mt-4 h-52 w-52 overflow-hidden rounded-full border-[6px] border-[#f5ecdf] bg-[#f8f1e8] shadow-[inset_0_0_0_1px_rgba(215,188,151,0.35)]">
                  {selectedPhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selectedPhotoUrl} alt="" className="block select-none" style={getCropPreviewStyle(cropImageMeta, crop)} />
                  ) : null}
                </div>
                <div className="mt-4 space-y-3 text-left">
                  <label className="block text-[0.65rem] font-semibold text-[#4b413b]">Zoom
                    <input type="range" min="1" max="3" step="0.05" value={crop.zoom} onChange={(event) => setCrop((current) => ({ ...current, zoom: Number(event.target.value) }))} className="mt-2 w-full accent-[#d40000]" />
                  </label>
                  <label className="block text-[0.65rem] font-semibold text-[#4b413b]">Move left / right
                    <input type="range" min="-100" max="100" step="1" value={crop.x} onChange={(event) => setCrop((current) => ({ ...current, x: Number(event.target.value) }))} className="mt-2 w-full accent-[#d40000]" />
                  </label>
                  <label className="block text-[0.65rem] font-semibold text-[#4b413b]">Move up / down
                    <input type="range" min="-100" max="100" step="1" value={crop.y} onChange={(event) => setCrop((current) => ({ ...current, y: Number(event.target.value) }))} className="mt-2 w-full accent-[#d40000]" />
                  </label>
                </div>
                {photoError ? <p className="mt-3 rounded-xl bg-[#fff0f0] px-3 py-2 text-[0.68rem] text-[#c90000]">{photoError}</p> : null}
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button type="button" disabled={isUploadingPhoto} onClick={() => setIsPhotoModalOpen(false)} className="rounded-full border border-[#ead8c7] px-4 py-2 text-xs font-semibold text-[#6f625a] disabled:opacity-60">Cancel</button>
                  <button type="button" disabled={isUploadingPhoto || !selectedEditMember} onClick={() => { if (selectedEditMember) { void saveProfilePhoto(selectedEditMember.id); } }} className="flex items-center justify-center rounded-full bg-[#d40000] px-4 py-2 text-xs font-semibold text-white shadow-[0_8px_18px_rgba(208,0,0,0.18)] disabled:opacity-70">{isUploadingPhoto ? <ThemedLoader size="sm" /> : "Save photo"}</button>
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </main>
    );
  }

  if (activeView === "activity") {
    return (
      <main className={`member-dashboard-paper h-[100svh] overflow-hidden text-[#111111] ${isActivityFormClosing ? "member-page-exit" : "member-page-enter"}`}>
        <div className="relative mx-auto flex h-full w-full max-w-[26rem] flex-col overflow-hidden border-x border-[#eee7dd] bg-white/20 shadow-[0_0_35px_rgba(87,55,19,0.08)]">
          {activitySuccessToast ? (
            <div className="pointer-events-none absolute left-1/2 top-3 z-40 w-[min(22rem,calc(100%-2rem))] -translate-x-1/2 rounded-[0.8rem] border border-[#bfe8c7] bg-white/96 px-3.5 py-3 text-[0.7rem] font-semibold text-[#16802e] shadow-[0_12px_26px_rgba(45,98,39,0.14)] backdrop-blur-md">
              {activitySuccessToast}
            </div>
          ) : null}
          <header className="flex h-[4.4rem] shrink-0 items-center justify-between border-b border-[#eee7dd]/70 bg-white/72 px-4 backdrop-blur-md">
            <button type="button" onClick={closeActivityForm} className="flex h-9 w-9 items-center justify-center text-[#1f2529]" aria-label="Back">
              <Icon className="h-6 w-6"><path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" /></Icon>
            </button>
            <h1 className="text-[1.02rem] font-bold tracking-[-0.04em]">Activity</h1>
            <span className="h-9 w-9" />
          </header>

          <div className="flex-1 overflow-y-auto px-3.5 pb-[6.1rem] pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="mb-3 grid grid-cols-2 rounded-[0.82rem] border border-[#eadfd3] bg-white/76 p-1 shadow-[0_8px_18px_rgba(75,48,20,0.04)]">
              {[
                ["create", "Create"],
                ["list", "List"],
              ].map(([tab, label]) => {
                const isActive = activityScreenTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActivityScreenTab(tab as ActivityScreenTab)}
                    className={`h-9 rounded-[0.62rem] text-[0.68rem] font-extrabold ${isActive ? "bg-[#d40000] text-white shadow-[0_6px_14px_rgba(208,0,0,0.14)]" : "text-[#6a625e]"}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {activityScreenTab === "create" ? (
            <>
            <section className="relative overflow-hidden rounded-[1rem] border border-white/80 bg-white/90 p-3.5 shadow-[0_10px_26px_rgba(74,48,19,0.07)]">
              <LodgeWatermark />
              <div className="relative z-10 flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#fff7ec] text-[#d68a00] shadow-[inset_0_0_0_1px_rgba(220,171,91,0.12)]">
                  <CalendarIcon />
                </span>
                <span className="min-w-0">
                  <span className="block text-[0.94rem] font-extrabold tracking-[-0.035em]">New Lodge Activity</span>
                  <span className="mt-1 block text-[0.68rem] leading-5 text-[#6a625e]">Fill in the details below to schedule a new activity.</span>
                </span>
              </div>
            </section>

            <section className="mt-4 rounded-[1rem] border border-white/80 bg-white/92 p-3.5 shadow-[0_10px_26px_rgba(74,48,19,0.07)]">
              <label className="text-[0.72rem] font-bold">Title <span className="text-[#d00000]">*</span></label>
              <div className="mt-2 flex h-10 items-center gap-3 rounded-[0.55rem] border border-[#ded6cf] bg-white px-3 text-[#8b7d70]">
                <TextIcon />
                <input value={activityTitle} onChange={(event) => setActivityTitle(event.target.value.slice(0, 100))} placeholder="Enter activity title" className="min-w-0 flex-1 bg-transparent text-[0.7rem] text-[#111111] outline-none placeholder:text-[#9a928b]" />
              </div>
              <p className="mt-1 text-right text-[0.62rem] text-[#6f6763]">{activityTitle.length} / 100</p>

              <label className="mt-4 block text-[0.72rem] font-bold">Details <span className="font-normal text-[#6f6763]">(Optional)</span></label>
              <div className="mt-2 overflow-hidden rounded-[0.55rem] border border-[#ded6cf] bg-white">
                <div className="flex h-9 items-center gap-1 border-b border-[#e6ddd3] bg-[#fbf8f3] px-2">
                  <ToolbarIcon label="B" />
                  <ToolbarIcon label="I" />
                  <ToolbarIcon label="U" />
                  <ToolbarIcon label="≡" />
                  <ToolbarIcon label="☷" />
                  <ToolbarIcon label="↗" />
                </div>
                <textarea value={activityDetails} onChange={(event) => setActivityDetails(event.target.value.slice(0, 2000))} placeholder="Provide details about the activity..." className="h-36 w-full resize-none bg-white px-3 py-3 text-[0.7rem] leading-5 text-[#111111] outline-none placeholder:text-[#9a928b]" />
              </div>
              <p className="mt-1 text-right text-[0.62rem] text-[#6f6763]">{activityDetails.length} / 2000</p>

              <label className="mt-4 block text-[0.72rem] font-bold">Place <span className="text-[#d00000]">*</span></label>
              <div className="mt-2 flex h-10 items-center gap-3 rounded-[0.55rem] border border-[#ded6cf] bg-white px-3 text-[#8b7d70]">
                <PinIcon />
                <input value={activityPlace} onChange={(event) => setActivityPlace(event.target.value)} placeholder="Enter venue or location" className="min-w-0 flex-1 bg-transparent text-[0.7rem] text-[#111111] outline-none placeholder:text-[#9a928b]" />
                <TargetIcon />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[0.72rem] font-bold">Starts At <span className="text-[#d00000]">*</span></label>
                  <label className="relative mt-2 flex h-10 items-center gap-2 rounded-[0.55rem] border border-[#ded6cf] bg-white px-2.5 text-[#8b7d70]" onClick={() => openNativePicker(activityStartDatePickerRef.current)}>
                    <CalendarIcon />
                    <span className={`min-w-0 flex-1 text-[0.64rem] ${activityStartDate ? "text-[#111111]" : "text-[#9a928b]"}`}>{activityStartDate || "MM/DD/YYYY"}</span>
                    <input ref={activityStartDatePickerRef} type="date" value={parseActivityDateInput(activityStartDate) ? `${parseActivityDateInput(activityStartDate)!.year}-${String(parseActivityDateInput(activityStartDate)!.monthIndex + 1).padStart(2, "0")}-${String(parseActivityDateInput(activityStartDate)!.day).padStart(2, "0")}` : ""} onChange={(event) => setActivityStartDate(datePickerValueToDisplay(event.target.value))} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label="Select start date" />
                  </label>
                  <button type="button" className="relative mt-2 flex h-10 w-full items-center gap-2 rounded-[0.55rem] border border-[#ded6cf] bg-white px-2.5 text-left text-[#8b7d70]" onClick={() => openActivityTimePicker("start")}>
                    <ClockIcon />
                    <span className={`min-w-0 flex-1 text-[0.64rem] ${activityStartTime ? "text-[#111111]" : "text-[#9a928b]"}`}>{activityStartTime || "HH:MM AM"}</span>
                  </button>
                </div>
                <div>
                  <label className="text-[0.72rem] font-bold">Ends At <span className="text-[#d00000]">*</span></label>
                  <label className="relative mt-2 flex h-10 items-center gap-2 rounded-[0.55rem] border border-[#ded6cf] bg-white px-2.5 text-[#8b7d70]" onClick={() => openNativePicker(activityEndDatePickerRef.current)}>
                    <CalendarIcon />
                    <span className={`min-w-0 flex-1 text-[0.64rem] ${activityEndDate ? "text-[#111111]" : "text-[#9a928b]"}`}>{activityEndDate || "MM/DD/YYYY"}</span>
                    <input ref={activityEndDatePickerRef} type="date" value={parseActivityDateInput(activityEndDate) ? `${parseActivityDateInput(activityEndDate)!.year}-${String(parseActivityDateInput(activityEndDate)!.monthIndex + 1).padStart(2, "0")}-${String(parseActivityDateInput(activityEndDate)!.day).padStart(2, "0")}` : ""} onChange={(event) => setActivityEndDate(datePickerValueToDisplay(event.target.value))} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label="Select end date" />
                  </label>
                  <button type="button" className="relative mt-2 flex h-10 w-full items-center gap-2 rounded-[0.55rem] border border-[#ded6cf] bg-white px-2.5 text-left text-[#8b7d70]" onClick={() => openActivityTimePicker("end")}>
                    <ClockIcon />
                    <span className={`min-w-0 flex-1 text-[0.64rem] ${activityEndTime ? "text-[#111111]" : "text-[#9a928b]"}`}>{activityEndTime || "HH:MM AM"}</span>
                  </button>
                </div>
              </div>

              <label className="mt-4 block text-[0.72rem] font-bold">Status <span className="text-[#d00000]">*</span></label>
              <div className="relative mt-2">
                <select value={activityStatus} onChange={(event) => setActivityStatus(event.target.value as LodgeActivityFormPayload["status"])} className="h-10 w-full appearance-none rounded-[0.55rem] border border-[#ded6cf] bg-white py-0 pl-8 pr-9 text-[0.7rem] text-[#111111] outline-none">
                  <option value="scheduled">Planned</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <span className="pointer-events-none absolute left-3.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[#d68a00]" />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 rotate-90 text-[#8b7d70]"><ChevronIcon /></span>
              </div>

              <div className="mt-4 flex items-center justify-between gap-4">
                <span>
                  <span className="block text-[0.74rem] font-bold">Is Published</span>
                  <span className="mt-0.5 block text-[0.66rem] leading-4 text-[#6a625e]">Make this activity visible to all members.</span>
                </span>
                <button type="button" onClick={() => setIsActivityPublished((value) => !value)} className={`relative h-8 w-12 shrink-0 overflow-hidden rounded-full transition-colors ${isActivityPublished ? "bg-[#d68a00]" : "bg-[#ded6cf]"}`} aria-pressed={isActivityPublished} aria-label="Toggle published status">
                  <span className={`absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.16)] transition-transform ${isActivityPublished ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </div>
            </section>

            {activityFormError ? <p className="mt-3 rounded-xl bg-[#fff0f0] px-3 py-2 text-[0.68rem] text-[#c90000]">{activityFormError}</p> : null}

            <div className="mt-4 grid grid-cols-[0.9fr_1.85fr] gap-2.5">
              <button type="button" onClick={closeActivityForm} className="h-12 rounded-[0.62rem] border border-[#eadfda] bg-white text-[0.72rem] font-bold text-[#c10000] shadow-[0_8px_18px_rgba(75,48,20,0.045)]">
                Cancel
              </button>
              <button type="button" onClick={() => void saveActivity()} disabled={isSavingActivity} className="flex h-12 items-center justify-center gap-2 rounded-[0.62rem] bg-[linear-gradient(145deg,#f1a51c,#d88400)] text-[0.72rem] font-extrabold text-white shadow-[0_10px_20px_rgba(205,133,0,0.2)] disabled:cursor-not-allowed disabled:opacity-75">
                {isSavingActivity ? <ThemedLoader size="sm" className="brightness-125" /> : <CalendarIcon />}
                <span>{isSavingActivity ? "Saving..." : "Save Activity"}</span>
              </button>
            </div>
            </>
            ) : (
              <>
                <div className="rounded-[1rem] border border-[#f0e5d7] bg-white/88 px-3.5 py-2.5 shadow-[0_8px_20px_rgba(75,48,20,0.04)]">
                  <label className="flex items-center gap-2 text-[#716a66]">
                    <SearchIcon />
                    <input
                      type="search"
                      value={managedActivitySearch}
                      onChange={(event) => setManagedActivitySearch(event.target.value)}
                      placeholder="Search activities"
                      className="min-w-0 flex-1 bg-transparent text-[0.74rem] text-[#111111] outline-none placeholder:text-[#9a928b]"
                    />
                  </label>
                </div>

                <section className="mt-3 space-y-2.5">
                  {managedActivitiesError ? (
                    <p className="rounded-xl bg-[#fff0f0] px-3 py-2 text-[0.68rem] text-[#c90000]">{managedActivitiesError}</p>
                  ) : isManagedActivitiesLoading ? (
                    <div className="flex justify-center rounded-[1rem] bg-white/88 px-4 py-8"><ThemedLoader size="md" /></div>
                  ) : managedActivities.length > 0 ? (
                    managedActivities.map((activity) => (
                      <article key={activity.id} className="rounded-[0.92rem] border border-white/80 bg-white/92 p-3 shadow-[0_8px_20px_rgba(75,48,20,0.05)]">
                        <div className="flex items-start justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block truncate text-[0.78rem] font-bold text-[#111111]">{activity.title}</span>
                            <span className="mt-1 flex items-center gap-1.5 text-[0.62rem] text-[#5f5751]"><CalendarIcon />{formatSheetDateTime(activity.starts_at)}</span>
                            <span className="mt-0.5 flex items-center gap-1.5 text-[0.62rem] text-[#5f5751]"><PinIcon />{activity.place || "-"}</span>
                          </span>
                          <span className="shrink-0 rounded-full bg-[#fbf4ea] px-2.5 py-1 text-[0.56rem] font-bold text-[#8a5d12]">{activity.status}</span>
                        </div>
                        {activity.details ? <p className="mt-2 line-clamp-2 text-[0.64rem] leading-4 text-[#6a625e]">{activity.details}</p> : null}
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <button type="button" onClick={() => void openActivityDetails(activity)} className="h-9 rounded-[0.6rem] border border-[#eadfd3] bg-[#fffdfb] px-3 text-[0.64rem] font-bold text-[#4b4540]">View</button>
                          <button type="button" onClick={() => { setActivityToDelete(activity); setActivityDeleteError(""); }} className="h-9 rounded-[0.6rem] bg-[#fff0f0] px-3 text-[0.64rem] font-bold text-[#c10000]">Delete</button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="rounded-[1rem] bg-white/88 px-4 py-8 text-center text-[0.72rem] leading-5 text-[#665d57]">No activities found.</p>
                  )}
                </section>
              </>
            )}
          </div>

          <nav className="absolute inset-x-0 bottom-0 z-20 rounded-t-[1.35rem] border border-[#eee8e1] bg-white/95 px-3.5 pb-[max(0.55rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-7px_24px_rgba(75,48,20,0.07)] backdrop-blur-xl">
            <div className={`grid gap-1 ${contextualNavGridClass}`}>
              {contextualNavItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    if (item.id === "dashboard") {
                      setActiveView("home");
                      setActiveTab("dashboard");
                    } else if (item.id === "profile") {
                      void openFullProfile();
                    } else if (item.id === "documents") {
                      onDocumentsOpen?.();
                    } else {
                      closeActivityForm();
                    }
                  }}
                  className={`flex flex-col items-center gap-1 ${item.id === "dashboard" ? "text-[#d00000]" : "text-[#716a66]"}`}
                >
                  {item.icon}
                  <span className="text-[0.55rem] font-medium sm:text-[0.62rem]">{item.label}</span>
                  <span className={`h-[0.12rem] w-8 rounded-full ${item.id === "dashboard" ? "bg-[#d00000]" : "bg-transparent"}`} />
                </button>
              ))}
            </div>
          </nav>

          {activityTimePicker ? (
            <div className="absolute inset-0 z-40 flex items-end bg-[#171717]/42 backdrop-blur-[1px] member-sheet-backdrop-enter">
              <section className="w-full rounded-t-[1.25rem] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_45px_rgba(0,0,0,0.22)] member-sheet-panel-enter">
                <div className="mx-auto h-1 w-9 rounded-full bg-[#b8b0a8]" />
                <div className="mt-4 flex items-center justify-between">
                  <button type="button" onClick={() => setActivityTimePicker(null)} className="h-9 px-2 text-[0.72rem] font-bold text-[#c10000]">Cancel</button>
                  <h2 className="text-[0.92rem] font-extrabold tracking-[-0.03em]">{activityTimePicker.target === "start" ? "Start Time" : "End Time"}</h2>
                  <button type="button" onClick={applyActivityTimePicker} className="h-9 px-2 text-[0.72rem] font-bold text-[#d68a00]">Set</button>
                </div>
                <div className="mt-4 grid grid-cols-[1fr_1fr_1fr] gap-2.5">
                  <label className="text-[0.62rem] font-semibold text-[#6a625e]">
                    Hour
                    <select value={activityTimePicker.hour} onChange={(event) => setActivityTimePicker((current) => current ? { ...current, hour: event.target.value } : current)} className="mt-1 h-11 w-full rounded-[0.65rem] border border-[#ded6cf] bg-white px-2 text-center text-[0.82rem] font-bold text-[#111111] outline-none">
                      {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")).map((hour) => <option key={hour} value={hour}>{hour}</option>)}
                    </select>
                  </label>
                  <label className="text-[0.62rem] font-semibold text-[#6a625e]">
                    Minute
                    <select value={activityTimePicker.minute} onChange={(event) => setActivityTimePicker((current) => current ? { ...current, minute: event.target.value } : current)} className="mt-1 h-11 w-full rounded-[0.65rem] border border-[#ded6cf] bg-white px-2 text-center text-[0.82rem] font-bold text-[#111111] outline-none">
                      {Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0")).map((minute) => <option key={minute} value={minute}>{minute}</option>)}
                    </select>
                  </label>
                  <label className="text-[0.62rem] font-semibold text-[#6a625e]">
                    Period
                    <select value={activityTimePicker.period} onChange={(event) => setActivityTimePicker((current) => current ? { ...current, period: event.target.value as "AM" | "PM" } : current)} className="mt-1 h-11 w-full rounded-[0.65rem] border border-[#ded6cf] bg-white px-2 text-center text-[0.82rem] font-bold text-[#111111] outline-none">
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </label>
                </div>
              </section>
            </div>
          ) : null}

          {activityToDelete ? (
            <div className="absolute inset-0 z-50 flex items-end bg-[#171717]/48 backdrop-blur-[1px] member-sheet-backdrop-enter">
              <section className="w-full rounded-t-[1.25rem] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_45px_rgba(0,0,0,0.22)] member-sheet-panel-enter">
                <div className="mx-auto h-1 w-9 rounded-full bg-[#b8b0a8]" />
                <div className="mt-4 text-center">
                  <h2 className="text-[0.98rem] font-extrabold tracking-[-0.035em]">Delete Activity?</h2>
                  <p className="mx-auto mt-2 max-w-[20rem] text-[0.72rem] leading-5 text-[#6a625e]">
                    This will permanently delete “{activityToDelete.title}”.
                  </p>
                </div>
                {activityDeleteError ? <p className="mt-3 rounded-xl bg-[#fff0f0] px-3 py-2 text-[0.68rem] text-[#c90000]">{activityDeleteError}</p> : null}
                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  <button type="button" onClick={() => setActivityToDelete(null)} disabled={isDeletingActivity} className="h-11 rounded-[0.65rem] border border-[#eadfda] bg-white text-[0.72rem] font-bold text-[#4b4540] disabled:opacity-60">No</button>
                  <button type="button" onClick={() => void confirmDeleteActivity()} disabled={isDeletingActivity} className="flex h-11 items-center justify-center gap-2 rounded-[0.65rem] bg-[#d40000] text-[0.72rem] font-extrabold text-white disabled:opacity-70">
                    {isDeletingActivity ? <ThemedLoader size="sm" className="brightness-125" /> : null}
                    <span>{isDeletingActivity ? "Deleting..." : "Yes, Delete"}</span>
                  </button>
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </main>
    );
  }

  if (activeView === "petitioners") {
    return (
      <PetitionerListScreen
        initialStage={activePetitionerStage}
        navigationItems={contextualNavItems}
        onBack={() => setActiveView("home")}
        onNavigate={(itemId) => {
          if (itemId === "profile") {
            setActiveView("home");
            void openFullProfile();
          } else if (itemId === "documents") {
            onDocumentsOpen?.();
          } else if (itemId === "more") {
            setActiveView("home");
            setActiveTab("more");
          } else {
            setActiveView("home");
            setActiveTab("dashboard");
          }
        }}
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
            <button type="button" onClick={() => closeMembersList()} className="flex h-9 w-9 items-center justify-center text-[#1f2529]" aria-label="Back to dashboard">
              <Icon className="h-6 w-6"><path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" /></Icon>
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
                    onClick={() => { setActiveMemberFilter(filter.key); setMemberList([]); setMemberListCount(0); setMemberListError(""); }}
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
                    <div key={member.id} role="button" tabIndex={0} onClick={() => void openMemberProfile(member.id)} onKeyDown={(e) => { if (e.key === "Enter") { void openMemberProfile(member.id); } }} className="flex w-full items-center gap-2.5 rounded-[0.85rem] bg-white/90 px-2.5 py-2.5 text-left shadow-[0_8px_20px_rgba(75,48,20,0.045)] cursor-pointer">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(145deg,#20aa38,#008a1f)] text-[0.76rem] font-bold text-white shadow-[0_8px_16px_rgba(0,128,32,0.16)]">
                        {member.profile_photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={member.profile_photo_url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
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
                      {canEditMembers ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); void openEditMemberFor(member.id); }}
                          className="shrink-0 rounded-full border border-[#c8e4cf] bg-[#eef8f0] px-2.5 py-1 text-[0.58rem] font-bold text-[#138122]"
                          aria-label={`Edit ${member.name}`}
                        >
                          <span className="flex items-center gap-1">
                            <Icon className="h-3 w-3"><circle cx="12" cy="12" r="3" fill="currentColor" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m-13 0 2.1-2.1m8.6-8.6 2.1-2.1" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></Icon>
                            Edit
                          </span>
                        </button>
                      ) : (
                        <span className="text-[#111111]"><ChevronIcon /></span>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="rounded-2xl bg-white/88 px-4 py-8 text-center text-[0.78rem] leading-5 text-[#665d57]">No members found for this filter.</p>
              )}
            </section>
          </div>

          <nav className="absolute inset-x-0 bottom-0 z-20 rounded-t-[1.35rem] border border-[#eee8e1] bg-white/95 px-3.5 pb-[max(0.55rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-7px_24px_rgba(75,48,20,0.07)] backdrop-blur-xl">
            <div className={`grid gap-1 ${contextualNavGridClass}`}>
              {contextualNavItems.map((item) => {
                const isActive = usesSecretaryNav ? item.id === activeTab : activeTab === item.id;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      if (usesSecretaryNav) {
                        if (item.id === "dashboard") {
                          closeMembersList("dashboard");
                        } else if (item.id === "profile") {
                          setActiveView("home");
                          void openFullProfile();
                        } else if (item.id === "documents") {
                          onDocumentsOpen?.();
                        } else {
                          closeMembersList("more");
                        }
                        return;
                      }
                      if (item.id === "profile") {
                        setActiveView("home");
                        void openFullProfile();
                        return;
                      }
                      closeMembersList("dashboard");
                    }}
                    className={`flex flex-col items-center gap-1 ${isActive ? "text-[#d00000]" : "text-[#716a66]"}`}
                  >
                    {item.icon}<span className="text-[0.55rem] font-medium sm:text-[0.62rem]">{item.label}</span><span className={`h-[0.12rem] w-8 rounded-full ${isActive ? "bg-[#d00000]" : "bg-transparent"}`} />
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
              canEditMembers={canEditMembers}
              onEdit={(memberId) => { void openEditMemberFor(memberId); }}
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
              <Icon className="h-6 w-6"><path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" /></Icon>
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
                    <div key={member.id} role="button" tabIndex={0} onClick={() => void openMemberProfile(member.id)} onKeyDown={(e) => { if (e.key === "Enter") { void openMemberProfile(member.id); } }} className="flex w-full items-center gap-2.5 rounded-[0.85rem] bg-white/90 px-2.5 py-2.5 text-left shadow-[0_8px_20px_rgba(75,48,20,0.045)] cursor-pointer">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(145deg,#20aa38,#008a1f)] text-[0.76rem] font-bold text-white shadow-[0_8px_16px_rgba(0,128,32,0.16)]">
                        {member.profile_photo_url ? (
                          <img src={member.profile_photo_url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
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
                    </div>
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

  if (activeView === "profile" && fullProfile !== null) {
    const profileRows = [
      ["GLP No.", displayValue(fullProfile.glp_id_number)],
      ["Member since", formatDate(fullProfile.member_since)],
      ["Years", fullProfile.years_of_membership != null && fullProfile.years_of_membership >= 25 ? "LML" : String(fullProfile.years_of_membership ?? "-")],
      ["Status", memberGroupLabel(fullProfile.section)],
      ["Lodge", "Datu Lapu-Lapu Lodge No. 347"],
      ["Grand Lodge", "Grand Lodge of the Philippines"],
    ];
    const additionalRows = [
      ...(fullProfile.date_of_birth !== undefined ? [["Birthday", formatDate(fullProfile.date_of_birth)]] : []),
      ...(fullProfile.address !== undefined ? [["Address", displayValue(fullProfile.address)]] : []),
      ["Phone", displayValue(fullProfile.telephone)],
      ["Email", displayValue(fullProfile.email)],
      ["Blood Type", displayValue(fullProfile.blood_type)],
      ["Wife", displayValue(fullProfile.widow_or_sister)],
    ];
    const appendantItems = appendantBodyItems(fullProfile.appendant_bodies ?? {});
    const appendantCount = appendantItems.length;
    const displayedPositions = positionsHeld ?? fullProfile.positions_held ?? [];
    const positionsCount = displayedPositions.length;

    return (
      <main className="member-dashboard-paper h-[100svh] overflow-hidden text-[#111111]">
        <div className="relative mx-auto flex h-full w-full max-w-[26rem] flex-col overflow-hidden border-x border-[#eee7dd] bg-white/20 shadow-[0_0_35px_rgba(87,55,19,0.08)]">
          <header className="flex h-[4.4rem] shrink-0 items-center justify-between border-b border-[#eee7dd]/70 bg-white/72 px-5 backdrop-blur-md">
            <button type="button" onClick={() => closeFullProfile()} className="flex h-9 w-9 items-center justify-center text-[#1f2529]" aria-label="Back to dashboard">
              <Icon className="h-6 w-6"><path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" /></Icon>
            </button>
            <h1 className="text-[0.98rem] font-bold tracking-[-0.03em]">Member Profile</h1>
            <span className="h-9 w-9" />
          </header>

          <div className={`flex-1 overflow-y-auto px-3.5 pb-[5.6rem] pt-3.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${isProfileViewClosing ? "member-page-exit" : "member-page-enter"}`}>
            <section className="relative overflow-hidden rounded-b-[1.4rem] px-1 py-4">
              <svg viewBox="0 0 220 170" aria-hidden="true" className="pointer-events-none absolute -right-12 bottom-0 h-40 w-52 text-[#d58d00] opacity-[0.12]">
                <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M54 146 110 36l56 110M50 92l60 60 60-60M68 84l42 42 42-42" strokeWidth="4" />
                  <path d="M78 146h64M90 124h40M98 104h24" strokeWidth="2.6" />
                  <circle cx="110" cy="42" r="18" strokeWidth="2.6" />
                  <path d="M110 20v46M94 42h32" strokeWidth="2.6" />
                </g>
                <text x="110" y="113" textAnchor="middle" fill="currentColor" fontSize="42" fontWeight="700" fontFamily="Georgia, serif">G</text>
              </svg>
              <div className="relative z-10 flex items-center gap-4">
                <div className="relative flex h-[6.6rem] w-[6.6rem] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f8efe3] text-[#d58d00] shadow-[0_10px_24px_rgba(74,48,19,0.12)] ring-4 ring-white/75">
                  {fullProfile.profile_photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fullProfile.profile_photo_url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                  ) : (
                    <PersonIcon />
                  )}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <h2 className="text-[1.38rem] font-bold leading-none tracking-[-0.05em]">{profileDisplayName(fullProfile.name)}</h2>
                  <div className="mt-2 w-fit rounded-full bg-[linear-gradient(145deg,#eba51a,#c97b00)] px-3 py-1 text-[0.68rem] font-semibold text-white shadow-[0_6px_12px_rgba(205,133,0,0.2)]">{fullProfile.lodge_standing}</div>
                  {(() => {
                    const s = fullProfile.status.toLowerCase();
                    const dotColor = (s.includes("dropped") || s.includes("working tools")) ? "bg-[#5f5a57]" : (s.includes("suspended") || s.includes("demit") || s.includes("inactive") || s.includes("not active")) ? "bg-[#c90000]" : "bg-[#06b834]";
                    return (
                      <div className="mt-3 flex items-center gap-2 text-[0.72rem] font-medium text-[#2d2824]"><span className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />{fullProfile.status}</div>
                    );
                  })()}
                </div>
              </div>
            </section>

            <section className="mt-4 rounded-[1rem] border border-white/80 bg-white/88 px-3.5 py-2 shadow-[0_10px_24px_rgba(74,48,19,0.06)]">
              {profileRows.map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-4 border-b border-[#e9e1d8] py-2.5 last:border-b-0">
                  <span className="text-[0.74rem] text-[#59524d]">{label}</span>
                      <span className={`max-w-[58%] text-right text-[0.74rem] leading-snug ${label === "Status" ? (() => { const s = String(value).toLowerCase(); return (s.includes("dropped") || s.includes("working tools")) ? "font-medium text-[#5f5a57]" : (s.includes("suspended") || s.includes("demit") || s.includes("inactive") || s.includes("not active")) ? "font-medium text-[#c90000]" : "font-medium text-[#009622]"; })() : "text-[#111111]"}`}>{value}</span>
                </div>
              ))}
            </section>

            <section className="mt-3 rounded-[1rem] border border-white/80 bg-white/88 p-3.5 shadow-[0_10px_24px_rgba(74,48,19,0.06)]">
              <h3 className="text-[0.78rem] font-bold">Membership History</h3>
              <div className="relative mt-4 grid grid-cols-3 items-start text-center">
                <div className="absolute left-[16.666%] right-[16.666%] top-3 h-px bg-[#dfd8cf]" />
                {[
                  ["Initiated", fullProfile.initiation_date],
                  ["Passed", fullProfile.passing_date],
                  ["Raised", fullProfile.raising_date],
                ].map(([label, dateValue]) => (
                  <div key={label} className="relative z-10">
                    <div className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-[#aae4b7] text-[#087d1f] ring-4 ring-white/90"><CheckIcon /></div>
                    <div className="mt-2 text-[0.68rem] leading-tight text-[#2f2a27]">{label}</div>
                    <div className="mt-0.5 text-[0.62rem] leading-tight text-[#4f4843]">{formatDate(dateValue)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t border-[#e9e1d8] pt-3 text-center">
                <div className="text-[0.72rem] font-bold text-[#c77800]">Proficiency</div>
                <div className="mt-1 text-[0.68rem] font-semibold text-[#4f4843]">{formatDate(fullProfile.proficiency_date)}</div>
              </div>
            </section>

            <section className="mt-3 rounded-[1rem] border border-white/80 bg-white/88 px-3.5 py-3 shadow-[0_10px_24px_rgba(74,48,19,0.06)]">
              <h3 className="text-[0.78rem] font-bold">Personal Information</h3>
              <div className="mt-2">
                {additionalRows.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4 border-b border-[#e9e1d8] py-2.5 last:border-b-0">
                    <span className="text-[0.74rem] text-[#59524d]">{label}</span>
                    <span className="max-w-[58%] text-right text-[0.74rem] leading-snug text-[#111111]">{value}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-3 rounded-[1rem] border border-white/80 bg-white/88 px-3.5 py-3 shadow-[0_10px_24px_rgba(74,48,19,0.06)]">
              <h3 className="text-[0.78rem] font-bold">Masonic Involvement</h3>
              <button type="button" onClick={openAppendantSheet} className="flex w-full items-center justify-between border-b border-[#e9e1d8] py-2.5 text-left">
                <span className="flex items-center gap-2 text-[0.74rem] text-[#423c37]"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#fff4e3] text-[#d58d00]"><AwardIcon /></span>Appendant Bodies & Club</span>
                <span className="flex items-center gap-2 text-[0.74rem] text-[#111111]">{appendantCount}<ChevronIcon /></span>
              </button>
              <button type="button" onClick={() => void openPositionsSheet()} className="flex w-full items-center justify-between py-2.5 text-left">
                <span className="flex items-center gap-2 text-[0.74rem] text-[#423c37]"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#fff4e3] text-[#d58d00]"><AwardIcon /></span>Positions Held</span>
                <span className="flex items-center gap-2 text-[0.74rem] text-[#111111]">{isPositionsLoading ? <ThemedLoader size="sm" /> : positionsCount}<ChevronIcon /></span>
              </button>
            </section>

            <section className="mt-3 rounded-[1rem] border border-white/80 bg-white/88 p-3.5 shadow-[0_10px_24px_rgba(74,48,19,0.06)]">
              <h3 className="text-[0.78rem] font-bold">Standing Summary</h3>
              <div className="mt-3 grid grid-cols-4 divide-x divide-[#e9e1d8]">
                <div className="px-1.5 text-center">
                  <span className={`mx-auto flex h-5 w-5 items-center justify-center rounded-full ${fullProfile.three_meetings_rule ? "bg-[#168129] text-white" : "bg-[#d9d0c7] text-white"}`}>
                    {fullProfile.three_meetings_rule ? (
                      <Icon className="h-3 w-3"><path d="m4.5 12 3.5 3.5 7-7.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.3" /></Icon>
                    ) : (
                      <span className="text-[0.48rem] font-bold">—</span>
                    )}
                  </span>
                  <div className="mt-1 text-[0.52rem] font-bold text-[#3a342f]">3 Meeting Rule</div>
                  <div className={`text-[0.46rem] font-semibold ${fullProfile.three_meetings_rule ? "text-[#147622]" : "text-[#90887e]"}`}>
                    {fullProfile.attendance_this_year} Meeting
                  </div>
                </div>
                <div className="px-1.5 text-center">
                  <span className={`mx-auto flex h-5 w-5 items-center justify-center rounded-full ${fullProfile.six_meetings_rule ? "bg-[#168129] text-white" : "bg-[#d9d0c7] text-white"}`}>
                    {fullProfile.six_meetings_rule ? (
                      <Icon className="h-3 w-3"><path d="m4.5 12 3.5 3.5 7-7.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.3" /></Icon>
                    ) : (
                      <span className="text-[0.48rem] font-bold">—</span>
                    )}
                  </span>
                  <div className="mt-1 text-[0.52rem] font-bold text-[#3a342f]">6 Meeting Rule</div>
                  <div className={`text-[0.46rem] font-semibold ${fullProfile.six_meetings_rule ? "text-[#147622]" : "text-[#90887e]"}`}>{fullProfile.six_meeting_attendance} Meeting</div>
                </div>
                <div className="px-1.5 text-center">
                  <span className={`mx-auto flex h-5 w-5 items-center justify-center rounded-full ${fullProfile.dues_status.startsWith("Paid") ? "bg-[#168129] text-white" : "bg-[#d9d0c7] text-white"}`}>
                    {fullProfile.dues_status.startsWith("Paid") ? (
                      <Icon className="h-3 w-3"><path d="m4.5 12 3.5 3.5 7-7.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.3" /></Icon>
                    ) : (
                      <span className="text-[0.48rem] font-bold">—</span>
                    )}
                  </span>
                  <div className="mt-1 text-[0.52rem] font-bold text-[#3a342f]">Dues</div>
                  <div className={`text-[0.48rem] font-semibold ${fullProfile.dues_status.startsWith("Paid") ? "text-[#147622]" : "text-[#938b83]"}`}>
                    {fullProfile.dues_status}
                  </div>
                </div>
                <div className="px-1.5 text-center">
                  <span className={`mx-auto flex h-5 w-5 items-center justify-center rounded-full ${fullProfile.proficiency_date ? "bg-[#168129] text-white" : "bg-[#d9d0c7] text-white"}`}>
                    {fullProfile.proficiency_date ? (
                      <Icon className="h-3 w-3"><path d="m4.5 12 3.5 3.5 7-7.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.3" /></Icon>
                    ) : (
                      <span className="text-[0.48rem] font-bold">—</span>
                    )}
                  </span>
                  <div className="mt-1 text-[0.52rem] font-bold text-[#3a342f]">Proficiency</div>
                </div>
              </div>
            </section>
          </div>

          <nav className="absolute inset-x-0 bottom-0 z-20 rounded-t-[1.35rem] border border-[#eee8e1] bg-white/95 px-3.5 pb-[max(0.55rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-7px_24px_rgba(75,48,20,0.07)] backdrop-blur-xl">
            <div className={`grid gap-1 ${contextualNavGridClass}`}>
              {contextualNavItems.map((item) => {
                const isActive = usesSecretaryNav ? item.id === "profile" : item.id === "profile";
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      if (usesSecretaryNav) {
                        if (item.id === "dashboard") {
                          (onDashboardClose ?? onProfileClose)?.();
                        } else if (item.id === "profile") {
                          void openFullProfile();
                        } else if (item.id === "documents") {
                          onDocumentsOpen?.();
                        } else {
                          setActiveView("home");
                          setActiveTab("more");
                        }
                        return;
                      }
                      if (item.id === "profile") {
                        return;
                      }
                      closeFullProfile("dashboard");
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

          {isAppendantSheetOpen ? (
            <div className={`absolute inset-0 z-40 flex items-end bg-[#171717]/48 backdrop-blur-[1px] ${closingSheet === "appendant" ? "member-sheet-backdrop-exit" : "member-sheet-backdrop-enter"}`}>
              <section className={`max-h-[72%] w-full overflow-hidden rounded-t-[1.2rem] bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_45px_rgba(0,0,0,0.22)] ${closingSheet === "appendant" ? "member-sheet-panel-exit" : "member-sheet-panel-enter"}`}>
                <div className="mx-auto h-1 w-9 rounded-full bg-[#9b9b9b]" />
                <div className="mt-5 flex items-center justify-between">
                  <button type="button" onClick={() => closeSheet("appendant")} className="flex h-9 w-9 items-center justify-center text-[#111111]" aria-label="Close appendant bodies">
                    <Icon className="h-7 w-7"><path d="M6 6 18 18M18 6 6 18" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" /></Icon>
                  </button>
                  <h2 className="text-[1.05rem] font-bold tracking-[-0.035em]">Appendant Bodies & Club</h2>
                  <span className="h-9 w-9" />
                </div>
                <div className="mt-4 max-h-[calc(72svh-6rem)] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {appendantItems.length > 0 ? (
                    appendantItems.map((item) => (
                      <button key={item.key} type="button" className="flex w-full items-center gap-3 border-b border-[#eadfd3] py-3 text-left last:border-b-0">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#fbf7f0]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={item.logoPath} alt="" className="h-full w-full object-contain" loading="lazy" decoding="async" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[0.92rem] font-bold leading-tight tracking-[-0.025em] text-[#111111]">{item.name}</span>
                        </span>
                        <span className="text-[#111111]"><ChevronIcon /></span>
                      </button>
                    ))
                  ) : (
                    <p className="rounded-2xl bg-[#fbf7f0] px-4 py-5 text-center text-[0.78rem] leading-5 text-[#665d57]">No appendant bodies are currently recorded for this member.</p>
                  )}
                </div>
              </section>
            </div>
          ) : null}

          {isPositionsSheetOpen ? (
            <div className={`absolute inset-0 z-40 flex items-end bg-[#171717]/48 backdrop-blur-[1px] ${closingSheet === "positions" ? "member-sheet-backdrop-exit" : "member-sheet-backdrop-enter"}`}>
              <section className={`max-h-[72%] w-full overflow-hidden rounded-t-[1.2rem] bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_45px_rgba(0,0,0,0.22)] ${closingSheet === "positions" ? "member-sheet-panel-exit" : "member-sheet-panel-enter"}`}>
                <div className="mx-auto h-1 w-9 rounded-full bg-[#9b9b9b]" />
                <div className="mt-5 flex items-center justify-between">
                  <button type="button" onClick={() => closeSheet("positions")} className="flex h-9 w-9 items-center justify-center text-[#111111]" aria-label="Close positions held">
                    <Icon className="h-7 w-7"><path d="M6 6 18 18M18 6 6 18" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" /></Icon>
                  </button>
                  <h2 className="text-[1.05rem] font-bold tracking-[-0.035em]">Positions Held</h2>
                  <span className="h-9 w-9" />
                </div>
                <div className="mt-4 max-h-[calc(72svh-6rem)] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {isPositionsLoading ? (
                    <div className="flex justify-center rounded-2xl bg-[#fbf7f0] px-4 py-8"><ThemedLoader size="md" /></div>
                  ) : positionsError ? (
                    <p className="rounded-2xl bg-[#fff0f0] px-4 py-5 text-center text-[0.78rem] leading-5 text-[#c90000]">{positionsError}</p>
                  ) : displayedPositions.length > 0 ? (
                    [...displayedPositions].sort((a, b) => {
                      const extractYear = (dateRange: string) => {
                        const years = dateRange.match(/\d{4}/g);
                        return years ? Number(years[years.length - 1]) : 0;
                      };
                      const aEnd = a.end_date ? new Date(a.end_date).getTime() : null;
                      const bEnd = b.end_date ? new Date(b.end_date).getTime() : null;
                      const aYear = a.date_range ? extractYear(a.date_range) : 0;
                      const bYear = b.date_range ? extractYear(b.date_range) : 0;
                      return (bEnd ?? bYear) - (aEnd ?? aYear);
                    }).map((position) => (
                      <article key={position.id} className="flex items-start gap-3 border-b border-[#eadfd3] py-3 last:border-b-0">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#fff4e3] text-[#d58d00]">
                          <AwardIcon />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[0.92rem] font-bold leading-tight tracking-[-0.025em] text-[#111111]">{position.title}</span>
                          <span className="mt-0.5 block text-[0.78rem] leading-tight text-[#4d4742]">{position.date_range || "Date range not recorded"}</span>
                          {position.notes ? <span className="mt-1.5 block text-[0.68rem] leading-5 text-[#6b635d]">{position.notes}</span> : null}
                        </span>
                      </article>
                    ))
                  ) : (
                    <p className="rounded-2xl bg-[#fbf7f0] px-4 py-5 text-center text-[0.78rem] leading-5 text-[#665d57]">No positions held are currently recorded for this member.</p>
                  )}
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </main>
    );
  }

  const greeting = timeBasedGreeting();

  return (
    <main className="member-dashboard-paper h-[100svh] overflow-hidden text-[#111111]">
      <div className="relative mx-auto flex h-full w-full max-w-[26rem] flex-col overflow-hidden border-x border-[#eee7dd] bg-white/20 px-3.5 pt-3.5 shadow-[0_0_35px_rgba(87,55,19,0.08)] sm:px-4 sm:pt-4">
        <header className="flex shrink-0 items-start justify-between gap-2.5 px-1">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <Image src="/branding/dll347-logo.png" alt="Datu Lapu-Lapu Lodge No. 347 logo" width={62} height={62} priority className="h-[3.55rem] w-[3.55rem] shrink-0 drop-shadow-[0_8px_14px_rgba(116,72,12,0.2)] sm:h-[4rem] sm:w-[4rem]" />
            <h1 className="text-[0.94rem] font-bold leading-[1.15] tracking-[-0.045em] sm:text-[1.08rem]">
              {greeting},
              <br />
              Brother <span aria-hidden="true">👋</span>
            </h1>
          </div>
          <button type="button" onClick={() => void onLogout()} className="mt-1.5 shrink-0 rounded-full border border-[#edcccc] bg-white/75 px-3 py-1.5 text-xs font-semibold text-[#c90000] shadow-[0_5px_12px_rgba(60,40,20,0.04)] sm:px-4 sm:py-2 sm:text-sm">
            Sign out
          </button>
        </header>

        <div className="mt-3.5 flex-1 space-y-3 overflow-y-auto pb-[5.6rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mt-4 sm:space-y-3.5">
          {activeTab === "more" ? (
            <section className="rounded-[1.25rem] border border-white/80 bg-white/90 p-4 shadow-[0_12px_30px_rgba(74,48,19,0.08)] sm:rounded-[1.45rem] sm:p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f7efe5] text-[#d58d00] shadow-[inset_0_0_0_1px_rgba(220,171,91,0.18)]">
                  {profile.profile_photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.profile_photo_url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                  ) : (
                    <CameraIcon />
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold tracking-[-0.03em] text-[#111111]">Tools</h2>
                  <p className="mt-0.5 text-[0.68rem] leading-snug text-[#655e59] sm:text-xs">Access lodge activities, member, and petitioner record tools.</p>
                </div>
              </div>

              {canManageActivities ? (
                <button type="button" onClick={openActivityForm} className="mt-3 flex w-full items-center justify-between rounded-[1rem] border border-[#f0e5d7] bg-[#fffdfb] p-3 text-left shadow-[0_8px_20px_rgba(75,48,20,0.04)]">
                  <span className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(145deg,#eda600,#c77900)] text-white"><CalendarIcon /></span>
                    <span>
                      <span className="block text-xs font-semibold text-[#111111]">Activity</span>
                      <span className="mt-0.5 block text-[0.62rem] text-[#706760]">Create and publish lodge activities.</span>
                    </span>
                  </span>
                  <span className="text-[#77716d]"><ChevronIcon /></span>
                </button>
              ) : null}

              {canEditMembers ? (
                <button type="button" onClick={openMemberEdit} className="mt-3 flex w-full items-center justify-between rounded-[1rem] border border-[#f0e5d7] bg-[#fffdfb] p-3 text-left shadow-[0_8px_20px_rgba(75,48,20,0.04)]">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(145deg,#20aa38,#008a1f)] text-white"><PersonIcon /></span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-[#111111]">Edit Member</span>
                      <span className="mt-0.5 block truncate text-[0.62rem] text-[#706760]">Select and update member records.</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-[#77716d]"><ChevronIcon /></span>
                </button>
              ) : null}

              {canEditPetitioners ? (
                <button type="button" onClick={openPetitionerEdit} className="mt-3 flex w-full items-center justify-between rounded-[1rem] border border-[#dce8f5] bg-[#fffdfb] p-3 text-left shadow-[0_8px_20px_rgba(47,111,189,0.06)]">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(145deg,#5b7dba,#2f6fbd)] text-white"><PersonIcon /></span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-[#111111]">Edit Petitioner</span>
                      <span className="mt-0.5 block truncate text-[0.62rem] text-[#706760]">Select and update petitioner records.</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-[#477dbf]"><ChevronIcon /></span>
                </button>
              ) : null}
            </section>
          ) : (
            <>
          {dashboardCardVisibility.lodge_health_indicator ? (
          <section className="rounded-[1.25rem] border border-[#f1ece4] bg-white/88 px-4 py-4 shadow-[0_14px_34px_rgba(149,110,46,0.08)] backdrop-blur-[10px] sm:rounded-[1.45rem]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="text-[#cf8c00]">
                  <PulseIcon />
                </div>
                <h2 className="text-[0.92rem] font-extrabold tracking-[-0.04em] text-[#18130f]">
                  Lodge Health Indicator
                </h2>
              </div>
              <div className="text-right leading-none">
                <div className="text-[2.1rem] font-black tracking-[-0.06em] text-[#cf8c00]">
                  {dashboardSummary.overall_percent}%
                </div>
                <div className="mt-1 text-[0.72rem] font-bold text-[#62980d]">
                  {healthLabel(dashboardSummary.overall_percent)}
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {buildHealthRows(dashboardSummary).map((row) => (
                <div
                  key={row.title}
                  className="grid grid-cols-[8.6rem_minmax(0,1fr)] items-center gap-x-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: row.iconBg === "bg-[#14812a]" ? "#14812a" : row.iconBg === "bg-[#cc1313]" ? "#cc1313" : "#cf8c00" }}>
                      {row.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[0.88rem] font-extrabold leading-none tracking-[-0.04em] text-[#18130f]">
                        {row.title}
                      </div>
                      <div className="mt-1 text-[0.72rem] leading-[1.08] text-[#23201d]">
                        {row.subtitle}
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="h-[0.36rem] flex-1 overflow-hidden rounded-full bg-[#f5eaea]">
                        <div
                          className={`h-full rounded-full ${row.color}`}
                          style={{ width: `${row.percent}%` }}
                        />
                      </div>
                      <span className={`w-10 shrink-0 text-right text-[0.72rem] font-bold ${row.title === "Growth" ? "text-[#cc1313]" : "text-[#cf8c00]"}`}>
                        {row.percent}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
          ) : null}

          {dashboardCardVisibility.next_lodge_activity ? (
          <section className="relative overflow-hidden rounded-[1.25rem] border border-white/80 bg-white/88 p-3.5 shadow-[0_12px_30px_rgba(74,48,19,0.08)] sm:rounded-[1.45rem] sm:p-4">
            <LodgeWatermark />
            <div className="relative z-10 flex items-start gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(145deg,#e30909,#bd0000)] text-white shadow-[0_8px_20px_rgba(194,0,0,0.2)] sm:h-12 sm:w-12"><CalendarIcon /></div>
              <div className="min-w-0 flex-1">
                <div className="text-[0.68rem] font-semibold text-[#d00000] sm:text-xs">Next Lodge Activity</div>
                <h2 className="mt-1.5 text-[1.18rem] font-bold leading-none tracking-[-0.045em] sm:text-[1.35rem]">
                  {isNextActivityLoading ? <ThemedLoader size="sm" /> : nextActivity?.title ?? "No upcoming activity"}
                </h2>
              </div>
            </div>
            {nextActivity ? (
              <>
                <div className="relative z-10 mt-4 space-y-2 text-[0.68rem] text-[#3d3733] sm:text-xs">
                  <div className="flex items-center gap-2 text-[#6a6460]"><CalendarIcon /><span className="text-[#3d3733]">{formatActivityDate(nextActivity.starts_at)}</span></div>
                  <div className="flex items-center gap-2 text-[#6a6460]"><ClockIcon /><span className="text-[#3d3733]">{formatActivityTime(nextActivity.starts_at)}</span></div>
                  <div className="flex items-center gap-2 text-[#6a6460]"><PinIcon /><span className="text-[#3d3733]">{nextActivity.place}</span></div>
                </div>
                <div className="relative z-10 mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void openActivityDetails(nextActivity)} className="w-fit whitespace-nowrap rounded-[0.8rem] bg-[#d40000] px-4 py-2 text-[10px] font-semibold text-white shadow-[0_8px_18px_rgba(208,0,0,0.17)]">View Details</button>
                  <button type="button" onClick={() => void openEventList()} className="flex w-fit items-center justify-center gap-1 whitespace-nowrap rounded-[0.8rem] border border-[#d40000] bg-white/65 px-4 py-2 text-[10px] font-semibold text-[#d00000]"><CalendarIcon /><span>Event List</span></button>
                </div>
              </>
            ) : isNextActivityLoading ? null : (
              <p className="relative z-10 mt-4 text-[0.68rem] leading-5 text-[#655e59] sm:text-xs">Please check back soon for the next lodge schedule.</p>
            )}
            {nextActivityError ? <p className="relative z-10 mt-3 rounded-xl bg-[#fff0f0] px-3 py-2 text-[0.68rem] text-[#c90000]">{nextActivityError}</p> : null}
          </section>
          ) : null}

          {dashboardCardVisibility.members ? (
          <section className="rounded-[1.25rem] border border-white/80 bg-white/88 p-3.5 shadow-[0_12px_30px_rgba(74,48,19,0.08)] sm:rounded-[1.45rem] sm:p-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(145deg,#eda600,#c77900)] text-white shadow-[0_8px_20px_rgba(205,133,0,0.2)] sm:h-12 sm:w-12"><PersonIcon group /></div>
              <h2 className="text-base font-semibold text-[#c98200] sm:text-lg">Members</h2>
            </div>
            <div className="mt-3.5 grid grid-cols-4 gap-1.5 min-[400px]:grid-cols-5 sm:gap-2.5">
              {memberDisplayGroups.map((group) => {
                const value = group.count;
                return (
                  <button key={group.label} type="button" onClick={() => openMembersList(group.key)} className="flex min-h-[6.5rem] flex-col items-center rounded-[0.85rem] border border-[#f2ebe3] bg-[#fffdfb] px-1 py-2.5 text-center shadow-[0_5px_14px_rgba(75,48,20,0.03)] sm:min-h-[7.25rem] sm:px-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full text-white sm:h-9 sm:w-9" style={{ backgroundColor: group.color }}>{group.icon}</span>
                    <span className="mt-1.5 min-h-7 whitespace-pre-line text-[0.55rem] font-medium leading-[1.22] sm:text-[0.62rem]" style={{ color: group.color }}>{group.dashboardLabel}</span>
                    <span className="mt-auto flex items-center gap-0.5 text-base font-bold sm:text-lg">
                      <span>{isMemberSummaryLoading ? <ThemedLoader size="sm" /> : value ?? "-"}</span>
                      <span className="text-[#77716d]"><ChevronIcon /></span>
                    </span>
                  </button>
                );
              })}
            </div>
            {memberSummaryError ? <p className="mt-3 rounded-xl bg-[#fff0f0] px-3 py-2 text-[0.68rem] text-[#c90000]">{memberSummaryError}</p> : null}
          </section>
          ) : null}

          {dashboardCardVisibility.petitioner ? (
            <PetitionerDashboardCard summary={dashboardSummary.petitioner} onSelect={openPetitionerList} />
          ) : null}

          {dashboardCardVisibility.dues_collection ? (
          <section className="rounded-[1.25rem] border border-[#f1ece4] bg-white/88 px-4 py-4 shadow-[0_14px_34px_rgba(149,110,46,0.08)] backdrop-blur-[10px] sm:rounded-[1.45rem] sm:p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-[#fff7f7] p-1.5 text-[#d31313]">
                <MoneyCircleIcon />
              </div>
              <h2 className="text-[0.92rem] font-extrabold tracking-[-0.04em] text-[#18130f]">
                {dashboardSummary.year} Dues Collection
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
              {([
                { label: "Paid", value: String(dashboardSummary.dues_collection.paid_count), color: "text-[#6e9a1d]", icon: <CheckStatusIcon />, panel: "bg-[#fdf9f3]", status: "paid" as const },
                { label: "Unpaid", value: String(dashboardSummary.dues_collection.unpaid_count), color: "text-[#d31313]", icon: <AlertIcon />, panel: "bg-[#fff7f7]", status: "unpaid" as const },
                { label: "Total", value: String(dashboardSummary.dues_collection.total_count), color: "text-[#cf8c00]", icon: <MembersOutlineIcon />, panel: "bg-[#fdf9f3]", status: "all" as const },
                { label: "Rate", value: `${dashboardSummary.dues_collection.percent}%`, color: "text-[#cf8c00]", icon: <PercentIcon />, panel: "bg-[#fdf9f3]" },
              ] as const).map((item) => (
                "status" in item ? (
                  <button key={item.label} type="button" onClick={() => openDuesMemberList(item.status!)} className={`rounded-[1.15rem] px-2 py-3 text-center transition-all active:scale-95 ${item.panel} hover:shadow-[0_4px_14px_rgba(0,0,0,0.1)] cursor-pointer`}>
                    <div className={`mx-auto flex justify-center ${item.color}`}>{item.icon}</div>
                    <div className="mt-2 text-[0.7rem] leading-none text-[#18130f]">{item.label}</div>
                    <div className="mt-1.5 flex items-center justify-center">
                      <span className="relative text-[1.05rem] font-bold leading-none text-[#18130f]">
                        {item.value}
                        <span className="absolute left-full top-1/2 -translate-y-1/2 text-[#77716d]"><Icon className="h-3.5 w-3.5"><path d="m9 5.5 6 6.5-6 6.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" /></Icon></span>
                      </span>
                    </div>
                  </button>
                ) : (
                  <div key={item.label} className={`rounded-[1.15rem] px-2 py-3 text-center ${item.panel}`}>
                    <div className={`mx-auto flex justify-center ${item.color}`}>{item.icon}</div>
                    <div className="mt-2 text-[0.7rem] leading-none text-[#18130f]">{item.label}</div>
                    <div className="mt-1.5 text-[1.05rem] font-bold leading-none text-[#18130f]">{item.value}</div>
                  </div>
                )
              ))}
            </div>

            <button
              type="button"
              onClick={() => { setClosingSheet(null); setIsPaymentSheetOpen(true); }}
              className="mt-4 flex w-full items-center justify-between rounded-[1.05rem] bg-[linear-gradient(145deg,#1c4b8f,#123763)] px-4 py-3 text-left shadow-[0_10px_22px_rgba(18,55,99,0.22)] transition-all active:scale-[0.98]"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white">
                  <WalletIcon />
                </span>
                <span>
                  <span className="block text-[0.78rem] font-bold text-white">Payment Details</span>
                  <span className="mt-0.5 block text-[0.62rem] text-white/70">View bank account for dues payment</span>
                </span>
              </span>
              <span className="text-white/80"><ChevronIcon /></span>
            </button>
          </section>
          ) : null}

          {dashboardCardVisibility.financial_summary ? (
          <section className="rounded-[1.25rem] border border-[#f1ece4] bg-white/88 px-4 py-4 shadow-[0_14px_34px_rgba(149,110,46,0.08)] backdrop-blur-[10px] sm:rounded-[1.45rem] sm:p-4">
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
                  {dashboardSummary.finances.report_period_label ? `As of ${dashboardSummary.finances.report_period_label}` : "No report yet"}
                </div>
                {dashboardSummary.finances.source_date ? <div>Uploaded {formatSourceDate(dashboardSummary.finances.source_date)}</div> : null}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-4 rounded-[1.15rem] bg-[#fdf9f3] px-1 py-4 text-center shadow-[inset_0_0_0_1px_rgba(246,238,226,0.55)]">
              <div className="flex flex-col items-center px-1">
                <div className="text-[0.55rem] font-medium leading-tight text-[#18130f]">Previous<br/>Balance</div>
                <div className="mt-1.5 text-[0.7rem] font-extrabold leading-tight text-[#168234] tracking-[-0.02em]">
                  {formatPesoAmount(dashboardSummary.finances.previous_balance)}
                </div>
              </div>
              <div className="flex flex-col items-center border-x border-[#eadfd6] px-1">
                <div className="text-[0.55rem] font-medium leading-tight text-[#18130f]">Cash<br/>Received</div>
                <div className="mt-1.5 text-[0.7rem] font-extrabold leading-tight text-[#cf8c00] tracking-[-0.02em]">
                  {formatPesoAmount(dashboardSummary.finances.cash_received)}
                </div>
              </div>
              <div className="flex flex-col items-center px-1">
                <div className="text-[0.55rem] font-medium leading-tight text-[#18130f]">Cash<br/>Outflow</div>
                <div className="mt-1.5 text-[0.7rem] font-extrabold leading-tight text-[#cc1313] tracking-[-0.02em]">
                  {formatPesoAmount(dashboardSummary.finances.cash_outflow)}
                </div>
              </div>
              <div className="flex flex-col items-center border-l border-[#eadfd6] px-1">
                <div className="text-[0.55rem] font-medium leading-tight text-[#18130f]">Cash On<br/>Hand</div>
                <div className="mt-1.5 text-[0.7rem] font-extrabold leading-tight text-[#168234] tracking-[-0.02em]">
                  {formatPesoAmount(dashboardSummary.finances.cash_on_hand)}
                </div>
              </div>
            </div>
          </section>
          ) : null}
            </>
          )}
        </div>

        <nav className="absolute inset-x-0 bottom-0 z-20 rounded-t-[1.35rem] border border-[#eee8e1] bg-white/95 px-3.5 pb-[max(0.55rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-7px_24px_rgba(75,48,20,0.07)] backdrop-blur-xl">
          <div className={`grid gap-1 ${contextualNavGridClass}`}>
            {contextualNavItems.map((item) => {
              const isActive = usesSecretaryNav ? item.id === activeTab || (item.id === "profile" && activeView === "profile") : activeTab === item.id;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    if (usesSecretaryNav) {
                      if (item.id === "dashboard") {
                        (onDashboardClose ?? onProfileClose)?.();
                      } else if (item.id === "profile") {
                        void openFullProfile();
                      } else if (item.id === "documents") {
                        onDocumentsOpen?.();
                      } else {
                        setActiveView("home");
                        setActiveTab("more");
                      }
                      return;
                    }
                    if (item.id === "profile") {
                      void openFullProfile();
                      return;
                    }
                    if (item.id === "more") {
                      setActiveView("home");
                      setActiveTab("more");
                      return;
                    }
                    setActiveTab("dashboard");
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
                  <Icon className="h-7 w-7"><path d="M6 6 18 18M18 6 6 18" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" /></Icon>
                </button>
                <h2 className="min-w-0 flex-1 truncate px-2 text-center text-[1.05rem] font-bold tracking-[-0.035em]">{isEventListMode ? "Events This Year" : selectedActivity.title}</h2>
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
        {isEventListSheetOpen ? (
          <div className={`absolute inset-0 z-40 flex items-end bg-[#171717]/58 backdrop-blur-[1px] ${closingSheet === "eventlist" ? "member-sheet-backdrop-exit" : "member-sheet-backdrop-enter"}`}>
            <section className={`flex max-h-[82%] w-full flex-col overflow-hidden rounded-t-[1.35rem] bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_45px_rgba(0,0,0,0.24)] ${closingSheet === "eventlist" ? "member-sheet-panel-exit" : "member-sheet-panel-enter"}`}>
              <div className="mx-auto h-1 w-9 shrink-0 rounded-full bg-[#9b9b9b]" />
              <div className="mt-5 flex shrink-0 items-center justify-between">
                <button type="button" onClick={() => closeSheet("eventlist")} className="flex h-9 w-9 items-center justify-center text-[#111111]" aria-label="Close event list">
                  <Icon className="h-7 w-7"><path d="M6 6 18 18M18 6 6 18" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" /></Icon>
                </button>
                <h2 className="min-w-0 flex-1 truncate px-2 text-center text-[1.05rem] font-bold tracking-[-0.035em]">Events This Year</h2>
                <span className="h-9 w-9" />
              </div>
              <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
                {isEventListLoading ? (
                  <div className="flex justify-center rounded-2xl bg-[#fbf7f0] px-4 py-8"><ThemedLoader size="md" /></div>
                ) : eventListError ? (
                  <p className="rounded-2xl bg-[#fff0f0] px-4 py-5 text-center text-[0.78rem] leading-5 text-[#c90000]">{eventListError}</p>
                ) : eventListActivities.length > 0 ? (
                  <section className="space-y-2.5">
                    {eventListActivities.map((activity) => (
                      <article key={activity.id} className="rounded-[0.92rem] border border-white/80 bg-white/92 p-3 shadow-[0_8px_20px_rgba(75,48,20,0.05)]">
                        <div className="flex items-start justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block truncate text-[0.78rem] font-bold text-[#111111]">{activity.title}</span>
                            <span className="mt-1 flex items-center gap-1.5 text-[0.62rem] text-[#5f5751]"><CalendarIcon />{formatSheetDateTime(activity.starts_at)}</span>
                            <span className="mt-0.5 flex items-center gap-1.5 text-[0.62rem] text-[#5f5751]"><PinIcon />{activity.place || "-"}</span>
                          </span>
                        </div>
                        {activity.details ? <p className="mt-2 line-clamp-2 text-[0.64rem] leading-4 text-[#6a625e]">{activity.details}</p> : null}
                      </article>
                    ))}
                  </section>
                ) : (
                  <p className="rounded-[1rem] bg-white/88 px-4 py-8 text-center text-[0.72rem] leading-5 text-[#665d57]">No events found for this year.</p>
                )}
              </div>
              <div className="shrink-0 pt-3">
                <button type="button" onClick={() => closeSheet("eventlist")} className="w-full rounded-[0.9rem] border border-[#ead8c7] bg-[#fffdfb] px-4 py-3 text-[0.8rem] font-semibold text-[#111111] shadow-[0_8px_18px_rgba(75,48,20,0.04)]">Close</button>
              </div>
            </section>
          </div>
        ) : null}
        {isPaymentSheetOpen ? (
          <div className={`absolute inset-0 z-40 flex items-end bg-[#171717]/58 backdrop-blur-[1px] ${closingSheet === "payment" ? "member-sheet-backdrop-exit" : "member-sheet-backdrop-enter"}`}>
            <section className={`max-h-[82%] w-full overflow-hidden rounded-t-[1.35rem] bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_45px_rgba(0,0,0,0.24)] ${closingSheet === "payment" ? "member-sheet-panel-exit" : "member-sheet-panel-enter"}`}>
              <div className="mx-auto h-1 w-9 rounded-full bg-[#9b9b9b]" />
              <div className="mt-5 flex items-center justify-between">
                <button type="button" onClick={() => closeSheet("payment")} className="flex h-9 w-9 items-center justify-center text-[#111111]" aria-label="Close payment details">
                  <Icon className="h-7 w-7"><path d="M6 6 18 18M18 6 6 18" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" /></Icon>
                </button>
                <h2 className="min-w-0 flex-1 truncate px-2 text-center text-[1.05rem] font-bold tracking-[-0.035em]">Payment Details</h2>
                <span className="h-9 w-9" />
              </div>

              <div className="mt-5 max-h-[calc(82svh-7rem)] space-y-4 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <section className="overflow-hidden rounded-[1.15rem] bg-[linear-gradient(145deg,#1c4b8f,#123763)] p-5 shadow-[0_14px_30px_rgba(18,55,99,0.28)]">
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white">
                      <WalletIcon />
                    </span>
                    <span className="rounded-full bg-white/15 px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-white">Bank Transfer</span>
                  </div>
                  <div className="mt-5 text-[1.05rem] font-extrabold tracking-[-0.02em] text-white">Metrobank</div>
                  <div className="mt-4 space-y-3">
                    <div>
                      <div className="text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-white/60">Account Name</div>
                      <div className="mt-1 text-[0.8rem] font-bold leading-snug text-white">DATU LAPU-LAPU LODGE NO. 347 INC.</div>
                    </div>
                    <div>
                      <div className="text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-white/60">Account Number</div>
                      <div className="mt-1 font-mono text-[1.05rem] font-bold tracking-[0.08em] text-white">331-733-151-7956</div>
                    </div>
                  </div>
                </section>

                <section className="rounded-[1.05rem] border border-[#f2dfae] bg-[#fffaf0] px-4 py-4 shadow-[0_8px_20px_rgba(160,120,30,0.07)]">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fff1d4] text-[#c98200]">
                      <Icon className="h-5 w-5"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M12 7.5v5.2" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /><circle cx="12" cy="16.4" r="1" fill="currentColor" /></Icon>
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-[0.78rem] font-bold text-[#8a5d12]">Important Notice</h3>
                      <p className="mt-1.5 text-[0.72rem] leading-5 text-[#6f5a33]">
                        After paying your annual lodge dues, please send a copy of your payment receipt or proof of payment to the Lodge Secretary for proper recording. Thank you.
                      </p>
                    </div>
                  </div>
                </section>

                <button type="button" onClick={() => closeSheet("payment")} className="w-full rounded-[0.9rem] border border-[#ead8c7] bg-[#fffdfb] px-4 py-3 text-[0.8rem] font-semibold text-[#111111] shadow-[0_8px_18px_rgba(75,48,20,0.04)]">Close</button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
