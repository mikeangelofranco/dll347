"use client";

import Image from "next/image";
import { ChangeEvent, ReactNode, useEffect, useRef, useState } from "react";

import { ThemedLoader } from "@/components/themed-loader";
import { MemberProfileSheet } from "@/components/member-profile-sheet";
import { timeBasedGreeting } from "@/lib/greeting";
import { getMemberList, getMemberProfile, getMemberSummary, getMyMemberProfile, getMyPositionsHeld, getNextLodgeActivity, getUpcomingLodgeActivities, LodgeActivity, MemberDashboardProfile, MemberFullProfile, MemberGroupKey, MemberListItem, MemberPositionHeld, MemberSummaryGroup, uploadMemberProfilePhoto } from "@/lib/api";

type MemberDashboardScreenProps = {
  profile: MemberDashboardProfile | null;
  onLogout: () => Promise<void>;
  initialView?: "home" | "profile";
  initialTab?: MemberDashboardTab;
  onDashboardClose?: () => void;
  onProfileClose?: () => void;
};

type MemberDashboardTab = "dashboard" | "more";
type MemberDashboardView = "home" | "profile" | "members";
type MemberSheetName = "appendant" | "positions" | "activity";

type CropState = {
  zoom: number;
  x: number;
  y: number;
};

type CropImageMeta = {
  width: number;
  height: number;
};

type AppendantBodyItem = {
  key: string;
  name: string;
  subtitle: string;
  logoPath: string;
};

const calendarAddedStoragePrefix = "dll347-calendar-added-activity-";

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

function ShieldIcon() {
  return <Icon><path d="M12 3.5 18 6v5.4c0 4.1-2.4 7.2-6 9.1-3.6-1.9-6-5-6-9.1V6l6-2.5Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /><path d="M12 7v9" fill="none" stroke="currentColor" strokeWidth="1.5" /></Icon>;
}

function CalendarIcon({ plus = false }: { plus?: boolean }) {
  return <Icon><rect x="4" y="5.5" width="16" height="14.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M4 9.5h16M8 3.5v4M16 3.5v4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />{plus ? <path d="M12 12v5M9.5 14.5h5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /> : <path d="M8 13h2M13 13h2M8 16.5h2M13 16.5h2" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />}</Icon>;
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

function HomeIcon() {
  return <Icon className="h-5.5 w-5.5"><path d="m4 10.5 8-6.5 8 6.5v9a1.5 1.5 0 0 1-1.5 1.5h-4.2v-6.3H9.7V21H5.5A1.5 1.5 0 0 1 4 19.5v-9Z" fill="currentColor" /></Icon>;
}

function DotsIcon() {
  return <Icon className="h-5.5 w-5.5"><circle cx="5" cy="12" r="1.7" fill="currentColor" /><circle cx="12" cy="12" r="1.7" fill="currentColor" /><circle cx="19" cy="12" r="1.7" fill="currentColor" /></Icon>;
}

function SearchIcon() {
  return <Icon className="h-6 w-6"><circle cx="10.5" cy="10.5" r="6.2" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m15.2 15.2 4.3 4.3" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" /></Icon>;
}

