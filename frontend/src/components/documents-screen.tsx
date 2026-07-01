"use client";

import Image from "next/image";
import { ChangeEvent, DragEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";

import {
  ApiError,
  LodgeDocument,
  LodgeDocumentCategory,
  LodgeDocumentUploadResult,
  deleteLodgeDocument,
  getLodgeDocuments,
  uploadLodgeDocuments,
} from "@/lib/api";
import { timeBasedGreeting } from "@/lib/greeting";
import { ThemedLoader } from "@/components/themed-loader";

type DocumentsScreenProps = {
  onLogout: () => Promise<void>;
  onNavigate: (view: "home" | "profile" | "documents" | "more") => void;
  onMembersDataUploaded?: () => Promise<void> | void;
};

type DocumentYearFilter = "all" | "others" | string;

const categories: { value: LodgeDocumentCategory; label: string; tokens: string[] }[] = [
  { value: "treasurers_report", label: "Treasurers Report", tokens: ["treasurer", "report"] },
  { value: "minutes_stated_meeting", label: "Minutes of the Stated Meeting", tokens: ["minutes", "stated"] },
  { value: "minutes_special_meeting", label: "Minutes of the Special Meeting", tokens: ["minutes", "special"] },
  { value: "members_data", label: "Members Data", tokens: ["member"] },
];

const documentAllowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const workbookAllowedTypes = new Set(["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"]);
const maxFileBytes = 20 * 1024 * 1024;
const uploadBatchSize = 1;
const listPageSize = 15;
const monthAliases: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

function minimumLoadingDelay(ms = 250): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function Icon({ children, className = "h-6 w-6" }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      {children}
    </svg>
  );
}

function HomeIcon() {
  return <Icon className="h-5.5 w-5.5"><path d="m4.2 10.5 7.8-6.3 7.8 6.3v9.1a1.2 1.2 0 0 1-1.2 1.2h-4.4v-6.2H9.8v6.2H5.4a1.2 1.2 0 0 1-1.2-1.2v-9.1Z" fill="currentColor" /></Icon>;
}

function ProfileIcon() {
  return <Icon className="h-5.5 w-5.5"><circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M5.5 19a6.5 6.5 0 0 1 13 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" /></Icon>;
}

function FolderIcon({ upload = false }: { upload?: boolean }) {
  return (
    <Icon className={upload ? "h-8 w-8" : "h-5.5 w-5.5"}>
      <path d="M3.5 7.4A2.4 2.4 0 0 1 5.9 5h4.2l2 2.2h6A2.4 2.4 0 0 1 20.5 9.6v7A2.4 2.4 0 0 1 18.1 19H5.9a2.4 2.4 0 0 1-2.4-2.4V7.4Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" />
      {upload ? <><circle cx="17.3" cy="16.8" r="4.3" fill="white" stroke="currentColor" strokeWidth="1.7" /><path d="M17.3 19.2v-4.9M15.2 16.2l2.1-2.1 2.1 2.1" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></> : null}
    </Icon>
  );
}

function DotsIcon() {
  return <Icon className="h-5.5 w-5.5"><circle cx="5" cy="12" r="1.8" fill="currentColor" /><circle cx="12" cy="12" r="1.8" fill="currentColor" /><circle cx="19" cy="12" r="1.8" fill="currentColor" /></Icon>;
}

function CloudUploadIcon() {
  return <Icon className="h-12 w-12"><path d="M8.5 17.5H7.4a4.1 4.1 0 0 1-.5-8.2A5.7 5.7 0 0 1 17.7 10a3.8 3.8 0 0 1-.9 7.5h-1.3" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" /><path d="M12 19.5v-7M8.9 15.2 12 12.1l3.1 3.1" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" /></Icon>;
}

function CloseIcon() {
  return <Icon className="h-5 w-5"><path d="m7 7 10 10M17 7 7 17" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></Icon>;
}

function InfoIcon() {
  return <Icon className="h-5 w-5"><path d="M12 10.8v5.1" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /><circle cx="12" cy="7.7" r="1" fill="currentColor" /></Icon>;
}

function FileTextIcon() {
  return <Icon className="h-6 w-6"><path d="M7 4.5h7.2L18 8.3v11.2H7V4.5Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" /><path d="M14.1 4.7v3.8H18M9.6 12h4.8M9.6 15.2h4.8" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></Icon>;
}

function ImageFileIcon() {
  return <Icon className="h-6 w-6"><path d="M5.5 5.5h13v13h-13v-13Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.9" /><circle cx="9.2" cy="9.1" r="1.2" fill="currentColor" /><path d="m7.8 16 3.4-3.5 2.1 2.2 1.5-1.6 2.2 2.9" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></Icon>;
}

function SearchIcon() {
  return <Icon className="h-5 w-5"><circle cx="10.5" cy="10.5" r="5.4" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m14.7 14.7 4.4 4.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" /></Icon>;
}

function FilterIcon() {
  return <Icon className="h-5 w-5"><path d="M5 7h14M8 12h8M11 17h2" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.1" /></Icon>;
}

function DownloadIcon() {
  return <Icon className="h-5.5 w-5.5"><path d="M12 4.5v9.2M8.5 10.4 12 13.9l3.5-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" /><path d="M5.8 15.5v2.8h12.4v-2.8" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" /></Icon>;
}

