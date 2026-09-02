// Helpers partagés (formatage, validation)

export function formatPoints(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `il y a ${d} j`;
  return formatDate(iso);
}

/** Nom complet d'un élève (prénom + nom s'il existe) */
export function studentName(s: { first_name: string; last_name: string | null }) {
  return s.last_name ? `${s.first_name} ${s.last_name}` : s.first_name;
}

export const MAX_VIDEO_BYTES = 150 * 1024 * 1024; // 150 Mo (aligné sur le bucket)
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
export const ALLOWED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm"];

export function validateVideoFile(file: File): string | null {
  const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
  const typeOk =
    ALLOWED_VIDEO_TYPES.includes(file.type) ||
    ALLOWED_VIDEO_EXTENSIONS.includes(ext);
  if (!typeOk) {
    return "Format non accepté. Formats autorisés : MP4, MOV, WebM.";
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return `La vidéo dépasse la taille maximale autorisée (${Math.round(
      MAX_VIDEO_BYTES / (1024 * 1024)
    )} Mo).`;
  }
  return null;
}

export function ordinalRank(rank: number): string {
  if (rank === 1) return "1er";
  return `${rank}e`;
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
