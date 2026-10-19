/** Store optional title + body in the single comment column. */
export function packReview(title: string, comment: string): string {
  const t = title.trim();
  const c = comment.trim();
  if (t) return `${t}\n\n${c}`;
  return c;
}

export function unpackReview(stored: string): { title: string; comment: string } {
  const text = stored.trim();
  const splitAt = text.indexOf("\n\n");
  if (splitAt > 0 && splitAt <= 120) {
    return {
      title: text.slice(0, splitAt).trim(),
      comment: text.slice(splitAt + 2).trim(),
    };
  }
  return { title: "", comment: text };
}