function TrashIcon() {
  return <Icon className="h-5 w-5"><path d="M8.1 9.4v7.1M12 9.4v7.1M15.9 9.4v7.1" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" /><path d="M5.8 6.8h12.4M9.2 6.8l.6-2h4.4l.6 2M7.1 6.8l.8 13h8.2l.8-13" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" /></Icon>;
}

function RowDocumentIcon({ color }: { color: string }) {
  return (
    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[0.65rem] text-white shadow-[0_8px_16px_rgba(0,0,0,0.08)] ${color}`}>
      <Icon className="h-7 w-7">
        <path d="M7 4.8h7.4L18 8.4v10.8H7V4.8Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
        <path d="M14.3 4.9v3.7H18M9.4 12h5.2M9.4 15h5.2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </Icon>
    </span>
  );
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(bytes % (1024 * 1024) === 0 ? 0 : 1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function categoryMismatch(file: File, category: LodgeDocumentCategory): string {
  const selectedCategory = categories.find((item) => item.value === category);
  if (!selectedCategory) {
    return "";
  }
  const normalized = file.name.toLowerCase().replace(/[_-]/g, " ");
  const matches = selectedCategory.tokens.every((token) => normalized.includes(token));
  return matches ? "" : `${file.name} does not look like ${selectedCategory.label}.`;
}

function validateFile(file: File, category: LodgeDocumentCategory): string[] {
  const errors: string[] = [];
  if (category === "members_data") {
    if (!file.name.toLowerCase().endsWith(".xlsx") || !workbookAllowedTypes.has(file.type || "application/octet-stream")) {
      errors.push(`${file.name} must be an XLSX members workbook.`);
    }
  } else if (!documentAllowedTypes.has(file.type)) {
    errors.push(`${file.name} must be a PDF, JPG, or PNG.`);
  }
  if (file.size > maxFileBytes) {
    errors.push(`${file.name} is larger than 20MB.`);
  }
  const mismatch = categoryMismatch(file, category);
  if (mismatch) {
    errors.push(mismatch);
  }
  return errors;
}

function validateFiles(files: File[], category: LodgeDocumentCategory): string[] {
  const filenameCounts = new Map<string, number>();
  files.forEach((file) => {
    const normalizedName = file.name.trim().toLowerCase();
    filenameCounts.set(normalizedName, (filenameCounts.get(normalizedName) ?? 0) + 1);
  });

  const errors = files.flatMap((file) => {
    const errors = validateFile(file, category);
    if ((filenameCounts.get(file.name.trim().toLowerCase()) ?? 0) > 1) {
      errors.push(`${file.name} has already been selected.`);
    }
    return errors;
  });
  if (category === "members_data" && files.length > 1) {
    errors.push("Members Data accepts one workbook at a time.");
  }
  return errors;
}

function uploadFileBatches(files: File[], batchSize: number): File[][] {
  const batches: File[][] = [];
  for (let index = 0; index < files.length; index += batchSize) {
    batches.push(files.slice(index, index + batchSize));
  }
  return batches;
}

function FileBadge({ file, category }: { file: File; category: LodgeDocumentCategory }) {
  const isTreasurerReport = category === "treasurers_report";
  const isImage = file.type.startsWith("image/");
  const badgeClass = isTreasurerReport
    ? "bg-[#e11616] text-white"
    : category === "minutes_stated_meeting"
      ? "bg-[#d98a00] text-white"
      : category === "members_data"
        ? "bg-[#1769ba] text-white"
        : "bg-[#7d3fd0] text-white";

  return (
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.35rem] shadow-[0_7px_14px_rgba(0,0,0,0.08)] ${badgeClass}`}>
      {isTreasurerReport ? (
        <span className="text-[1.2rem] font-black leading-none">₱</span>
      ) : isImage ? (
        <ImageFileIcon />
      ) : (
        <FileTextIcon />
      )}
    </span>
  );
}

