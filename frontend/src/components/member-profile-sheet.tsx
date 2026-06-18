"use client";

import { type ReactNode } from "react";

import { MemberFullProfile } from "@/lib/api";

type MemberProfileSheetProps = {
  profile: MemberFullProfile | null;
  isLoading: boolean;
  error: string;
  onClose: () => void;
};

const appendantBodyDetails: Record<string, { name: string; logoPath: string }> = {
  "A&ASR": {
    name: "A&ASR",
    logoPath: "/branding/appendant-bodies/aasr.png",
  },
  "YORK RITE": {
    name: "York Rite",
    logoPath: "/branding/appendant-bodies/york-rite.png",
  },
  BAGWIS: {
    name: "BAGWIS",
    logoPath: "/branding/appendant-bodies/bagwis.png",
  },
};

function Icon({ children, className = "h-5 w-5" }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      {children}
    </svg>
  );
}

function CloseIcon() {
  return <Icon className="h-7 w-7"><path d="M6 6 18 18M18 6 6 18" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" /></Icon>;
}

function PersonIcon() {
  return <Icon className="h-10 w-10"><circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M5.5 19a6.5 6.5 0 0 1 13 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" /></Icon>;
}

function CheckIcon() {
  return <Icon className="h-4 w-4"><path d="m5 12 4 4 10-10" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" /></Icon>;
}

function AwardIcon() {
  return <Icon className="h-5 w-5"><circle cx="12" cy="9" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="m8.5 13-1 7 4.5-2.5 4.5 2.5-1-7" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" /></Icon>;
}

function displayValue(value: string | null | undefined): string {
  return value && value.trim() ? value : "-";
}

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function profileDisplayName(fullName: string): string {
  const cleanName = fullName.replace(/^(Mr\.|Bro\.|FCM|EAM)\s+/i, "").replace(/[+*]/g, "").trim();
  if (!cleanName.includes(",")) {
    return cleanName || "Member";
  }
  const [lastName, restName] = cleanName.split(",");
  const firstName = restName?.trim().split(/\s+/)[0] || "Member";
  return `${firstName} ${lastName.trim()}`;
}

function appendantBodyLabel(rawKey: string): string {
  return rawKey.split("/").at(-1)?.trim() || rawKey.trim();
}

function appendantBodyItem(rawKey: string): { key: string; name: string; logoPath: string } {
  const label = appendantBodyLabel(rawKey);
  const details = appendantBodyDetails[label.toUpperCase()];
  return {
    key: rawKey,
    name: details?.name ?? label,
    logoPath: details?.logoPath ?? "/branding/appendant-bodies/placeholder.svg",
  };
}

function appendantCellHasValue(value: unknown): boolean {
  if (value === null || value === undefined || value === "") {
    return false;
  }
  if (typeof value === "object" && "value" in value) {
    const cellValue = (value as { value?: unknown }).value;
    return cellValue !== null && cellValue !== undefined && cellValue !== "";
  }
  return true;
}

