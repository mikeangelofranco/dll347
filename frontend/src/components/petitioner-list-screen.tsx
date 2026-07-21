"use client";

import { type ReactNode, useEffect, useState } from "react";

import { PetitionerProfileSheet } from "@/components/petitioner-profile-sheet";
import { ThemedLoader } from "@/components/themed-loader";
import {
  getPetitionerList,
  getPetitionerProfile,
  type PetitionerFullProfile,
  type PetitionerListItem,
  type PetitionerStage,
} from "@/lib/api";

type NavigationItem = {
  id: string;
  label: string;
  icon: ReactNode;
};

type PetitionerListScreenProps = {
  initialStage: PetitionerStage;
  navigationItems: NavigationItem[];
  onBack: () => void;
  onNavigate: (itemId: string) => void;
};

const stageOptions: Array<{ key: PetitionerStage; label: string; color: string; tint: string; border: string }> = [
  { key: "fcm", label: "FCM", color: "#174b8b", tint: "#dbe8fb", border: "#8eb5e8" },
  { key: "eam", label: "EAM", color: "#315f9e", tint: "#e9f0fb", border: "#b8cce9" },
  { key: "balloted", label: "Balloted", color: "#315f9e", tint: "#e9f0fb", border: "#b8cce9" },
  { key: "re_apply", label: "Re-Apply", color: "#315f9e", tint: "#e9f0fb", border: "#b8cce9" },
  { key: "circulated", label: "Circulated", color: "#315f9e", tint: "#e9f0fb", border: "#b8cce9" },
  { key: "inactive", label: "Inactive", color: "#596273", tint: "#f5f7fa", border: "#c9d0da" },
];

function BackIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6"><path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" /></svg>;
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5"><circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" strokeWidth="1.9" /><path d="m15 15 4.5 4.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" /></svg>;
}

function ChevronIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5"><path d="m9 5.5 6 6.5-6 6.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" /></svg>;
}

function petitionerInitials(name: string): string {
  const cleanName = name.replace(/^(Mr\.|FCM|EAM)\s+/i, "").replace(/[+*]/g, "").trim();
  return cleanName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "P";
}

function petitionerDisplayName(name: string): string {
  return name.replace(/^(Mr\.|FCM|EAM)\s+/i, "").replace(/[+*]/g, "").trim();
}

