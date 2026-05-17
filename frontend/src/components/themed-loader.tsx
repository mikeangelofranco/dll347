type ThemedLoaderProps = {
  className?: string;
  size?: "sm" | "md";
};

const sizeClasses = {
  sm: "h-5 w-5",
  md: "h-12 w-12",
};

export function ThemedLoader({
  className = "",
  size = "md",
}: ThemedLoaderProps) {
  return (
    <span
      className={`relative inline-flex items-center justify-center ${sizeClasses[size]} ${className}`}
      aria-hidden="true"
    >
      <span className="absolute inset-0 rounded-full border border-[#f1d499]/55" />
      <span className="absolute inset-[10%] rounded-full border-2 border-transparent border-t-[#d29a14] border-r-[#b00000] animate-spin" />
      <span className="h-[26%] w-[26%] rotate-45 rounded-[2px] bg-[#d29a14] shadow-[0_0_10px_rgba(210,154,20,0.35)]" />
    </span>
  );
}