export function MemberProfileSheet({ profile, isLoading, error, onClose }: MemberProfileSheetProps) {
  const profileRows = profile
    ? [
        ["GLP ID", displayValue(profile.glp_id_number)],
        ["Member since", formatDate(profile.member_since)],
        ["Status", profile.status],
        ["Lodge", "Datu Lapu-Lapu Lodge No. 347"],
        ["Grand Lodge", "Grand Lodge of the Philippines"],
        ["Birthdate", formatDate(profile.date_of_birth)],
        ["Email", displayValue(profile.email)],
        ["Phone", displayValue(profile.telephone)],
        ["Address", displayValue(profile.address)],
      ]
    : [];
  const additionalRows = profile
    ? [
        ["Blood Type", displayValue(profile.blood_type)],
        ["Widow / Sister", displayValue(profile.widow_or_sister)],
        ["Proficiency", formatDate(profile.proficiency_date)],
      ]
    : [];
  const appendantItems = profile
    ? Object.entries(profile.appendant_bodies ?? {})
        .filter(([, value]) => appendantCellHasValue(value))
        .map(([key]) => appendantBodyItem(key))
    : [];

  return (
    <div className="absolute inset-0 z-50 flex items-end bg-[#171717]/48 backdrop-blur-[1px] member-sheet-backdrop-enter">
      <section className="max-h-[88%] w-full overflow-hidden rounded-t-[1.25rem] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_45px_rgba(0,0,0,0.22)] member-sheet-panel-enter">
        <div className="mx-auto h-1 w-9 rounded-full bg-[#9b9b9b]" />
        <div className="mt-4 flex items-center justify-between">
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center text-[#111111]" aria-label="Close member profile">
            <CloseIcon />
          </button>
          <h2 className="text-[1rem] font-bold tracking-[-0.035em]">Member Profile</h2>
          <span className="h-9 w-9" />
        </div>

        <div className="mt-3 max-h-[calc(88svh-5rem)] overflow-y-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {isLoading ? (
            <div className="flex justify-center rounded-2xl bg-[#fbf7f0] px-4 py-10 text-[#d58d00]">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#efd6aa] border-t-[#d58d00]" />
            </div>
          ) : error ? (
            <p className="rounded-2xl bg-[#fff0f0] px-4 py-5 text-center text-[0.78rem] leading-5 text-[#c90000]">{error}</p>
          ) : profile ? (
            <>
              <section className="relative overflow-hidden rounded-b-[1.2rem] px-1 py-3">
                <div className="relative z-10 flex items-center gap-4">
                  <div className="relative flex h-[5.9rem] w-[5.9rem] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f8efe3] text-[#d58d00] shadow-[0_10px_24px_rgba(74,48,19,0.12)] ring-4 ring-white/75">
                    {profile.profile_photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profile.profile_photo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <PersonIcon />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <h3 className="text-[1.24rem] font-bold leading-none tracking-[-0.05em]">{profileDisplayName(profile.name)}</h3>
                    <div className="mt-2 w-fit rounded-full bg-[linear-gradient(145deg,#eba51a,#c97b00)] px-3 py-1 text-[0.64rem] font-semibold text-white shadow-[0_6px_12px_rgba(205,133,0,0.2)]">{profile.lodge_standing}</div>
                    <div className="mt-3 flex items-center gap-2 text-[0.7rem] font-medium text-[#2d2824]"><span className="h-2.5 w-2.5 rounded-full bg-[#06b834]" />{profile.status}</div>
                    <div className="mt-1.5 flex items-center gap-2 text-[0.66rem] font-medium text-[#4c4540]"><span className="h-1.5 w-1.5 rounded-full bg-[#3c444a]" />Datu Lapu-Lapu Lodge No. 347</div>
                  </div>
                </div>
              </section>

              <section className="mt-3 rounded-[1rem] border border-white/80 bg-white/88 px-3.5 py-2 shadow-[0_10px_24px_rgba(74,48,19,0.06)]">
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
                    ["Initiated", profile.initiation_date],
                    ["Passed", profile.passing_date],
                    ["Raised", profile.raising_date],
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
                <div className="border-b border-[#eadfd3] py-2.5">
                  <div className="flex items-center gap-2 text-[0.74rem] text-[#423c37]"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#fff4e3] text-[#d58d00]"><AwardIcon /></span>Appendant Bodies</div>
                  <div className="mt-2 overflow-hidden rounded-[0.9rem] border border-[#f0e7dc] bg-[#fffdfb]">
                    {appendantItems.length > 0 ? appendantItems.map((item) => (
                      <div key={item.key} className="flex items-center gap-3 border-b border-[#eee4d8] px-3 py-2.5 text-[0.74rem] text-[#111111] last:border-b-0">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#fbf7f0] shadow-[inset_0_0_0_1px_rgba(213,141,0,0.08)]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={item.logoPath} alt="" className="h-full w-full object-contain" />
                        </span>
                        <span className="font-semibold tracking-[-0.015em]">{item.name}</span>
                      </div>
                    )) : <div className="text-[0.72rem] text-[#6a625c]">-</div>}
                  </div>
                </div>
                <div className="py-2.5">
                  <div className="flex items-center gap-2 text-[0.74rem] text-[#423c37]"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#fff4e3] text-[#d58d00]"><AwardIcon /></span>Positions Held</div>
                  <div className="mt-2 overflow-hidden rounded-[0.9rem] border border-[#f0e7dc] bg-[#fffdfb]">
                    {profile.positions_held.length > 0 ? profile.positions_held.map((position) => (
                      <div key={position.id} className="flex items-start justify-between gap-3 border-b border-[#eee4d8] px-3 py-2.5 last:border-b-0">
                        <span className="min-w-0">
                          <span className="block text-[0.74rem] font-semibold tracking-[-0.015em] text-[#111111]">{position.title}</span>
                          {position.notes ? <span className="mt-1 block text-[0.64rem] leading-4 text-[#6a625c]">{position.notes}</span> : null}
                        </span>
                        <span className="shrink-0 rounded-full bg-[#fbf4ea] px-2.5 py-1 text-right text-[0.62rem] font-medium text-[#8a5d12]">{position.date_range || "-"}</span>
                      </div>
                    )) : <div className="text-[0.72rem] text-[#6a625c]">-</div>}
                  </div>
                </div>
              </section>

              <section className="mt-3 rounded-[1rem] border border-white/80 bg-white/88 p-3.5 shadow-[0_10px_24px_rgba(74,48,19,0.06)]">
                <h3 className="text-[0.78rem] font-bold">Activity Summary</h3>
                <div className="mt-3 grid grid-cols-3 divide-x divide-[#e9e1d8]">
                  <div className="px-2"><div className="text-[0.58rem] text-[#5f5751]">Attendance</div><div className="mt-2 text-[1rem] font-bold">{profile.attendance_this_year}</div><div className="text-[0.58rem] text-[#5f5751]">meetings this year</div></div>
                  <div className="px-2"><div className="text-[0.58rem] text-[#5f5751]">Dues Status</div><div className="mt-2 text-[0.8rem] font-bold text-[#7a716b]">{profile.dues_status}</div><div className="text-[0.58rem] text-[#5f5751]">status</div></div>
                  <div className="px-2"><div className="text-[0.58rem] text-[#5f5751]">Years</div><div className="mt-2 text-[1rem] font-bold">{profile.years_of_membership ?? "-"}</div><div className="text-[0.58rem] text-[#5f5751]">membership</div></div>
                </div>
              </section>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
