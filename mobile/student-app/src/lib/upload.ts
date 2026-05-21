import { getApiBaseUrl } from "./config";

export async function uploadMobileFile(
  token: string,
  localUri: string,
  fileName: string,
  mimeType: string
): Promise<string> {
  const form = new FormData();
  form.append("file", {
    uri: localUri,
    name: fileName,
    type: mimeType,
  } as unknown as Blob);

  const res = await fetch(`${getApiBaseUrl()}/api/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    body: form,
  });

  const json = (await res.json()) as { url?: string; error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? "Upload failed.");
  }
  if (!json.url) {
    throw new Error("Upload did not return a file URL.");
  }
  return json.url;
}
