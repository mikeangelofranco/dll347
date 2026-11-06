"use client";

import { useRef, useState } from "react";

import { MemberDashboardProfile, MemberFullProfile } from "@/lib/api";

type StandingSummaryCardProps = {
  profile: MemberDashboardProfile | MemberFullProfile;
  className?: string;
};

function CheckIcon({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="m4.5 12 3.5 3.5 7-7.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.3"
      />
    </svg>
  );
}

function ChevronLeftIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M15 18l-6-6 6-6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
    </svg>
  );
}

function ChevronRightIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M9 18l6-6-6-6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
    </svg>
  );
}

export function StandingSummaryCard({ profile, className = "" }: StandingSummaryCardProps) {
  // 0 = Current Year, 1 = Previous Year
  const [slideIndex, setSlideIndex] = useState<0 | 1>(0);
  const [prevProfileId, setPrevProfileId] = useState(profile.id);

  // Reset to current year (index 0) whenever profile changes
  if (profile.id !== prevProfileId) {
    setPrevProfileId(profile.id);
    setSlideIndex(0);
  }

  // Touch tracking for swipe gestures
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const currentYear = profile.current_year ?? new Date().getFullYear();
  const previousYear = profile.previous_year ?? currentYear - 1;

  // Current year values
  const currentThreeRule = Boolean(profile.three_meetings_rule);
  const currentSixRule = Boolean(profile.six_meetings_rule);
  const currentThreeAttendance = profile.attendance_this_year ?? 0;
  const currentSixAttendance = profile.six_meeting_attendance ?? profile.attendance_this_year ?? 0;
  const currentDuesStatus = profile.dues_status || `Unpaid ${currentYear}`;
  const currentDuesPaid = currentDuesStatus.startsWith("Paid");

  // Previous year values
  const prevThreeRule = Boolean(profile.three_meetings_rule_previous_year);
  const prevSixRule = Boolean(profile.six_meetings_rule_previous_year);
  const prevThreeAttendance = profile.attendance_previous_year ?? 0;
  const prevSixAttendance = profile.six_meeting_attendance_previous_year ?? profile.attendance_previous_year ?? 0;
  const prevDuesStatus = profile.dues_status_previous_year || `Unpaid ${previousYear}`;
  const prevDuesPaid = prevDuesStatus.startsWith("Paid");

  // Proficiency milestone is consistent
  const hasProficiency = Boolean(profile.proficiency_date);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    // Only swipe if horizontal movement is dominant and exceeds threshold
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 35) {
      if (deltaX < 0) {
        // Swipe left -> go to previous year
        setSlideIndex(1);
      } else {
        // Swipe right -> go to current year
        setSlideIndex(0);
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  return (
    <section
      className={`mt-3 select-none rounded-[1rem] border border-white/80 bg-white/88 p-3.5 shadow-[0_10px_24px_rgba(74,48,19,0.06)] overflow-hidden ${className}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header with Title and Year Switcher / Carousel Controls */}
      <div className="flex items-center justify-between">
        <h3 className="text-[0.78rem] font-bold text-[#111111] transition-colors duration-200">
          {slideIndex === 0 ? "Standing Summary" : `Previous Year (${previousYear})`}
        </h3>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSlideIndex(0)}
            disabled={slideIndex === 0}
            className={`flex h-6 w-6 items-center justify-center rounded-full text-[#5e554d] transition-opacity ${
              slideIndex === 0 ? "opacity-25 cursor-default" : "hover:bg-[#f6eee3] active:scale-95"
            }`}
            aria-label="Current year standing"
          >
            <ChevronLeftIcon />
          </button>

          {/* Indicator Dots */}
          <div className="flex items-center gap-1 px-0.5">
            <button
              type="button"
              onClick={() => setSlideIndex(0)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                slideIndex === 0 ? "w-4 bg-[#231e19]" : "w-1.5 bg-[#dfd6cb] hover:bg-[#c9bea7]"
              }`}
              aria-label="View current year standing"
            />
            <button
              type="button"
              onClick={() => setSlideIndex(1)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                slideIndex === 1 ? "w-4 bg-[#231e19]" : "w-1.5 bg-[#dfd6cb] hover:bg-[#c9bea7]"
              }`}
              aria-label="View previous year standing"
            />
          </div>

          <button
            type="button"
            onClick={() => setSlideIndex(1)}
            disabled={slideIndex === 1}
            className={`flex h-6 w-6 items-center justify-center rounded-full text-[#5e554d] transition-opacity ${
              slideIndex === 1 ? "opacity-25 cursor-default" : "hover:bg-[#f6eee3] active:scale-95"
            }`}
            aria-label="Previous year standing"
          >
            <ChevronRightIcon />
          </button>
        </div>
      </div>

      {/* Swipeable Carousel Content */}
      <div className="relative mt-3 overflow-hidden">
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: slideIndex === 0 ? "translateX(0%)" : "translateX(-100%)" }}
        >
          {/* Slide 0: Current Year */}
          <div className="w-full shrink-0">
            <div className="grid grid-cols-4 divide-x divide-[#e9e1d8]">
              {/* 3 Meeting Rule */}
              <div className="px-1.5 text-center">
                <span
                  className={`mx-auto flex h-5 w-5 items-center justify-center rounded-full transition-colors ${
                    currentThreeRule ? "bg-[#168129] text-white" : "bg-[#d9d0c7] text-white"
                  }`}
                >
                  {currentThreeRule ? <CheckIcon /> : <span className="text-[0.48rem] font-bold">—</span>}
                </span>
                <div className="mt-1 text-[0.52rem] font-bold text-[#3a342f]">3 Meeting Rule</div>
                <div
                  className={`text-[0.46rem] font-semibold ${
                    currentThreeRule ? "text-[#147622]" : "text-[#90887e]"
                  }`}
                >
                  {currentThreeAttendance} Meeting
                </div>
              </div>

              {/* 6 Meeting Rule */}
              <div className="px-1.5 text-center">
                <span
                  className={`mx-auto flex h-5 w-5 items-center justify-center rounded-full transition-colors ${
                    currentSixRule ? "bg-[#168129] text-white" : "bg-[#d9d0c7] text-white"
                  }`}
                >
                  {currentSixRule ? <CheckIcon /> : <span className="text-[0.48rem] font-bold">—</span>}
                </span>
                <div className="mt-1 text-[0.52rem] font-bold text-[#3a342f]">6 Meeting Rule</div>
                <div
                  className={`text-[0.46rem] font-semibold ${
                    currentSixRule ? "text-[#147622]" : "text-[#90887e]"
                  }`}
                >
                  {currentSixAttendance} Meeting
                </div>
              </div>

              {/* Dues */}
              <div className="px-1.5 text-center">
                <span
                  className={`mx-auto flex h-5 w-5 items-center justify-center rounded-full transition-colors ${
                    currentDuesPaid ? "bg-[#168129] text-white" : "bg-[#d9d0c7] text-white"
                  }`}
                >
                  {currentDuesPaid ? <CheckIcon /> : <span className="text-[0.48rem] font-bold">—</span>}
                </span>
                <div className="mt-1 text-[0.52rem] font-bold text-[#3a342f]">Dues</div>
                <div
                  className={`text-[0.48rem] font-semibold truncate ${
                    currentDuesPaid ? "text-[#147622]" : "text-[#938b83]"
                  }`}
                >
                  {currentDuesStatus}
                </div>
              </div>

              {/* Proficiency */}
              <div className="px-1.5 text-center">
                <span
                  className={`mx-auto flex h-5 w-5 items-center justify-center rounded-full transition-colors ${
                    hasProficiency ? "bg-[#168129] text-white" : "bg-[#d9d0c7] text-white"
                  }`}
                >
                  {hasProficiency ? <CheckIcon /> : <span className="text-[0.48rem] font-bold">—</span>}
                </span>
                <div className="mt-1 text-[0.52rem] font-bold text-[#3a342f]">Proficiency</div>
              </div>
            </div>
          </div>

          {/* Slide 1: Previous Year */}
          <div className="w-full shrink-0">
            <div className="grid grid-cols-4 divide-x divide-[#e9e1d8]">
              {/* 3 Meeting Rule (Previous Year) */}
              <div className="px-1.5 text-center">
                <span
                  className={`mx-auto flex h-5 w-5 items-center justify-center rounded-full transition-colors ${
                    prevThreeRule ? "bg-[#168129] text-white" : "bg-[#d9d0c7] text-white"
                  }`}
                >
                  {prevThreeRule ? <CheckIcon /> : <span className="text-[0.48rem] font-bold">—</span>}
                </span>
                <div className="mt-1 text-[0.52rem] font-bold text-[#3a342f]">3 Meeting Rule</div>
                <div
                  className={`text-[0.46rem] font-semibold ${
                    prevThreeRule ? "text-[#147622]" : "text-[#90887e]"
                  }`}
                >
                  {prevThreeAttendance} Meeting
                </div>
              </div>

              {/* 6 Meeting Rule (Previous Year) */}
              <div className="px-1.5 text-center">
                <span
                  className={`mx-auto flex h-5 w-5 items-center justify-center rounded-full transition-colors ${
                    prevSixRule ? "bg-[#168129] text-white" : "bg-[#d9d0c7] text-white"
                  }`}
                >
                  {prevSixRule ? <CheckIcon /> : <span className="text-[0.48rem] font-bold">—</span>}
                </span>
                <div className="mt-1 text-[0.52rem] font-bold text-[#3a342f]">6 Meeting Rule</div>
                <div
                  className={`text-[0.46rem] font-semibold ${
                    prevSixRule ? "text-[#147622]" : "text-[#90887e]"
                  }`}
                >
                  {prevSixAttendance} Meeting
                </div>
              </div>

              {/* Dues (Previous Year) */}
              <div className="px-1.5 text-center">
                <span
                  className={`mx-auto flex h-5 w-5 items-center justify-center rounded-full transition-colors ${
                    prevDuesPaid ? "bg-[#168129] text-white" : "bg-[#d9d0c7] text-white"
                  }`}
                >
                  {prevDuesPaid ? <CheckIcon /> : <span className="text-[0.48rem] font-bold">—</span>}
                </span>
                <div className="mt-1 text-[0.52rem] font-bold text-[#3a342f]">Dues</div>
                <div
                  className={`text-[0.48rem] font-semibold truncate ${
                    prevDuesPaid ? "text-[#147622]" : "text-[#938b83]"
                  }`}
                >
                  {prevDuesStatus}
                </div>
              </div>

              {/* Proficiency (Consistent Milestone) */}
              <div className="px-1.5 text-center">
                <span
                  className={`mx-auto flex h-5 w-5 items-center justify-center rounded-full transition-colors ${
                    hasProficiency ? "bg-[#168129] text-white" : "bg-[#d9d0c7] text-white"
                  }`}
                >
                  {hasProficiency ? <CheckIcon /> : <span className="text-[0.48rem] font-bold">—</span>}
                </span>
                <div className="mt-1 text-[0.52rem] font-bold text-[#3a342f]">Proficiency</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