function LodgeWatermark() {
  return (
    <svg viewBox="0 0 300 220" aria-hidden="true" className="absolute bottom-7 right-1 h-34 w-44 text-[#d58d00] opacity-[0.12] sm:h-40 sm:w-52">
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

const memberGroups: { key: MemberGroupKey; label: string; color: string; icon: ReactNode }[] = [
  { key: "active", label: "Active", color: "#17962a", icon: <PersonIcon group /> },
  { key: "dual_plural", label: "Dual / Plural", color: "#d68b00", icon: <PersonIcon group /> },
  { key: "honorary", label: "Honorary", color: "#1769ba", icon: <AwardIcon /> },
  { key: "inactive_snpd_demit", label: "Inactive /\nSNPD / Demit", color: "#cf0000", icon: <InactiveIcon /> },
  { key: "dropped_working_tools", label: "Dropped\nWorking Tools", color: "#6d6969", icon: <WorkingToolsIcon /> },
];

const memberListFilters: { key: MemberGroupKey; label: string; heading: string; color: string; tint: string; border: string }[] = [
  { key: "active", label: "Active", heading: "Active Members", color: "#009622", tint: "#f2fbf4", border: "#bfe8c7" },
  { key: "dual_plural", label: "Dual / Plural", heading: "Dual / Plural Members", color: "#d18400", tint: "#fff8ec", border: "#f0cd94" },
  { key: "honorary", label: "Honorary", heading: "Honorary Members", color: "#1769ba", tint: "#f1f8ff", border: "#bcd9ef" },
  { key: "inactive_snpd_demit", label: "Inactive / SNPD / Demit", heading: "Inactive / SNPD / Demit", color: "#d00000", tint: "#fff5f5", border: "#f0b8b8" },
  { key: "dropped_working_tools", label: "Dropped Working Tools", heading: "Dropped Working Tools", color: "#5f5a57", tint: "#f7f6f5", border: "#d8d2cc" },
];

const navItems = [
  { id: "dashboard" as const, label: "Dashboard", icon: <HomeIcon /> },
  { id: "more" as const, label: "More", icon: <DotsIcon /> },
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
  AAONMS: {
    name: "AAONMS",
    subtitle: "Appendant body / club",
    logoPath: "/branding/appendant-bodies/placeholder.svg",
  },
  GGOKCS: {
    name: "GGOKCS",
    subtitle: "Appendant body / club",
    logoPath: "/branding/appendant-bodies/placeholder.svg",
  },
  "PAK (TURTLE)": {
    name: "PAK (Turtle)",
    subtitle: "Appendant body / club",
    logoPath: "/branding/appendant-bodies/placeholder.svg",
  },
  OSM: {
    name: "OSM",
    subtitle: "Appendant body / club",
    logoPath: "/branding/appendant-bodies/placeholder.svg",
  },
  BIRTH: {
    name: "BIRTH",
    subtitle: "Appendant body / club",
    logoPath: "/branding/appendant-bodies/placeholder.svg",
  },
  BAGWIS: {
    name: "BAGWIS",
    subtitle: "Appendant body / club",
    logoPath: "/branding/appendant-bodies/bagwis.png",
  },
  "PNPA BEST": {
    name: "PNPA BEST",
    subtitle: "Appendant body / club",
    logoPath: "/branding/appendant-bodies/placeholder.svg",
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function minimumLoadingDelay(ms = 250): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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
  if (normalized.includes("INACTIVE, SNPD, DEMIT") || normalized.includes("NOT ACTIVE")) {
    return "inactive_snpd_demit";
  }
  if (normalized.includes("DUAL") || normalized.includes("PLURAL")) {
    return "dual_plural";
  }
  if (normalized.includes("HONORARY")) {
    return "honorary";
  }
  return "active";
}

function memberGroupDetails(group: MemberGroupKey) {
  return memberListFilters.find((filter) => filter.key === group) ?? memberListFilters[0];
}

function memberGroupIcon(group: MemberGroupKey) {
  const details = memberGroups.find((item) => item.key === group);
  return details?.icon ?? <PersonIcon group />;
}

export function MemberDashboardScreen({
  profile,
  onLogout,
  initialView = "home",
  initialTab = "dashboard",
  onDashboardClose,
  onProfileClose,
}: MemberDashboardScreenProps) {
  const isProfileOnly = initialView === "profile";
  const usesSecretaryNav = onDashboardClose !== undefined || onProfileClose !== undefined;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeView, setActiveView] = useState<MemberDashboardView>(initialView);
  const [isProfileViewClosing, setIsProfileViewClosing] = useState(false);
  const [isMembersViewClosing, setIsMembersViewClosing] = useState(false);
  const [uploadedProfile, setUploadedProfile] = useState<MemberDashboardProfile | null>(null);
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
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [isAppendantSheetOpen, setIsAppendantSheetOpen] = useState(false);
  const [isPositionsSheetOpen, setIsPositionsSheetOpen] = useState(false);
  const [closingSheet, setClosingSheet] = useState<MemberSheetName | null>(null);
  const [positionsHeld, setPositionsHeld] = useState<MemberPositionHeld[] | null>(null);
  const [isPositionsLoading, setIsPositionsLoading] = useState(false);
  const [positionsError, setPositionsError] = useState("");

  const currentProfile = uploadedProfile ?? profile;

  useEffect(() => {
    return () => {
      if (selectedPhotoUrl !== null) {
        URL.revokeObjectURL(selectedPhotoUrl);
      }
    };
  }, [selectedPhotoUrl]);

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
    if (!isProfileOnly || currentProfile === null || fullProfile !== null || isProfileLoading) {
      return;
    }

    void openFullProfile();
  }, [currentProfile, fullProfile, isProfileLoading, isProfileOnly]);

  useEffect(() => {
    if (activeView !== "members") {
      return;
    }

    let isMounted = true;
    const debounce = window.setTimeout(() => {
      async function loadMembers() {
        setIsMemberListLoading(true);
        setMemberListError("");
        try {
          const [response] = await Promise.all([
            getMemberList(activeMemberFilter, memberSearch),
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
  }, [activeView, activeMemberFilter, memberSearch]);

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

  async function saveProfilePhoto() {
    if (selectedPhotoUrl === null) {
      setPhotoError("Please choose a photo first.");
      return;
    }

    setIsUploadingPhoto(true);
    setPhotoError("");
    try {
      const croppedPhoto = await createCroppedProfilePhotoBlob(selectedPhotoUrl, crop);
      const [response] = await Promise.all([
        uploadMemberProfilePhoto(croppedPhoto),
        minimumLoadingDelay(),
      ]);
      setUploadedProfile(response.member_profile);
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
    try {
      const [profileData] = await Promise.all([
        getMyMemberProfile(),
        minimumLoadingDelay(),
      ]);
      setFullProfile(profileData);
      setIsProfileViewClosing(false);
      setActiveView("profile");
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

  if (currentProfile === null) {
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

  if (activeView === "members") {
    const activeFilter = memberListFilters.find((filter) => filter.key === activeMemberFilter) ?? memberListFilters[0];
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
              {memberListFilters.map((filter) => {
                const isActive = filter.key === activeMemberFilter;
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
                  const group = memberGroupFromSection(member.section);
                  const groupDetails = memberGroupDetails(group);
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
                          <span className="flex h-3.5 w-3.5 items-center justify-center">{memberGroupIcon(group)}</span>
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
            <div className="grid grid-cols-2 gap-1">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button key={item.label} type="button" onClick={() => closeMembersList(item.id)} className={`flex flex-col items-center gap-1 ${isActive ? "text-[#d00000]" : "text-[#716a66]"}`}>
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
            />
          ) : null}
        </div>
      </main>
    );
  }

  if (activeView === "profile" && fullProfile !== null) {
    const profileRows = [
      ["GLP ID", displayValue(fullProfile.glp_id_number)],
      ["Member since", formatDate(fullProfile.member_since)],
      ["Status", fullProfile.status],
      ["Lodge", "Datu Lapu-Lapu Lodge No. 347"],
      ["Grand Lodge", "Grand Lodge of the Philippines"],
      ["Birthdate", formatDate(fullProfile.date_of_birth)],
      ["Email", displayValue(fullProfile.email)],
      ["Phone", displayValue(fullProfile.telephone)],
      ["Address", displayValue(fullProfile.address)],
    ];
    const additionalRows = [
      ["Blood Type", displayValue(fullProfile.blood_type)],
      ["Widow / Sister", displayValue(fullProfile.widow_or_sister)],
      ["Proficiency", formatDate(fullProfile.proficiency_date)],
    ];
    const appendantItems = appendantBodyItems(fullProfile.appendant_bodies ?? {});
    const appendantCount = appendantItems.length;
    const displayedPositions = positionsHeld ?? fullProfile.positions_held ?? [];
    const positionsCount = displayedPositions.length;

    return (
      <main className={`member-dashboard-paper h-[100svh] overflow-hidden text-[#111111] ${isProfileViewClosing ? "member-page-exit" : "member-page-enter"}`}>
        <div className="relative mx-auto flex h-full w-full max-w-[26rem] flex-col overflow-hidden border-x border-[#eee7dd] bg-white/20 shadow-[0_0_35px_rgba(87,55,19,0.08)]">
          <header className="flex h-[4.4rem] shrink-0 items-center justify-between border-b border-[#eee7dd]/70 bg-white/72 px-5 backdrop-blur-md">
            <button type="button" onClick={() => closeFullProfile()} className="flex h-9 w-9 items-center justify-center text-[#1f2529]" aria-label="Back to dashboard">
              <Icon className="h-6 w-6"><path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" /></Icon>
            </button>
            <h1 className="text-[0.98rem] font-bold tracking-[-0.03em]">Member Profile</h1>
            <span className="h-9 w-9" />
          </header>

          <div className="flex-1 overflow-y-auto px-3.5 pb-[5.6rem] pt-3.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                    <img src={fullProfile.profile_photo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <PersonIcon />
                  )}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <h2 className="text-[1.38rem] font-bold leading-none tracking-[-0.05em]">{profileDisplayName(fullProfile.name)}</h2>
                  <div className="mt-2 w-fit rounded-full bg-[linear-gradient(145deg,#eba51a,#c97b00)] px-3 py-1 text-[0.68rem] font-semibold text-white shadow-[0_6px_12px_rgba(205,133,0,0.2)]">{fullProfile.lodge_standing}</div>
                  <div className="mt-3 flex items-center gap-2 text-[0.72rem] font-medium text-[#2d2824]"><span className="h-2.5 w-2.5 rounded-full bg-[#06b834]" />{fullProfile.status}</div>
                  <div className="mt-1.5 flex items-center gap-2 text-[0.68rem] font-medium text-[#4c4540]"><span className="h-1.5 w-1.5 rounded-full bg-[#3c444a]" />Datu Lapu-Lapu Lodge No. 347</div>
                </div>
              </div>
            </section>

            <section className="mt-4 rounded-[1rem] border border-white/80 bg-white/88 px-3.5 py-2 shadow-[0_10px_24px_rgba(74,48,19,0.06)]">
              {profileRows.map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-4 border-b border-[#e9e1d8] py-2.5 last:border-b-0">
                  <span className="text-[0.74rem] text-[#59524d]">{label}</span>
                  <span className={`max-w-[58%] text-right text-[0.74rem] leading-snug ${label === "Status" ? "font-medium text-[#009622]" : "text-[#111111]"}`}>{value}</span>
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
            </section>

            <section className="mt-3 rounded-[1rem] border border-white/80 bg-white/88 px-3.5 py-3 shadow-[0_10px_24px_rgba(74,48,19,0.06)]">
              <h3 className="text-[0.78rem] font-bold">Additional Information</h3>
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
              <h3 className="text-[0.78rem] font-bold">Lodge Involvement</h3>
              <button type="button" onClick={openAppendantSheet} className="flex w-full items-center justify-between border-b border-[#e9e1d8] py-2.5 text-left">
                <span className="flex items-center gap-2 text-[0.74rem] text-[#423c37]"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#fff4e3] text-[#d58d00]"><AwardIcon /></span>Appendant Bodies</span>
                <span className="flex items-center gap-2 text-[0.74rem] text-[#111111]">{appendantCount}<ChevronIcon /></span>
              </button>
              <button type="button" onClick={() => void openPositionsSheet()} className="flex w-full items-center justify-between py-2.5 text-left">
                <span className="flex items-center gap-2 text-[0.74rem] text-[#423c37]"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#fff4e3] text-[#d58d00]"><AwardIcon /></span>Positions Held</span>
                <span className="flex items-center gap-2 text-[0.74rem] text-[#111111]">{isPositionsLoading ? <ThemedLoader size="sm" /> : positionsCount}<ChevronIcon /></span>
              </button>
            </section>

            <section className="mt-3 rounded-[1rem] border border-white/80 bg-white/88 p-3.5 shadow-[0_10px_24px_rgba(74,48,19,0.06)]">
              <h3 className="text-[0.78rem] font-bold">Activity Summary</h3>
              <div className="mt-3 grid grid-cols-3 divide-x divide-[#e9e1d8]">
                <div className="px-2"><div className="text-[0.58rem] text-[#5f5751]">Attendance</div><div className="mt-2 text-[1rem] font-bold">{fullProfile.attendance_this_year}</div><div className="text-[0.58rem] text-[#5f5751]">meetings this year</div></div>
                <div className="px-2"><div className="text-[0.58rem] text-[#5f5751]">Dues Status</div><div className="mt-2 text-[0.8rem] font-bold text-[#7a716b]">{fullProfile.dues_status}</div><div className="text-[0.58rem] text-[#5f5751]">status</div></div>
                <div className="px-2"><div className="text-[0.58rem] text-[#5f5751]">Years</div><div className="mt-2 text-[1rem] font-bold">{fullProfile.years_of_membership ?? "-"}</div><div className="text-[0.58rem] text-[#5f5751]">membership</div></div>
              </div>
            </section>
          </div>

          <nav className="absolute inset-x-0 bottom-0 z-20 rounded-t-[1.35rem] border border-[#eee8e1] bg-white/95 px-3.5 pb-[max(0.55rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-7px_24px_rgba(75,48,20,0.07)] backdrop-blur-xl">
            <div className={`grid gap-1 ${usesSecretaryNav ? "grid-cols-3" : "grid-cols-2"}`}>
              {(usesSecretaryNav
                ? [
                    { id: "dashboard" as const, label: "Dashboard", icon: <HomeIcon /> },
                    { id: "profile" as const, label: "My Profile", icon: <PersonIcon /> },
                    { id: "more" as const, label: "More", icon: <DotsIcon /> },
                  ]
                : navItems
              ).map((item) => {
                const isActive = usesSecretaryNav ? item.id === "profile" : activeTab === item.id;
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
                        } else {
                          setActiveView("home");
                          setActiveTab("more");
                        }
                        return;
                      }
                      closeFullProfile(item.id === "more" ? "more" : "dashboard");
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
                  <h2 className="text-[1.05rem] font-bold tracking-[-0.035em]">Appendant Bodies / Club</h2>
                  <span className="h-9 w-9" />
                </div>
                <div className="mt-4 max-h-[calc(72svh-6rem)] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {appendantItems.length > 0 ? (
                    appendantItems.map((item) => (
                      <button key={item.key} type="button" className="flex w-full items-center gap-3 border-b border-[#eadfd3] py-3 text-left last:border-b-0">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#fbf7f0]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={item.logoPath} alt="" className="h-full w-full object-contain" />
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
                    displayedPositions.map((position) => (
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
          {activeTab === "dashboard" ? (
            <>
          <section className="rounded-[1.25rem] border border-white/80 bg-white/88 p-3.5 shadow-[0_12px_30px_rgba(74,48,19,0.08)] sm:rounded-[1.45rem] sm:p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(145deg,#eda600,#c77900)] text-white shadow-[0_8px_20px_rgba(205,133,0,0.22)] sm:h-12 sm:w-12">
                  {currentProfile.profile_photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentProfile.profile_photo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <PersonIcon />
                  )}
                </div>
                <div>
                  <div className="text-[0.68rem] font-semibold text-[#cc8300] sm:text-xs">My Lodge Standing</div>
                  <h2 className="mt-1 text-[1.1rem] font-bold leading-none tracking-[-0.04em] sm:text-[1.25rem]">{currentProfile.lodge_standing}</h2>
                </div>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eef8f0] text-[#168129] sm:h-10 sm:w-10"><CheckIcon /></div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-1.5 sm:mt-5 sm:gap-3">
              <div className="flex gap-1 text-[#d48a00]"><ShieldIcon /><div><div className="text-[0.62rem] text-[#282421] sm:text-[0.68rem]">Status</div><div className="mt-0.5 text-[0.6rem] font-medium text-[#08a83b] sm:text-[0.66rem]">{currentProfile.status}</div></div></div>
              <div className="flex gap-1 text-[#d48a00]"><CalendarIcon /><div><div className="text-[0.62rem] text-[#282421] sm:text-[0.68rem]">Dues</div><div className="mt-0.5 text-[0.6rem] font-medium text-[#7a716b] sm:text-[0.66rem]">{currentProfile.dues_status}</div></div></div>
              <div className="flex gap-1 text-[#d48a00]"><PersonIcon group /><div><div className="text-[0.62rem] text-[#282421] sm:text-[0.68rem]">Attendance</div><div className="mt-0.5 text-[0.6rem] leading-snug text-[#3f3935] sm:text-[0.66rem]">{currentProfile.attendance_this_year} meetings this year</div></div></div>
            </div>

            <button type="button" disabled={isProfileLoading} onClick={() => void openFullProfile()} className="mt-4 flex w-full items-center justify-between rounded-[0.9rem] bg-[#fbf8f3] px-3.5 py-2.5 text-left text-[0.68rem] font-medium shadow-[inset_0_0_0_1px_rgba(238,228,214,0.35)] disabled:opacity-75 sm:mt-5 sm:px-4 sm:py-3 sm:text-xs">
              <span>{formatMemberSince(currentProfile.member_since)}</span><span className="text-[#67615d]">{isProfileLoading ? <ThemedLoader size="sm" /> : <ChevronIcon />}</span>
            </button>
            {profileError ? <p className="mt-3 rounded-xl bg-[#fff0f0] px-3 py-2 text-[0.68rem] text-[#c90000]">{profileError}</p> : null}
          </section>

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
                  <button type="button" disabled={calendarAddedActivityId === nextActivity.id} onClick={() => handleAddActivityToCalendar(nextActivity)} className={`flex w-fit items-center justify-center gap-1 whitespace-nowrap rounded-[0.8rem] border px-4 py-2 text-[10px] font-semibold ${calendarAddedActivityId === nextActivity.id ? "border-[#cfe7d5] bg-[#f0fbf2] text-[#13802a]" : "border-[#d40000] bg-white/65 text-[#d00000]"}`}><CalendarIcon plus /><span>{calendarAddedActivityId === nextActivity.id ? "Added to Calendar" : "Add to Calendar"}</span></button>
                </div>
              </>
            ) : isNextActivityLoading ? null : (
              <p className="relative z-10 mt-4 text-[0.68rem] leading-5 text-[#655e59] sm:text-xs">Please check back soon for the next lodge schedule.</p>
            )}
            {nextActivityError ? <p className="relative z-10 mt-3 rounded-xl bg-[#fff0f0] px-3 py-2 text-[0.68rem] text-[#c90000]">{nextActivityError}</p> : null}
          </section>

          <section className="rounded-[1.25rem] border border-white/80 bg-white/88 p-3.5 shadow-[0_12px_30px_rgba(74,48,19,0.08)] sm:rounded-[1.45rem] sm:p-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(145deg,#eda600,#c77900)] text-white shadow-[0_8px_20px_rgba(205,133,0,0.2)] sm:h-12 sm:w-12"><PersonIcon group /></div>
              <h2 className="text-base font-semibold text-[#c98200] sm:text-lg">Members</h2>
            </div>
            <div className="mt-3.5 grid grid-cols-4 gap-1.5 min-[400px]:grid-cols-5 sm:gap-2.5">
              {memberGroups.map((group) => {
                const summaryGroup = memberSummaryGroups?.find((item) => item.key === group.key);
                const value = summaryGroup?.count;
                return (
                  <button key={group.label} type="button" onClick={() => openMembersList(group.key)} className="flex min-h-[6.5rem] flex-col items-center rounded-[0.85rem] border border-[#f2ebe3] bg-[#fffdfb] px-1 py-2.5 text-center shadow-[0_5px_14px_rgba(75,48,20,0.03)] sm:min-h-[7.25rem] sm:px-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full text-white sm:h-9 sm:w-9" style={{ backgroundColor: group.color }}>{group.icon}</span>
                    <span className="mt-1.5 min-h-7 whitespace-pre-line text-[0.55rem] font-medium leading-[1.22] sm:text-[0.62rem]" style={{ color: group.color }}>{group.label}</span>
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
            </>
          ) : (
            <section className="rounded-[1.25rem] border border-white/80 bg-white/90 p-4 shadow-[0_12px_30px_rgba(74,48,19,0.08)] sm:rounded-[1.45rem] sm:p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f7efe5] text-[#d58d00] shadow-[inset_0_0_0_1px_rgba(220,171,91,0.18)]">
                  {currentProfile.profile_photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentProfile.profile_photo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <CameraIcon />
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold tracking-[-0.03em] text-[#111111]">More</h2>
                  <p className="mt-0.5 text-[0.68rem] leading-snug text-[#655e59] sm:text-xs">Manage your member profile preferences.</p>
                </div>
              </div>

              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoSelected} />

              <button type="button" onClick={openPhotoSelector} className="mt-4 flex w-full items-center justify-between rounded-[1rem] border border-[#f0e5d7] bg-[#fffdfb] p-3 text-left shadow-[0_8px_20px_rgba(75,48,20,0.04)]">
                <span className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d40000] text-white"><CameraIcon /></span>
                  <span>
                    <span className="block text-xs font-semibold text-[#111111]">Upload profile photo</span>
                    <span className="mt-0.5 block text-[0.62rem] text-[#706760]">Choose, crop, and save your display photo.</span>
                  </span>
                </span>
                <span className="text-[#77716d]"><ChevronIcon /></span>
              </button>

              {photoError ? <p className="mt-3 rounded-xl bg-[#fff0f0] px-3 py-2 text-[0.68rem] text-[#c90000]">{photoError}</p> : null}
            </section>
          )}
        </div>

        <nav className="absolute inset-x-0 bottom-0 z-20 rounded-t-[1.35rem] border border-[#eee8e1] bg-white/95 px-3.5 pb-[max(0.55rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-7px_24px_rgba(75,48,20,0.07)] backdrop-blur-xl">
          <div className={`grid gap-1 ${usesSecretaryNav ? "grid-cols-3" : "grid-cols-2"}`}>
            {(usesSecretaryNav
              ? [
                  { id: "dashboard" as const, label: "Dashboard", icon: <HomeIcon /> },
                  { id: "profile" as const, label: "My Profile", icon: <PersonIcon /> },
                  { id: "more" as const, label: "More", icon: <DotsIcon /> },
                ]
              : navItems
            ).map((item) => {
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
                      } else {
                        setActiveView("home");
                        setActiveTab("more");
                      }
                      return;
                    }
                    setActiveTab(item.id === "more" ? "more" : "dashboard");
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

        {isPhotoModalOpen ? (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#1b130c]/45 px-4 backdrop-blur-sm">
            <section className="w-full max-w-[22rem] rounded-[1.6rem] border border-white/80 bg-[#fffdfb] p-4 text-center shadow-[0_22px_60px_rgba(42,24,8,0.22)]">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#d40000] text-white shadow-[0_8px_18px_rgba(208,0,0,0.2)]"><CameraIcon /></div>
              <h2 className="mt-3 text-lg font-bold tracking-[-0.04em]">Crop profile photo</h2>
              <p className="mt-1 text-[0.68rem] leading-5 text-[#655e59]">Move and zoom the photo until it looks right inside the circle.</p>

              <div className="mx-auto mt-4 h-52 w-52 overflow-hidden rounded-full border-[6px] border-[#f5ecdf] bg-[#f8f1e8] shadow-[inset_0_0_0_1px_rgba(215,188,151,0.35)]">
                {selectedPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedPhotoUrl}
                    alt=""
                    className="block select-none"
                    style={getCropPreviewStyle(cropImageMeta, crop)}
                  />
                ) : null}
              </div>

              <div className="mt-4 space-y-3 text-left">
                <label className="block text-[0.65rem] font-semibold text-[#4b413b]">
                  Zoom
                  <input type="range" min="1" max="3" step="0.05" value={crop.zoom} onChange={(event) => setCrop((current) => ({ ...current, zoom: Number(event.target.value) }))} className="mt-2 w-full accent-[#d40000]" />
                </label>
                <label className="block text-[0.65rem] font-semibold text-[#4b413b]">
                  Move left / right
                  <input type="range" min="-100" max="100" step="1" value={crop.x} onChange={(event) => setCrop((current) => ({ ...current, x: Number(event.target.value) }))} className="mt-2 w-full accent-[#d40000]" />
                </label>
                <label className="block text-[0.65rem] font-semibold text-[#4b413b]">
                  Move up / down
                  <input type="range" min="-100" max="100" step="1" value={crop.y} onChange={(event) => setCrop((current) => ({ ...current, y: Number(event.target.value) }))} className="mt-2 w-full accent-[#d40000]" />
                </label>
              </div>

              {photoError ? <p className="mt-3 rounded-xl bg-[#fff0f0] px-3 py-2 text-[0.68rem] text-[#c90000]">{photoError}</p> : null}

              <div className="mt-5 grid grid-cols-2 gap-2">
                <button type="button" disabled={isUploadingPhoto} onClick={() => setIsPhotoModalOpen(false)} className="rounded-full border border-[#ead8c7] px-4 py-2 text-xs font-semibold text-[#6f625a] disabled:opacity-60">Cancel</button>
                <button type="button" disabled={isUploadingPhoto} onClick={() => void saveProfilePhoto()} className="flex items-center justify-center rounded-full bg-[#d40000] px-4 py-2 text-xs font-semibold text-white shadow-[0_8px_18px_rgba(208,0,0,0.18)] disabled:opacity-70">{isUploadingPhoto ? <ThemedLoader size="sm" /> : "Save photo"}</button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
