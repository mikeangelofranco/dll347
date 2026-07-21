import type { ReactNode } from "react";

import type { PetitionerStage, SecretaryDashboardSummaryResponse } from "@/lib/api";

type PetitionerSummary = SecretaryDashboardSummaryResponse["petitioner"];

type PetitionerTile = {
  key: PetitionerStage;
  label: string;
  icon: ReactNode;
  strong?: boolean;
  muted?: boolean;
};

function PersonIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="h-5.5 w-5.5">
      <circle cx="16" cy="9.5" r="5" fill="none" stroke="currentColor" strokeWidth="2.1" />
      <path d="M7.7 27c.7-7 3.4-10.5 8.3-10.5S23.6 20 24.3 27" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.1" />
    </svg>
  );
}

function BallotedIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="h-5.5 w-5.5">
      <defs>
        <linearGradient id="balloted-blue" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4f8ce1" />
          <stop offset="1" stopColor="#1552ad" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="5.2" r="3.4" fill="url(#balloted-blue)" stroke="#1552ad" strokeWidth="0.65" />
      <circle cx="11" cy="10.7" r="3.4" fill="#f8fbff" stroke="#c7d6f2" strokeWidth="0.65" />
      <circle cx="21" cy="10.7" r="3.4" fill="#f8fbff" stroke="#c7d6f2" strokeWidth="0.65" />
      <circle cx="6" cy="16.2" r="3.4" fill="url(#balloted-blue)" stroke="#1552ad" strokeWidth="0.65" />
      <circle cx="16" cy="16.2" r="3.4" fill="url(#balloted-blue)" stroke="#1552ad" strokeWidth="0.65" />
      <circle cx="26" cy="16.2" r="3.4" fill="url(#balloted-blue)" stroke="#1552ad" strokeWidth="0.65" />
      <circle cx="11" cy="21.7" r="3.4" fill="#f8fbff" stroke="#c7d6f2" strokeWidth="0.65" />
      <circle cx="21" cy="21.7" r="3.4" fill="#f8fbff" stroke="#c7d6f2" strokeWidth="0.65" />
      <circle cx="16" cy="27" r="3.4" fill="url(#balloted-blue)" stroke="#1552ad" strokeWidth="0.65" />
    </svg>
  );
}

function ReApplyIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="h-5.5 w-5.5">
      <path d="M25.5 12A10.5 10.5 0 0 0 7.2 8.8L4.5 12" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
      <path d="M4.5 6.5V12H10" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
      <path d="M6.5 20A10.5 10.5 0 0 0 24.8 23.2l2.7-3.2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
      <path d="M27.5 25.5V20H22" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="h-5.5 w-5.5">
      <path d="M8 4.5h10l6 6V27H8z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2.1" />
      <path d="M18 4.5V11h6M12 16h8m-8 4h8" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
      <path d="m7.5 4.5 5 5.5-5 5.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

const petitionerTiles: PetitionerTile[] = [
  { key: "fcm", label: "FCM", icon: <PersonIcon />, strong: true },
  { key: "eam", label: "EAM", icon: <PersonIcon /> },
  { key: "balloted", label: "Balloted", icon: <BallotedIcon /> },
  { key: "re_apply", label: "Re-Apply", icon: <ReApplyIcon /> },
  { key: "circulated", label: "Circulated", icon: <DocumentIcon /> },
  { key: "inactive", label: "Inactive", icon: <PersonIcon />, muted: true },
];

export function PetitionerDashboardCard({ summary, onSelect }: { summary: PetitionerSummary; onSelect: (stage: PetitionerStage) => void }) {
  return (
    <section className="rounded-[1.25rem] border border-[#dfe7f2] bg-white/88 p-3.5 shadow-[0_12px_30px_rgba(50,83,130,0.07)] backdrop-blur-[10px] sm:rounded-[1.45rem] sm:p-4">
      <div className="flex items-center gap-2.5 text-[#315f9e]">
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#c7d6f2] bg-[#f5f7fa]">
          <PersonIcon />
        </span>
        <h2 className="text-[0.92rem] font-extrabold tracking-[-0.04em]">Petitioner</h2>
      </div>

      <div className="mt-3.5 grid grid-cols-4 gap-1.5 min-[400px]:grid-cols-5">
        {petitionerTiles.map((tile) => (
          <button
            key={tile.key}
            type="button"
            onClick={() => onSelect(tile.key)}
            aria-label={`View ${tile.label} petitioners, ${summary[tile.key]}`}
            className="flex min-h-[6.5rem] cursor-pointer flex-col items-center rounded-[0.85rem] border border-[#cddced] bg-[#fdfefe] px-1 py-2.5 text-center shadow-[0_7px_16px_rgba(49,95,158,0.09)] transition-all hover:-translate-y-0.5 hover:border-[#9fbce0] hover:shadow-[0_10px_20px_rgba(49,95,158,0.14)] active:scale-95 active:bg-[#f5f9ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b8fd1] focus-visible:ring-offset-2"
          >
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tile.muted ? "bg-[#f5f7fa] text-[#6b7280]" : tile.strong ? "bg-[#dbe8fb] text-[#1f62b4]" : "bg-[#e9f0fb] text-[#3972bb]"}`}>
              {tile.icon}
            </span>
            <span className={`mt-1.5 min-h-7 text-[0.55rem] font-medium leading-[1.22] ${tile.muted ? "text-[#596273]" : tile.strong ? "text-[#174b8b]" : "text-[#234f8d]"}`}>
              {tile.label}
            </span>
            <span className="relative mt-auto text-base font-bold leading-none text-[#111827]">
              {summary[tile.key]}
              <span className="absolute left-full top-1/2 -translate-y-1/2 text-[#6b7280]"><ChevronIcon /></span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
