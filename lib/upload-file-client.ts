/** Upload a file as the logged-in landlord or student; returns public URL path. */
export async function uploadDormConnectFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", {
    method: "POST",
    credentials: "include",
    body: fd,
  });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? "Upload failed.");
  }
  if (!data.url) {
    throw new Error("Upload did not return a file URL.");
  }
  return data.url;
}

export async function uploadDormConnectFiles(files: File[]): Promise<string[]> {
  const out: string[] = [];
  for (const f of files) {
    out.push(await uploadDormConnectFile(f));
  }
  return out;
}
