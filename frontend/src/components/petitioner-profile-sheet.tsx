"use client";

import { ThemedLoader } from "@/components/themed-loader";
import type { PetitionerFullProfile, PetitionerStage } from "@/lib/api";

type PetitionerProfileSheetProps = {
  profile: PetitionerFullProfile | null;
  stage: PetitionerStage | null;
  isLoading: boolean;
  error: string;
  onClose: () => void;
};

const stageDetails: Record<PetitionerStage, { label: string; color: string; background: string }> = {
  fcm: { label: "FCM", color: "#174b8b", background: "#dbe8fb" },
  eam: { label: "EAM", color: "#315f9e", background: "#e9f0fb" },
  balloted: { label: "Balloted", color: "#315f9e", background: "#e9f0fb" },
  re_apply: { label: "Re-Apply", color: "#315f9e", background: "#e9f0fb" },
  circulated: { label: "Circulated", color: "#315f9e", background: "#e9f0fb" },
  inactive: { label: "Inactive", color: "#596273", background: "#f5f7fa" },
};

function CloseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7"><path d="M6 6 18 18M18 6 6 18" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" /></svg>;
}

function PersonIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-10 w-10"><circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M5.5 19a6.5 6.5 0 0 1 13 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" /></svg>;
}

function displayValue(value: string | null | undefined): string {
  return value && value.trim() ? value.trim() : "–";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "–";
  try {
    return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric" }).format(new Date(value));
  } catch {
    return "–";
  }
}

function petitionerDisplayName(name: string): string {
  return name.replace(/^(Mr\.|FCM|EAM)\s+/i, "").replace(/[+*]/g, "").trim();
}

export function PetitionerProfileSheet({ profile, stage, isLoading, error, onClose }: PetitionerProfileSheetProps) {
  const classification = stage ? stageDetails[stage] : null;
  const personalInformation = profile ? [
    ["Birthday", formatDate(profile.date_of_birth)],
    ["Address", displayValue(profile.address)],
    ["Phone", displayValue(profile.telephone)],
    ["Email", displayValue(profile.email)],
    ["Blood Type", displayValue(profile.blood_type)],
    ["Wife", displayValue(profile.widow_or_sister)],
  ] : [];

  const membershipTimeline = profile ? [
    ["Date Presented", formatDate(profile.date_presented)],
    ["Date Balloted", formatDate(profile.date_balloted)],
    ["Initiated", formatDate(profile.initiation_date)],
    ["Passed", formatDate(profile.passing_date)],
  ] : [];

  return (
    <div className="absolute inset-0 z-50 flex items-end bg-[#171717]/48 backdrop-blur-[1px] member-sheet-backdrop-enter">
      <section className="max-h-[88%] w-full overflow-hidden rounded-t-[1.25rem] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_45px_rgba(0,0,0,0.22)] member-sheet-panel-enter">
        <div className="mx-auto h-1 w-9 rounded-full bg-[#9aa9c1]" />
        <div className="mt-4 flex items-center justify-between">
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center text-[#111111]" aria-label="Close petitioner profile"><CloseIcon /></button>
          <h2 className="text-[1rem] font-bold tracking-[-0.035em]">Petitioner Profile</h2>
          <span className="h-9 w-9" />
        </div>

        <div className="mt-3 max-h-[calc(88svh-5rem)] overflow-y-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {isLoading ? (
            <div className="flex justify-center rounded-2xl bg-[#f5f7fa] px-4 py-10 text-[#315f9e]"><ThemedLoader size="md" /></div>
          ) : error ? (
            <p className="rounded-2xl bg-[#fff0f0] px-4 py-5 text-center text-[0.78rem] leading-5 text-[#c90000]">{error}</p>
          ) : profile ? (
            <>
              <section className="relative overflow-hidden rounded-[1.1rem] border border-[#dfe7f2] bg-[#f9fbfe] px-3.5 py-4 shadow-[0_10px_24px_rgba(50,83,130,0.07)]">
                <div className="flex items-center gap-4">
                  <div className="flex h-[5.6rem] w-[5.6rem] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e9f0fb] text-[#315f9e] shadow-[0_10px_24px_rgba(50,83,130,0.12)] ring-4 ring-white/80">
                    {profile.profile_photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profile.profile_photo_url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                    ) : <PersonIcon />}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <h3 className="text-[1.2rem] font-bold leading-tight tracking-[-0.045em]">{petitionerDisplayName(profile.name)}</h3>
                    {classification ? (
                      <div className="mt-2 w-fit rounded-full px-3 py-1 text-[0.64rem] font-semibold" style={{ color: classification.color, backgroundColor: classification.background }}>
                        {classification.label}
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="mt-3 rounded-[1rem] border border-[#dfe7f2] bg-white/90 px-3.5 py-3 shadow-[0_10px_24px_rgba(50,83,130,0.06)]">
                <h3 className="text-[0.78rem] font-bold text-[#234f8d]">Personal Information</h3>
                <div className="mt-2">
                  {personalInformation.map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-4 border-b border-[#e3eaf3] py-2.5 last:border-b-0">
                      <span className="text-[0.74rem] text-[#596273]">{label}</span>
                      <span className="max-w-[58%] text-right text-[0.74rem] leading-snug text-[#111111]">{value}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-3 rounded-[1rem] border border-[#dfe7f2] bg-white/90 px-3.5 py-3 shadow-[0_10px_24px_rgba(50,83,130,0.06)]">
                <h3 className="text-[0.78rem] font-bold text-[#234f8d]">Membership Timeline</h3>
                <div className="mt-2">
                  {membershipTimeline.map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-4 border-b border-[#e3eaf3] py-2.5 last:border-b-0">
                      <span className="text-[0.74rem] text-[#596273]">{label}</span>
                      <span className="max-w-[58%] text-right text-[0.74rem] leading-snug text-[#111111]">{value}</span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