function NavButton({ active, label, icon, onClick }: { active?: boolean; label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex min-w-0 flex-col items-center gap-1 ${active ? "text-[#d00000]" : "text-[#716a66]"}`}>
      {icon}
      <span className="text-[0.55rem] font-medium sm:text-[0.62rem]">{label}</span>
      <span className={`h-[0.12rem] w-8 rounded-full ${active ? "bg-[#d00000]" : "bg-transparent"}`} />
    </button>
  );
}

function documentMonthLabel(document: LodgeDocument): string {
  if (document.treasurer_summary?.report_month && document.treasurer_summary.report_year) {
    return formatDocumentPeriod(document.treasurer_summary.report_month - 1, document.treasurer_summary.report_year);
  }
  const documentDate = parseDocumentDateFromFilename(document.original_filename);
  if (documentDate) {
    return documentDate;
  }
  return formatShortDate(document.created_at);
}

function parseDocumentYearFromFilename(filename: string): number | null {
  const normalized = filename.replace(/[_-]+/g, " ");
  const match = normalized.match(/\b(19\d{2}|20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function formatShortDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function parseDocumentDateFromFilename(filename: string): string | null {
  const normalized = filename.replace(/[_-]+/g, " ");
  const monthPattern = Object.keys(monthAliases).join("|");
  const monthMatch = normalized.match(new RegExp(`\\b(${monthPattern})\\b\\s*,?\\s*(20\\d{2}|19\\d{2})`, "i"));
  if (monthMatch) {
    return formatDocumentPeriod(monthAliases[monthMatch[1].toLowerCase()], Number(monthMatch[2]));
  }

  const prefixedMonthMatch = normalized.match(/^\s*(0?[1-9]|1[0-2])\b[\s\S]*?\b(20\d{2}|19\d{2})\b/);
  if (prefixedMonthMatch) {
    return formatDocumentPeriod(Number(prefixedMonthMatch[1]) - 1, Number(prefixedMonthMatch[2]));
  }

  const isoMatch = normalized.match(/\b(20\d{2}|19\d{2})[ .](0?[1-9]|1[0-2])(?:[ .](0?[1-9]|[12]\d|3[01]))?\b/);
  if (isoMatch) {
    const date = new Date(
      Number(isoMatch[1]),
      Number(isoMatch[2]) - 1,
      isoMatch[3] ? Number(isoMatch[3]) : 1,
    );
    return date.toLocaleDateString("en-US", isoMatch[3] ? {
      month: "short",
      day: "numeric",
      year: "numeric",
    } : {
      month: "short",
      year: "numeric",
    });
  }

  return null;
}

function formatDocumentPeriod(monthIndex: number, year: number): string {
  return new Date(year, monthIndex, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function documentDisplayTitle(document: LodgeDocument): string {
  return document.original_filename
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function documentExtensionLabel(document: LodgeDocument): string {
  const extension = document.original_filename.split(".").pop()?.trim().toUpperCase();
  return extension || "FILE";
}

function documentTheme(document: LodgeDocument) {
  if (document.category === "treasurers_report") {
    return { tile: "bg-[linear-gradient(145deg,#18a33a,#087c22)]", badge: "bg-[#e5f6e9] text-[#14842d]" };
  }
  if (document.category === "minutes_stated_meeting") {
    return { tile: "bg-[linear-gradient(145deg,#ef9c00,#d17a00)]", badge: "bg-[#fff0d8] text-[#d07800]" };
  }
  if (document.category === "members_data") {
    return { tile: "bg-[linear-gradient(145deg,#2384d5,#1769ba)]", badge: "bg-[#e7f2ff] text-[#1769ba]" };
  }
  return { tile: "bg-[linear-gradient(145deg,#8e4edb,#7436bd)]", badge: "bg-[#efe3ff] text-[#7d3fd0]" };
}

export function DocumentsScreen({ onLogout, onNavigate, onMembersDataUploaded }: DocumentsScreenProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const uploadButtonRef = useRef<HTMLButtonElement | null>(null);
  const successToastTimerRef = useRef<number | null>(null);
  const [activeTab, setActiveTab] = useState<"upload" | "list">("upload");
  const [selectedCategory, setSelectedCategory] = useState<LodgeDocumentCategory | "">("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [errorModalMessages, setErrorModalMessages] = useState<string[]>([]);
  const [uploadMessage, setUploadMessage] = useState("");
  const [successToastMessage, setSuccessToastMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [documents, setDocuments] = useState<LodgeDocument[]>([]);
  const [isListLoading, setIsListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [listCategory, setListCategory] = useState<LodgeDocumentCategory | "all">("all");
  const [listYear, setListYear] = useState<DocumentYearFilter>("all");
  const [documentSearch, setDocumentSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [documentToDelete, setDocumentToDelete] = useState<LodgeDocument | null>(null);
  const [isDeletingDocument, setIsDeletingDocument] = useState(false);
  const [deleteDocumentError, setDeleteDocumentError] = useState("");

  const totalSize = useMemo(() => selectedFiles.reduce((sum, file) => sum + file.size, 0), [selectedFiles]);
  const listYearOptions = useMemo(() => {
    const years = Array.from(
      new Set(
        documents
          .map((document) => parseDocumentYearFromFilename(document.original_filename))
          .filter((year): year is number => year !== null),
      ),
    ).sort((a, b) => b - a);
    const hasOthers = documents.some((document) => parseDocumentYearFromFilename(document.original_filename) === null);
    return { years, hasOthers };
  }, [documents]);
  const filteredDocuments = useMemo(() => {
    const search = documentSearch.trim().toLowerCase();
    return documents.filter((document) => {
      const matchesCategory = listCategory === "all" || document.category === listCategory;
      if (!matchesCategory) {
        return false;
      }
      const documentYear = parseDocumentYearFromFilename(document.original_filename);
      const matchesYear =
        listYear === "all" ||
        (listYear === "others" && documentYear === null) ||
        (documentYear !== null && String(documentYear) === listYear);
      if (!matchesYear) {
        return false;
      }
      if (!search) {
        return true;
      }
      return [
        document.original_filename,
        document.category_label,
        documentDisplayTitle(document),
        documentMonthLabel(document),
        documentYear ? String(documentYear) : "others",
        formatShortDate(document.created_at),
      ].some((value) => value.toLowerCase().includes(search));
    });
  }, [documents, documentSearch, listCategory, listYear]);
  const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / listPageSize));
  const currentListPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (currentListPage - 1) * listPageSize;
  const paginatedDocuments = filteredDocuments.slice(pageStartIndex, pageStartIndex + listPageSize);

  useEffect(() => {
    return () => {
      if (successToastTimerRef.current) {
        window.clearTimeout(successToastTimerRef.current);
      }
    };
  }, []);

  function showSuccessToast(message: string) {
    if (successToastTimerRef.current) {
      window.clearTimeout(successToastTimerRef.current);
    }
    setSuccessToastMessage(message);
    successToastTimerRef.current = window.setTimeout(() => {
      setSuccessToastMessage("");
      successToastTimerRef.current = null;
    }, 3200);
  }

  function scrollToUploadButton() {
    const container = scrollContainerRef.current;
    const button = uploadButtonRef.current;
    if (!container || !button) {
      return;
    }

    const scrollElement = container;
    const containerRect = scrollElement.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const start = scrollElement.scrollTop;
    const bottomPadding = 18;
    const target = Math.max(
      0,
      start + buttonRect.bottom - containerRect.bottom + bottomPadding,
    );
    const distance = target - start;
    if (Math.abs(distance) < 4) {
      return;
    }

    const duration = 850;
    const startedAt = window.performance.now();
    const easeInOutCubic = (progress: number) =>
      progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    function step(now: number) {
      const progress = Math.min(1, (now - startedAt) / duration);
      scrollElement.scrollTop = start + distance * easeInOutCubic(progress);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    }

    window.requestAnimationFrame(step);
  }

  function scrollToDocumentsTop() {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }
    container.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    if (activeTab !== "list") {
      return;
    }

    let isMounted = true;
    async function loadDocuments() {
      setIsListLoading(true);
      setListError("");
      try {
        const response = await getLodgeDocuments();
        if (isMounted) {
          setDocuments(response.documents);
        }
      } catch (error) {
        if (isMounted) {
          setListError(error instanceof Error ? error.message : "Unable to load documents.");
        }
      } finally {
        if (isMounted) {
          setIsListLoading(false);
        }
      }
    }

    void loadDocuments();
    return () => {
      isMounted = false;
    };
  }, [activeTab]);

  function addFiles(files: File[]) {
    if (!selectedCategory) {
      const nextErrors = ["Select a category before choosing files."];
      setErrors(nextErrors);
      setErrorModalMessages(nextErrors);
      return;
    }
    const nextFiles = [...selectedFiles, ...files];
    const nextErrors = validateFiles(nextFiles, selectedCategory);
    setSelectedFiles(nextFiles);
    setErrors(nextErrors);
    setUploadMessage("");
    window.setTimeout(scrollToUploadButton, 80);
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    addFiles(Array.from(event.dataTransfer.files));
  }

  function removeFile(index: number) {
    const nextFiles = selectedFiles.filter((_, itemIndex) => itemIndex !== index);
    setSelectedFiles(nextFiles);
    setErrors(selectedCategory ? validateFiles(nextFiles, selectedCategory) : []);
  }

  async function handleUpload() {
    if (!selectedCategory) {
      const nextErrors = ["Select a category before uploading."];
      setErrors(nextErrors);
      setErrorModalMessages(nextErrors);
      return;
    }
    if (selectedFiles.length === 0) {
      const nextErrors = ["Choose at least one file to upload."];
      setErrors(nextErrors);
      setErrorModalMessages(nextErrors);
      return;
    }
    const validationErrors = validateFiles(selectedFiles, selectedCategory);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setErrorModalMessages(validationErrors);
      return;
    }

    setIsUploading(true);
    setErrors([]);
    setUploadMessage("");
    setSuccessToastMessage("");
    try {
      const results: LodgeDocumentUploadResult[] = [];
      const batches = selectedCategory === "members_data"
        ? [selectedFiles]
        : uploadFileBatches(selectedFiles, uploadBatchSize);

      for (let index = 0; index < batches.length; index += 1) {
        const batch = batches[index];
        setUploadMessage(`Uploading ${Math.min(index + 1, batches.length)} of ${batches.length}...`);
        try {
          const [response] = await Promise.all([
            uploadLodgeDocuments(selectedCategory, batch, notes),
            minimumLoadingDelay(),
          ]);
          results.push(...response.results);
        } catch (error) {
          if (error instanceof ApiError) {
            const message = error.message.split("\n").filter(Boolean).join(" ");
            results.push(
              ...batch.map((file) => ({
                filename: file.name,
                status: "rejected" as const,
                errors: [message || "Unable to upload this file."],
              })),
            );
            if (error.status === 401 || error.status === 403) {
              const remainingFiles = batches.slice(index + 1).flat();
              results.push(
                ...remainingFiles.map((file) => ({
                  filename: file.name,
                  status: "rejected" as const,
                  errors: ["Upload stopped because your session or permission was rejected."],
                })),
              );
              break;
            }
          } else {
            results.push(
              ...batch.map((file) => ({
                filename: file.name,
                status: "rejected" as const,
                errors: ["Unable to upload this file."],
              })),
            );
          }
        }
      }

      const responseErrors = results.flatMap((result) =>
        result.errors.map((error) => `${result.filename}: ${error}`),
      );
      const rejectedFilenames = new Set(
        results
          .filter((result) => result.status === "rejected")
          .map((result) => result.filename),
      );
      const uploadedCount = results.filter((result) => result.status === "uploaded").length;
      const rejectedCount = rejectedFilenames.size;
      if (rejectedCount > 0) {
        setUploadMessage(`Uploaded ${uploadedCount} file${uploadedCount === 1 ? "" : "s"}. ${rejectedCount} file${rejectedCount === 1 ? "" : "s"} need${rejectedCount === 1 ? "s" : ""} attention.`);
      } else {
        setUploadMessage("");
        showSuccessToast(`Uploaded ${uploadedCount} file${uploadedCount === 1 ? "" : "s"}.`);
        window.setTimeout(scrollToDocumentsTop, 80);
      }
      setErrors(responseErrors);
      if (responseErrors.length > 0) {
        setErrorModalMessages(responseErrors);
      }
      setSelectedFiles((currentFiles) =>
        currentFiles.filter((file) => rejectedFilenames.has(file.name)),
      );
      if (rejectedCount === 0) {
        setNotes("");
      }
      if (
        selectedCategory === "members_data"
        && results.some((result) => result.status === "uploaded")
      ) {
        await onMembersDataUploaded?.();
      }
    } catch (error) {
      if (error instanceof ApiError) {
        const nextErrors = error.message.split("\n").filter(Boolean);
        setErrors(nextErrors);
        setErrorModalMessages(nextErrors);
      } else {
        const nextErrors = ["Unable to upload documents."];
        setErrors(nextErrors);
        setErrorModalMessages(nextErrors);
      }
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDeleteDocument() {
    if (!documentToDelete) {
      return;
    }
    setIsDeletingDocument(true);
    setDeleteDocumentError("");
    try {
      const [response] = await Promise.all([
        deleteLodgeDocument(documentToDelete.id),
        minimumLoadingDelay(),
      ]);
      setDocuments((currentDocuments) =>
        currentDocuments.filter((document) => document.id !== documentToDelete.id),
      );
      setDocumentToDelete(null);
      showSuccessToast(response.message);
    } catch (error) {
      setDeleteDocumentError(error instanceof Error ? error.message : "Unable to delete document.");
    } finally {
      setIsDeletingDocument(false);
    }
  }

  const greeting = timeBasedGreeting();
  const uploadVisible = Boolean(selectedCategory);

  return (
    <main className="login-paper h-[100svh] overflow-hidden px-4 pt-4 text-[#111111] sm:px-5 sm:pt-5">
      <div className="mx-auto flex h-full w-full max-w-[26rem] flex-col overflow-hidden">
        {successToastMessage ? (
          <div className="pointer-events-none absolute left-1/2 top-3 z-40 w-[min(22rem,calc(100%-2rem))] -translate-x-1/2 rounded-[0.8rem] border border-[#bfe8c7] bg-white/96 px-3.5 py-3 text-[0.7rem] font-semibold text-[#16802e] shadow-[0_12px_26px_rgba(45,98,39,0.14)] backdrop-blur-md">
            {successToastMessage}
          </div>
        ) : null}
        <section className="flex items-start justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Image src="/branding/dll347-logo.png" alt="Datu Lapu-Lapu Lodge No. 347 logo" width={88} height={88} priority className="h-[5.3rem] w-[5.3rem] shrink-0 drop-shadow-[0_10px_18px_rgba(143,90,16,0.22)]" />
            <h1 className="min-w-0 pt-1 font-[family:var(--font-body-sans)] text-[1.1rem] font-extrabold leading-[1.12] tracking-[-0.05em]">
              {greeting},
              <br />
              Brother 👋
            </h1>
          </div>
          <button type="button" onClick={() => void onLogout()} className="mt-2 shrink-0 rounded-full border border-[#f2d7d7] bg-white/78 px-3.5 py-2 text-[0.72rem] font-semibold leading-none text-[#c10000] shadow-[0_6px_16px_rgba(120,90,40,0.05)]">
            Sign out
          </button>
        </section>

        <div ref={scrollContainerRef} className="mt-4 flex-1 overflow-y-auto pb-[6.6rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <section className="rounded-[1.55rem] border border-[#f1ece4] bg-white/90 px-3.5 py-4 shadow-[0_14px_34px_rgba(149,110,46,0.08)] backdrop-blur-[10px]">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fff8ef] text-[#d98a00]">
                <FolderIcon upload />
              </div>
              <div>
                <h2 className="text-[1rem] font-extrabold tracking-[-0.04em]">Documents</h2>
                <p className="mt-0.5 text-[0.68rem] text-[#6f6763]">
                  {activeTab === "list" ? "View and download your documents" : "Upload your documents"}
                </p>
              </div>
            </div>

            <div className="mt-5 grid h-[2.75rem] grid-cols-2 rounded-[0.9rem] bg-[#f1efed] p-[0.18rem]">
              {(["upload", "list"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`relative flex h-full items-center justify-center rounded-[0.78rem] text-[0.72rem] font-semibold capitalize transition-colors ${
                    activeTab === tab
                      ? "bg-white text-[#d00000] shadow-[0_8px_18px_rgba(75,48,20,0.07)]"
                      : "text-[#5f5955]"
                  }`}
                >
                  <span className="leading-none">{tab}</span>
                  {activeTab === tab ? (
                    <span className="absolute inset-x-2 bottom-[0.02rem] h-[0.1rem] rounded-full bg-[#d00000]" />
                  ) : null}
                </button>
              ))}
            </div>

            {activeTab === "upload" ? (
              <div className="mt-4">
                <label className="text-[0.7rem] font-medium">Select Category</label>
                <div className="relative mt-1.5">
                  <select value={selectedCategory} onChange={(event) => { setSelectedCategory(event.target.value as LodgeDocumentCategory | ""); setSelectedFiles([]); setErrors([]); setUploadMessage(""); }} className="h-10 w-full appearance-none rounded-[0.42rem] border border-[#ded6cf] bg-white px-3.5 pr-9 text-[0.7rem] text-[#111111] outline-none">
                    <option value="">Select a category</option>
                    {categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                  </select>
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[1rem] leading-none">⌄</span>
                </div>
              </div>
            ) : null}

            {activeTab === "upload" ? (
              <>
                {uploadVisible ? (
                  <>
                    <div onDragOver={(event) => event.preventDefault()} onDrop={handleDrop} className="mt-5 overflow-hidden rounded-[0.65rem] border border-dashed border-[#ecd5c5] bg-white/55">
                      <div className="flex flex-col items-center px-4 py-7 text-center">
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#fff0f0] text-[#d00000] shadow-inner">
                          <CloudUploadIcon />
                        </div>
                        <h3 className="mt-4 text-[0.82rem] font-extrabold tracking-[-0.025em]">Drag and drop files here</h3>
                        <p className="mt-2 text-[0.66rem] text-[#6d6661]">or</p>
                        <button type="button" onClick={() => inputRef.current?.click()} className="mt-3 rounded-[0.52rem] border border-[#e00000] bg-white px-6 py-2.5 text-[0.74rem] font-bold text-[#d00000]">
                          Choose Files
                        </button>
                        <input ref={inputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.xlsx,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleFileInput} className="hidden" />
                      </div>
                      <div className="flex gap-3 border-t border-[#eadfd6] px-3.5 py-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#fff0f0] text-[#d00000]"><InfoIcon /></span>
                        <div className="text-[0.62rem] leading-4 text-[#6a625e]">
                          <p>You can upload multiple files</p>
                          <p>Max file size: 20MB per file • Allowed: PDF, JPG, PNG, XLSX</p>
                        </div>
                      </div>
                    </div>

                    {selectedFiles.length > 0 ? (
                      <section className="mt-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-[0.7rem] font-medium">Selected Files ({selectedFiles.length})</h3>
                          <p className="text-[0.66rem] text-[#6f6763]">Total size: {formatBytes(totalSize)}</p>
                        </div>
                        <div className="mt-2.5 space-y-2.5">
                          {selectedFiles.map((file, index) => (
                            <div key={`${file.name}-${index}`} className="flex items-center gap-2.5 rounded-[0.65rem] border border-[#f0e6df] bg-white px-3 py-2.5 shadow-[0_8px_18px_rgba(75,48,20,0.045)]">
                              <FileBadge file={file} category={selectedCategory as LodgeDocumentCategory} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[0.68rem] font-bold">{file.name}</p>
                                <p className="mt-0.5 text-[0.62rem] text-[#6f6763]">{formatBytes(file.size)}</p>
                              </div>
                              <button type="button" onClick={() => removeFile(index)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#f4d8d8] text-[#d00000]" aria-label={`Remove ${file.name}`}>
                                <CloseIcon />
                              </button>
                            </div>
                          ))}
                        </div>
                      </section>
                    ) : null}

                    <label className="mt-5 block text-[0.7rem] font-medium">
                      Notes <span className="font-normal text-[#6f6763]">(Optional)</span>
                    </label>
                    <textarea value={notes} onChange={(event) => setNotes(event.target.value.slice(0, 200))} placeholder="Add any notes about these documents..." className="mt-1.5 h-18 w-full resize-none rounded-[0.42rem] border border-[#ded6cf] bg-white px-3.5 py-2.5 text-[0.66rem] outline-none placeholder:text-[#8c8580]" />
                    <div className="mt-1 text-right text-[0.62rem] text-[#6f6763]">{notes.length}/200</div>

                    {uploadMessage ? <p className="mt-3 rounded-xl bg-[#f0fbf2] px-3 py-2 text-[0.66rem] font-semibold text-[#13802a]">{uploadMessage}</p> : null}
                    {errors.length > 0 ? (
                      <div className="mt-3 space-y-1 rounded-xl bg-[#fff0f0] px-3 py-2 text-[0.62rem] leading-4 text-[#c90000]">
                        {errors.map((error) => <p key={error}>{error}</p>)}
                      </div>
                    ) : null}

                    <button ref={uploadButtonRef} type="button" disabled={isUploading || selectedFiles.length === 0} onClick={() => void handleUpload()} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-[0.65rem] bg-[#d90000] text-[0.78rem] font-extrabold text-white shadow-[0_10px_20px_rgba(208,0,0,0.18)] disabled:cursor-not-allowed disabled:bg-[#e4b1b1]">
                      {isUploading ? (
                        <>
                          <ThemedLoader size="sm" className="brightness-125" />
                          <span>Processing upload...</span>
                        </>
                      ) : (
                        `Upload ${selectedFiles.length || ""} File${selectedFiles.length === 1 ? "" : "s"}`
                      )}
                    </button>
                  </>
                ) : (
                  <div className="mt-5 rounded-[0.65rem] border border-dashed border-[#ecd5c5] bg-white/55 px-4 py-9 text-center text-[0.68rem] text-[#6f6763]">
                    Select a category to show the upload fields.
                  </div>
                )}
              </>
            ) : (
              <section className="mt-5">
                <div className="flex items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <select value={listCategory} onChange={(event) => { setListCategory(event.target.value as LodgeDocumentCategory | "all"); setCurrentPage(1); }} className="h-10 w-full appearance-none rounded-[0.55rem] border border-[#ded6cf] bg-white px-3.5 pr-9 text-[0.72rem] font-semibold text-[#171717] outline-none">
                      <option value="all">All Categories</option>
                      {categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                    </select>
                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[1rem] leading-none">⌄</span>
                  </div>
                  <div className="relative w-[6.8rem] shrink-0">
                    <select value={listYear} onChange={(event) => { setListYear(event.target.value); setCurrentPage(1); }} className="h-10 w-full appearance-none rounded-[0.55rem] border border-[#ded6cf] bg-white px-3 pr-7 text-[0.72rem] font-semibold text-[#171717] outline-none">
                      <option value="all">All Years</option>
                      {listYearOptions.years.map((year) => <option key={year} value={year}>{year}</option>)}
                      {listYearOptions.hasOthers ? <option value="others">Others</option> : null}
                    </select>
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[1rem] leading-none">⌄</span>
                  </div>
                  <button type="button" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.55rem] border border-[#eadfda] bg-white text-[#111111]" aria-label="Filter documents">
                    <FilterIcon />
                  </button>
                </div>

                <label className="mt-4 flex h-10 items-center gap-3 rounded-[0.55rem] border border-[#ded6cf] bg-white px-3.5 text-[#77716d]">
                  <SearchIcon />
                  <input
                    type="search"
                    value={documentSearch}
                    onChange={(event) => { setDocumentSearch(event.target.value); setCurrentPage(1); }}
                    placeholder="Search documents..."
                    className="min-w-0 flex-1 bg-transparent text-[0.72rem] text-[#111111] outline-none placeholder:text-[#8b8581]"
                  />
                </label>

                <div className="mt-4 space-y-2.5">
                  {listError ? <p className="rounded-xl bg-[#fff0f0] px-3 py-3 text-[0.72rem] text-[#c90000]">{listError}</p> : null}
                  {isListLoading ? <p className="rounded-xl bg-white px-3 py-5 text-center text-[0.72rem] text-[#6f6763]">Loading documents...</p> : null}
                  {!isListLoading && filteredDocuments.length === 0 ? <p className="rounded-xl bg-white px-3 py-8 text-center text-[0.72rem] text-[#6f6763]">No documents found.</p> : null}
                  {paginatedDocuments.map((document) => {
                    const theme = documentTheme(document);
                    return (
                      <div key={document.id} className="flex items-center gap-3 rounded-[0.8rem] border border-[#f0e6df] bg-white px-3 py-3 shadow-[0_8px_18px_rgba(75,48,20,0.045)]">
                        <RowDocumentIcon color={theme.tile} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`rounded-full px-2 py-0.5 text-[0.56rem] font-bold leading-none ${theme.badge}`}>{documentExtensionLabel(document)}</span>
                            <span className="rounded-full bg-[#f5efea] px-2 py-0.5 text-[0.54rem] font-semibold leading-none text-[#6e6661]">{document.category_label}</span>
                          </div>
                          <h3 className="mt-2 truncate text-[0.76rem] font-extrabold tracking-[-0.025em] text-[#111111]">{documentDisplayTitle(document)}</h3>
                          <p className="mt-1 truncate text-[0.64rem] text-[#6a625e]">
                            {formatBytes(document.size_bytes)} <span className="mx-1">•</span> Uploaded {formatShortDate(document.created_at)}
                          </p>
                          {document.extraction_status === "pending_review" ? (
                            <p className="mt-1 text-[0.6rem] font-semibold text-[#d07800]">Processing...</p>
                          ) : document.extraction_status === "failed" ? (
                            <p className="mt-1 line-clamp-2 text-[0.6rem] font-semibold text-[#c90000]">{document.extraction_errors[0] ?? "Processing failed."}</p>
                          ) : document.extraction_status === "extracted" ? (
                            <p className="mt-1 text-[0.6rem] font-semibold text-[#14842d]">Processed</p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <span className="text-[0.62rem] font-medium text-[#6a625e]">{documentMonthLabel(document)}</span>
                          <div className="flex items-center gap-1.5">
                            <a href={document.file_url} download={document.original_filename} className="flex h-9 w-9 items-center justify-center rounded-[0.62rem] border border-[#f3d9d9] bg-white text-[#d00000]" aria-label={`Download ${document.original_filename}`}>
                              <DownloadIcon />
                            </a>
                            <button type="button" onClick={() => { setDocumentToDelete(document); setDeleteDocumentError(""); }} className="flex h-9 w-9 items-center justify-center rounded-[0.62rem] border border-[#f0e1dc] bg-[#fffafa] text-[#9f1414]" aria-label={`Delete ${document.original_filename}`}>
                              <TrashIcon />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {filteredDocuments.length > 0 ? (
                  <div className="mt-5 text-center">
                    <p className="text-[0.68rem] text-[#6a625e]">
                      Showing {pageStartIndex + 1}-{Math.min(pageStartIndex + listPageSize, filteredDocuments.length)} of {filteredDocuments.length} documents
                    </p>
                    <div className="mt-3 flex items-center justify-center gap-2">
                      <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentListPage === 1} className="flex h-9 w-9 items-center justify-center rounded-[0.55rem] border border-[#eadfda] bg-white text-[1rem] font-bold text-[#6a625e] disabled:opacity-40" aria-label="Previous page">‹</button>
                      {Array.from({ length: totalPages }, (_, index) => index + 1).slice(Math.max(0, currentListPage - 2), Math.max(0, currentListPage - 2) + 3).map((page) => (
                        <button key={page} type="button" onClick={() => setCurrentPage(page)} className={`flex h-9 w-9 items-center justify-center rounded-[0.55rem] border text-[0.72rem] font-bold ${page === currentListPage ? "border-[#d00000] bg-white text-[#d00000]" : "border-[#eadfda] bg-white text-[#6a625e]"}`}>
                          {page}
                        </button>
                      ))}
                      <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentListPage === totalPages} className="flex h-9 w-9 items-center justify-center rounded-[0.55rem] border border-[#eadfda] bg-white text-[1rem] font-bold text-[#6a625e] disabled:opacity-40" aria-label="Next page">›</button>
                    </div>
                  </div>
                ) : null}
              </section>
            )}
          </section>
        </div>

        <nav className="absolute inset-x-0 bottom-0 z-20 rounded-t-[1.35rem] border border-[#eee8e1] bg-white/95 px-3.5 pb-[max(0.55rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-7px_24px_rgba(75,48,20,0.07)] backdrop-blur-xl">
          <div className="grid grid-cols-4 gap-1">
            <NavButton label="Dashboard" icon={<HomeIcon />} onClick={() => onNavigate("home")} />
            <NavButton label="My Profile" icon={<ProfileIcon />} onClick={() => onNavigate("profile")} />
            <NavButton active label="Documents" icon={<FolderIcon />} onClick={() => onNavigate("documents")} />
            <NavButton label="More" icon={<DotsIcon />} onClick={() => onNavigate("more")} />
          </div>
        </nav>

        {errorModalMessages.length > 0 ? (
          <div className="absolute inset-0 z-50 flex items-end bg-[#171717]/48 backdrop-blur-[1px]">
            <section className="w-full rounded-t-[1.25rem] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_45px_rgba(0,0,0,0.22)]">
              <div className="mx-auto h-1 w-9 rounded-full bg-[#b8b0a8]" />
              <div className="mt-4 flex items-center justify-between">
                <span className="h-9 w-9" />
                <h2 className="text-[0.98rem] font-extrabold tracking-[-0.035em] text-[#c90000]">Upload Needs Attention</h2>
                <button type="button" onClick={() => setErrorModalMessages([])} className="flex h-9 w-9 items-center justify-center text-[#111111]" aria-label="Close upload errors">
                  <CloseIcon />
                </button>
              </div>
              <div className="mt-4 max-h-[46svh] overflow-y-auto rounded-[0.9rem] bg-[#fff0f0] px-3 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {errorModalMessages.map((message, index) => (
                  <p key={`${message}-${index}`} className="border-b border-[#f5caca] py-2 text-[0.68rem] leading-5 text-[#a60000] last:border-b-0">{message}</p>
                ))}
              </div>
              <button type="button" onClick={() => setErrorModalMessages([])} className="mt-4 h-11 w-full rounded-[0.7rem] bg-[#d00000] text-[0.74rem] font-extrabold text-white">
                OK
              </button>
            </section>
          </div>
        ) : null}
        {documentToDelete ? (
          <div className="absolute inset-0 z-50 flex items-end bg-[#171717]/48 backdrop-blur-[1px]">
            <section className="w-full rounded-t-[1.25rem] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_45px_rgba(0,0,0,0.22)]">
              <div className="mx-auto h-1 w-9 rounded-full bg-[#b8b0a8]" />
              <div className="mt-4 flex items-center justify-between">
                <span className="h-9 w-9" />
                <h2 className="text-[0.98rem] font-extrabold tracking-[-0.035em] text-[#111111]">Delete Document</h2>
                <button type="button" onClick={() => setDocumentToDelete(null)} disabled={isDeletingDocument} className="flex h-9 w-9 items-center justify-center text-[#111111] disabled:opacity-40" aria-label="Close delete confirmation">
                  <CloseIcon />
                </button>
              </div>
              <div className="mt-4 rounded-[0.9rem] bg-[#fff7f4] px-3.5 py-3">
                <p className="text-[0.72rem] font-semibold leading-5 text-[#251f1c]">Delete “{documentDisplayTitle(documentToDelete)}”?</p>
                <p className="mt-1 text-[0.64rem] leading-4 text-[#6a625e]">This removes the document from the list and deletes the uploaded file.</p>
              </div>
              {deleteDocumentError ? (
                <p className="mt-3 rounded-[0.7rem] bg-[#fff0f0] px-3 py-2 text-[0.66rem] font-semibold text-[#c90000]">{deleteDocumentError}</p>
              ) : null}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setDocumentToDelete(null)} disabled={isDeletingDocument} className="h-11 rounded-[0.7rem] border border-[#eadfda] bg-white text-[0.74rem] font-extrabold text-[#4d4743] disabled:opacity-50">
                  No
                </button>
                <button type="button" onClick={() => void handleDeleteDocument()} disabled={isDeletingDocument} className="flex h-11 items-center justify-center gap-2 rounded-[0.7rem] bg-[#d00000] text-[0.74rem] font-extrabold text-white disabled:bg-[#e4b1b1]">
                  {isDeletingDocument ? <><ThemedLoader size="sm" className="brightness-125" /><span>Deleting...</span></> : "Yes, Delete"}
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