export function PetitionerListScreen({ initialStage, navigationItems, onBack, onNavigate }: PetitionerListScreenProps) {
  const [activeStage, setActiveStage] = useState<PetitionerStage>(initialStage);
  const [search, setSearch] = useState("");
  const [petitioners, setPetitioners] = useState<PetitionerListItem[]>([]);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isClosing, setIsClosing] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<PetitionerFullProfile | null>(null);
  const [selectedProfileStage, setSelectedProfileStage] = useState<PetitionerStage | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    let isMounted = true;
    const debounce = window.setTimeout(() => {
      async function loadPetitioners() {
        setIsLoading(true);
        setError("");
        try {
          const response = await getPetitionerList(activeStage, search);
          if (isMounted) {
            setPetitioners(response.petitioners);
            setCount(response.count);
          }
        } catch (loadError) {
          if (isMounted) {
            setError(loadError instanceof Error ? loadError.message : "Unable to load petitioners.");
          }
        } finally {
          if (isMounted) {
            setIsLoading(false);
          }
        }
      }
      void loadPetitioners();
    }, 300);

    return () => {
      isMounted = false;
      window.clearTimeout(debounce);
    };
  }, [activeStage, search]);

  function closeScreen() {
    setIsClosing(true);
    window.setTimeout(onBack, 230);
  }

  async function openProfile(petitioner: PetitionerListItem) {
    setSelectedProfile(null);
    setSelectedProfileStage(petitioner.petitioner_stage);
    setProfileError("");
    setIsProfileLoading(true);
    try {
      setSelectedProfile(await getPetitionerProfile(petitioner.id));
    } catch (loadError) {
      setProfileError(loadError instanceof Error ? loadError.message : "Unable to load petitioner profile.");
    } finally {
      setIsProfileLoading(false);
    }
  }

  const activeStageDetails = stageOptions.find((stage) => stage.key === activeStage) ?? stageOptions[4];
  const isSearching = search.trim().length > 0;

  return (
    <main className={`member-dashboard-paper h-[100svh] overflow-hidden text-[#111111] ${isClosing ? "member-page-exit" : "member-page-enter"}`}>
      <div className="relative mx-auto flex h-full w-full max-w-[26rem] flex-col overflow-hidden border-x border-[#dfe7f2] bg-white/20 shadow-[0_0_35px_rgba(50,83,130,0.08)]">
        <header className="flex h-[4.4rem] shrink-0 items-center justify-between border-b border-[#dfe7f2]/80 bg-white/72 px-5 backdrop-blur-md">
          <button type="button" onClick={closeScreen} className="flex h-9 w-9 items-center justify-center text-[#1f2529]" aria-label="Back to dashboard"><BackIcon /></button>
          <h1 className="text-[1.05rem] font-bold tracking-[-0.035em]">Petitioners</h1>
          <span className="flex h-9 w-9 items-center justify-center text-[#315f9e]" aria-hidden="true"><SearchIcon /></span>
        </header>

        <div className="flex-1 overflow-y-auto px-3.5 pb-[5.6rem] pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex flex-wrap gap-2 pb-2">
            {stageOptions.map((stage) => {
              const isActive = stage.key === activeStage;
              return (
                <button
                  key={stage.key}
                  type="button"
                  onClick={() => { setActiveStage(stage.key); setPetitioners([]); setCount(0); setError(""); }}
                  className="rounded-full border px-3.5 py-1.5 text-[0.68rem] font-semibold transition-colors"
                  style={{ color: stage.color, borderColor: isActive ? stage.border : `${stage.border}99`, backgroundColor: isActive ? stage.tint : "rgba(255,255,255,0.58)" }}
                >
                  {stage.label}
                </button>
              );
            })}
          </div>

          <div className="mt-3 rounded-[1rem] border border-[#dfe7f2] bg-white/88 px-3.5 py-2.5 shadow-[0_8px_20px_rgba(50,83,130,0.04)]">
            <label className="flex items-center gap-2 text-[#6b7280]">
              <SearchIcon />
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search petitioner names" className="min-w-0 flex-1 bg-transparent text-[0.78rem] text-[#111111] outline-none placeholder:text-[#9aa9c1]" />
            </label>
          </div>

          <section className="mt-5 flex items-end justify-between gap-3 px-1">
            <div>
              <p className="text-[0.82rem] font-medium text-[#596273]">{isSearching ? "Search Results" : activeStageDetails.label}</p>
              <p className="mt-1 text-[1.25rem] font-bold leading-none">{isLoading ? <ThemedLoader size="sm" /> : count}</p>
            </div>
            <button type="button" className="rounded-full border border-[#dfe7f2] bg-white/78 px-4 py-2 text-[0.72rem] font-semibold text-[#596273] shadow-[0_8px_18px_rgba(50,83,130,0.06)]">Filter</button>
          </section>

          <section className="mt-4 space-y-2.5">
            {error ? (
              <p className="rounded-2xl bg-[#fff0f0] px-4 py-5 text-center text-[0.78rem] leading-5 text-[#c90000]">{error}</p>
            ) : isLoading ? (
              <div className="flex justify-center rounded-[1rem] bg-white/88 px-4 py-8 shadow-[0_8px_20px_rgba(50,83,130,0.04)]"><ThemedLoader size="md" /></div>
            ) : petitioners.length > 0 ? (
              petitioners.map((petitioner) => {
                const stage = stageOptions.find((option) => option.key === petitioner.petitioner_stage) ?? stageOptions[4];
                return (
                  <button key={petitioner.id} type="button" onClick={() => void openProfile(petitioner)} className="flex w-full items-center gap-2.5 rounded-[0.85rem] bg-white/90 px-2.5 py-2.5 text-left shadow-[0_8px_20px_rgba(50,83,130,0.055)] transition-transform active:scale-[0.99]">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(145deg,#5b8fd1,#315f9e)] text-[0.76rem] font-bold text-white shadow-[0_8px_16px_rgba(49,95,158,0.18)]">
                      {petitioner.profile_photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={petitioner.profile_photo_url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                      ) : petitionerInitials(petitioner.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.75rem] font-bold tracking-[-0.02em] text-[#111111]">{petitionerDisplayName(petitioner.name)}</span>
                      <span className="mt-1 inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[0.54rem] font-semibold leading-none" style={{ color: stage.color, backgroundColor: stage.tint }}>{stage.label}</span>
                    </span>
                    <span className="text-[#315f9e]"><ChevronIcon /></span>
                  </button>
                );
              })
            ) : (
              <p className="rounded-2xl bg-white/88 px-4 py-8 text-center text-[0.78rem] leading-5 text-[#665d57]">No petitioners found for this filter.</p>
            )}
          </section>
        </div>

        <nav className="absolute inset-x-0 bottom-0 z-20 rounded-t-[1.35rem] border border-[#dfe7f2] bg-white/95 px-3.5 pb-[max(0.55rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-7px_24px_rgba(50,83,130,0.07)] backdrop-blur-xl">
          <div className={`grid gap-1 ${navigationItems.length === 4 ? "grid-cols-4" : navigationItems.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
            {navigationItems.map((item) => (
              <button key={item.id} type="button" onClick={() => item.id === "dashboard" ? closeScreen() : onNavigate(item.id)} className={`flex flex-col items-center gap-1 ${item.id === "dashboard" ? "text-[#d00000]" : "text-[#716a66]"}`}>
                {item.icon}
                <span className="text-[0.55rem] font-medium sm:text-[0.62rem]">{item.label}</span>
                <span className={`h-[0.12rem] w-8 rounded-full ${item.id === "dashboard" ? "bg-[#d00000]" : "bg-transparent"}`} />
              </button>
            ))}
          </div>
        </nav>

        {(isProfileLoading || profileError || selectedProfile) ? (
          <PetitionerProfileSheet profile={selectedProfile} stage={selectedProfileStage} isLoading={isProfileLoading} error={profileError} onClose={() => { setSelectedProfile(null); setSelectedProfileStage(null); setProfileError(""); }} />
        ) : null}
      </div>
    </main>
  );
}
