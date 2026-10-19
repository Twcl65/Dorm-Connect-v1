"use client";

export function ProofMedia({
  url,
  className,
}: {
  url: string;
  className?: string;
}) {
  const lower = url.split("?")[0]?.toLowerCase() ?? "";
  const isPdf = lower.endsWith(".pdf");
  const isWord = lower.endsWith(".doc") || lower.endsWith(".docx");

  if (isPdf || isWord) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={
          className ??
          "text-xs text-sky-600 underline hover:text-sky-800 break-all"
        }
      >
        {isPdf ? "View PDF document" : "View Word document"}
      </a>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt="Uploaded document"
      className={className ?? "max-h-48 w-full max-w-xs rounded-md border object-contain"}
    />
  );
}
