"use client";

import { useState } from "react";
import { ThemedLoader } from "@/components/themed-loader";
import { LodgeActivity, updateLodgeActivity } from "@/lib/api";

type EditActivityModalProps = {
  isOpen: boolean;
  activity: LodgeActivity | null;
  onClose: () => void;
  onSuccess: (updatedActivity: LodgeActivity) => void;
};

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <path d="M6 6 18 18M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <rect x="3.5" y="4.5" width="17" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 2.5v4M16 2.5v4M3.5 9.5h17" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function ClockIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.5v5l3.3 2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function format12HourTime(hours: number, minutes: number): string {
  const period = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`;
}

function parseToInitialValues(activity: LodgeActivity) {
  const d = new Date(activity.starts_at);
  const isValidDate = !Number.isNaN(d.getTime());
  const year = isValidDate ? d.getFullYear() : 2026;
  const month = isValidDate ? d.getMonth() + 1 : 1;
  const day = isValidDate ? d.getDate() : 1;
  const hours = isValidDate ? d.getHours() : 6;
  const minutes = isValidDate ? d.getMinutes() : 0;

  const dateIso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const dateDisplay = `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}/${year}`;
  const time24 = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  const timeDisplay = format12HourTime(hours, minutes);

  return {
    title: activity.title || "",
    details: activity.details || "",
    place: activity.place || "",
    dateIso,
    dateDisplay,
    time24,
    timeDisplay,
  };
}

function EditActivityModalForm({
  activity,
  onClose,
  onSuccess,
}: {
  activity: LodgeActivity;
  onClose: () => void;
  onSuccess: (updatedActivity: LodgeActivity) => void;
}) {
  const [initialValues] = useState(() => parseToInitialValues(activity));
  const [title, setTitle] = useState(initialValues.title);
  const [details, setDetails] = useState(initialValues.details);
  const [place, setPlace] = useState(initialValues.place);
  const [dateIso, setDateIso] = useState(initialValues.dateIso);
  const [dateDisplay, setDateDisplay] = useState(initialValues.dateDisplay);
  const [time24, setTime24] = useState(initialValues.time24);
  const [timeDisplay, setTimeDisplay] = useState(initialValues.timeDisplay);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isClosing, setIsClosing] = useState(false);

  function handleDateChange(isoValue: string) {
    if (!isoValue) return;
    setDateIso(isoValue);
    const [y, m, d] = isoValue.split("-");
    if (y && m && d) {
      setDateDisplay(`${m}/${d}/${y}`);
    }
    setErrorMessage("");
  }

  function handleTimeChange(timeVal: string) {
    if (!timeVal) return;
    setTime24(timeVal);
    const [h, m] = timeVal.split(":").map(Number);
    if (!Number.isNaN(h) && !Number.isNaN(m)) {
      setTimeDisplay(format12HourTime(h, m));
    }
    setErrorMessage("");
  }

  function handleClose() {
    if (isSaving) return;
    setIsClosing(true);
    window.setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 180);
  }

  const hasChanges =
    title.trim() !== initialValues.title.trim() ||
    details.trim() !== initialValues.details.trim() ||
    place.trim() !== initialValues.place.trim() ||
    dateIso !== initialValues.dateIso ||
    time24 !== initialValues.time24;

  const isFormComplete =
    title.trim().length > 0 &&
    details.trim().length > 0 &&
    place.trim().length > 0 &&
    Boolean(dateIso) &&
    Boolean(time24);

  const canSave = hasChanges && isFormComplete && !isSaving;

  async function handleSave() {
    if (!canSave) {
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      const [year, month, day] = dateIso.split("-").map(Number);
      const [hour, min] = time24.split(":").map(Number);
      const combinedDate = new Date(year, month - 1, day, hour, min);
      if (Number.isNaN(combinedDate.getTime())) {
        throw new Error("Invalid date or time selected.");
      }

      const startsAtIso = combinedDate.toISOString();

      const [response] = await Promise.all([
        updateLodgeActivity(activity.id, {
          title: title.trim(),
          details: details.trim(),
          place: place.trim(),
          starts_at: startsAtIso,
        }),
        new Promise((resolve) => window.setTimeout(resolve, 250)),
      ]);

      onSuccess(response.activity);
      setIsClosing(true);
      window.setTimeout(() => {
        setIsClosing(false);
        onClose();
      }, 180);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unable to save activity changes.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-[#171717]/65 backdrop-blur-[2px] ${
        isClosing ? "member-sheet-backdrop-exit" : "member-sheet-backdrop-enter"
      }`}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-activity-title"
        className={`w-full max-w-[26rem] mx-auto rounded-t-[1.35rem] sm:rounded-[1.35rem] bg-white px-5 pb-[max(1.2rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_45px_rgba(0,0,0,0.28)] ${
          isClosing ? "member-sheet-panel-exit" : "member-sheet-panel-enter"
        }`}
      >
        {/* Drag pill handle */}
        <div className="mx-auto h-1 w-9 rounded-full bg-[#9b9b9b]" />

        {/* Top bar */}
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#111111] transition-colors hover:bg-neutral-100 disabled:opacity-50 cursor-pointer"
            aria-label="Close edit activity"
          >
            <CloseIcon />
          </button>
          <h2
            id="edit-activity-title"
            className="min-w-0 flex-1 truncate px-2 text-center text-[1.05rem] font-bold tracking-[-0.035em] text-[#111111]"
          >
            Edit activity
          </h2>
          <span className="h-9 w-9" />
        </div>

        {/* Subheader */}
        <div className="mt-3">
          <p className="text-[0.76rem] text-[#6c6460]">
            All fields are required.
          </p>
        </div>

        {/* Form fields */}
        <div className="mt-4 space-y-3.5 max-h-[calc(78svh-7rem)] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pr-0.5">
          {/* Title */}
          <div>
            <label
              htmlFor="edit-title-input"
              className="block text-[0.78rem] font-medium text-[#423c37] mb-1.5"
            >
              Title
            </label>
            <input
              id="edit-title-input"
              type="text"
              value={title}
              disabled={isSaving}
              maxLength={100}
              onChange={(e) => {
                setTitle(e.target.value);
                setErrorMessage("");
              }}
              placeholder="Enter activity title"
              className="w-full rounded-[0.75rem] border border-[#d5cbbf] bg-white px-3.5 py-2.5 text-[0.82rem] font-medium text-[#111111] outline-none transition-colors focus:border-[#c08200] focus:ring-1 focus:ring-[#c08200] disabled:bg-neutral-100"
            />
          </div>

          {/* Details */}
          <div>
            <label
              htmlFor="edit-details-input"
              className="block text-[0.78rem] font-medium text-[#423c37] mb-1.5"
            >
              Details
            </label>
            <textarea
              id="edit-details-input"
              rows={3}
              value={details}
              disabled={isSaving}
              onChange={(e) => {
                setDetails(e.target.value);
                setErrorMessage("");
              }}
              placeholder="Enter activity details"
              className="w-full rounded-[0.75rem] border border-[#d5cbbf] bg-white p-3 text-[0.82rem] leading-5 text-[#111111] outline-none transition-colors resize-none focus:border-[#c08200] focus:ring-1 focus:ring-[#c08200] disabled:bg-neutral-100"
            />
          </div>

          {/* Starts at */}
          <div>
            <label className="block text-[0.78rem] font-medium text-[#423c37] mb-1.5">
              Starts at
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="block text-[0.72rem] font-medium text-[#6c6460] mb-1">
                  Date
                </span>
                <label className="relative flex h-11 items-center justify-between rounded-[0.75rem] border border-[#d5cbbf] bg-white px-3 text-[#111111] cursor-pointer hover:border-[#b8aba0] transition-colors">
                  <span
                    className={`text-[0.82rem] font-medium ${
                      dateDisplay ? "text-[#111111]" : "text-[#9a928b]"
                    }`}
                  >
                    {dateDisplay || "MM/DD/YYYY"}
                  </span>
                  <CalendarIcon className="h-4 w-4 text-[#6c6460] shrink-0" />
                  <input
                    type="date"
                    value={dateIso}
                    disabled={isSaving}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    aria-label="Select start date"
                  />
                </label>
              </div>
              <div>
                <span className="block text-[0.72rem] font-medium text-[#6c6460] mb-1">
                  Time
                </span>
                <label className="relative flex h-11 items-center justify-between rounded-[0.75rem] border border-[#d5cbbf] bg-white px-3 text-[#111111] cursor-pointer hover:border-[#b8aba0] transition-colors">
                  <span
                    className={`text-[0.82rem] font-medium ${
                      timeDisplay ? "text-[#111111]" : "text-[#9a928b]"
                    }`}
                  >
                    {timeDisplay || "HH:MM AM"}
                  </span>
                  <ClockIcon className="h-4 w-4 text-[#6c6460] shrink-0" />
                  <input
                    type="time"
                    value={time24}
                    disabled={isSaving}
                    onChange={(e) => handleTimeChange(e.target.value)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    aria-label="Select start time"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Place */}
          <div>
            <label
              htmlFor="edit-place-input"
              className="block text-[0.78rem] font-medium text-[#423c37] mb-1.5"
            >
              Place
            </label>
            <input
              id="edit-place-input"
              type="text"
              value={place}
              disabled={isSaving}
              onChange={(e) => {
                setPlace(e.target.value);
                setErrorMessage("");
              }}
              placeholder="Enter activity location"
              className="w-full rounded-[0.75rem] border border-[#d5cbbf] bg-white px-3.5 py-2.5 text-[0.82rem] text-[#111111] outline-none transition-colors focus:border-[#c08200] focus:ring-1 focus:ring-[#c08200] disabled:bg-neutral-100"
            />
          </div>

          {/* Divider */}
          <div className="border-t border-[#eadfd3] pt-3">
            {/* Status / helper row */}
            <div className="mb-3 text-[0.76rem] min-h-[1.2rem]">
              {errorMessage ? (
                <span className="text-[#c90000] font-medium">{errorMessage}</span>
              ) : !hasChanges ? (
                <span className="text-[#716a66]">No changes yet</span>
              ) : !isFormComplete ? (
                <span className="text-[#c90000] font-medium">All fields are required.</span>
              ) : null}
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSaving}
                className="w-full rounded-[0.85rem] border border-[#ead8c7] bg-[#fffdfb] py-3 text-[0.82rem] font-semibold text-[#111111] transition-all hover:bg-[#fbf7f0] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={!canSave}
                className={`w-full rounded-[0.85rem] py-3 text-[0.82rem] font-semibold transition-all flex items-center justify-center gap-2 ${
                  canSave
                    ? "bg-[#18130f] hover:bg-[#2e2620] text-white shadow-md active:scale-[0.98] cursor-pointer"
                    : "bg-[#c5bbb0] text-white/90 cursor-not-allowed"
                }`}
              >
                {isSaving ? (
                  <>
                    <ThemedLoader size="sm" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save changes</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export function EditActivityModal({
  isOpen,
  activity,
  onClose,
  onSuccess,
}: EditActivityModalProps) {
  if (!isOpen || !activity) {
    return null;
  }

  return (
    <EditActivityModalForm
      key={`${activity.id}-${activity.starts_at}-${activity.title}`}
      activity={activity}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}
