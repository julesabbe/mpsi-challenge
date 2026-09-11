import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Bucket privé unique pour toutes les vidéos (preuves de défi + présentation
 * d'équipe). Convention de chemin imposée par les policies Storage :
 *   <team_id>/<challenge_id>/<id>.<ext>     (preuve de défi)
 *   <team_id>/presentation-<id>.<ext>       (présentation d'équipe)
 */
export const VIDEO_BUCKET = "challenge-submissions";

/** Extrait l'extension d'un fichier vidéo (» mp4 » par défaut). */
export function videoExtension(file: File): string {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  return /^[a-z0-9]{2,5}$/.test(ext) ? ext : "mp4";
}

function storageErrorMessage(xhr: XMLHttpRequest): string {
  let detail = "";
  try {
    const body = JSON.parse(xhr.responseText || "{}") as { message?: string };
    detail = body.message ?? "";
  } catch {
    detail = "";
  }
  const lower = detail.toLowerCase();
  if (xhr.status === 413 || lower.includes("maximum") || lower.includes("too large")) {
    return "Vidéo trop lourde (150 Mo maximum).";
  }
  if (lower.includes("row-level security") || xhr.status === 403) {
    return "Vous n'avez pas les permissions nécessaires pour déposer cette vidéo.";
  }
  if (lower.includes("mime")) {
    return "Format refusé par le serveur. Formats autorisés : MP4, MOV, WebM.";
  }
  if (lower.includes("duplicate") || xhr.status === 409) {
    return "Cette vidéo existe déjà, réessaie.";
  }
  return detail
    ? `Échec de l'envoi : ${detail}`
    : `Échec de l'envoi (HTTP ${xhr.status}).`;
}

/**
 * Envoie un fichier dans le bucket privé via l'API REST Storage (XHR pour
 * suivre la progression) — le JWT de l'utilisateur est joint, donc les mêmes
 * policies RLS s'appliquent que via supabase-js.
 */
export async function uploadVideo(
  supabase: SupabaseClient,
  path: string,
  file: File,
  options: {
    upsert?: boolean;
    onProgress?: (percent: number) => void;
  } = {}
): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Session expirée, reconnecte-toi.");

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${VIDEO_BUCKET}/${path}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
    xhr.setRequestHeader("x-upsert", options.upsert ? "true" : "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && options.onProgress) {
        options.onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(storageErrorMessage(xhr)));
    };
    xhr.onerror = () =>
      reject(new Error("Upload interrompu. Vérifie ta connexion et réessaie."));
    xhr.send(file);
  });
}

/**
 * Supprime un objet du bucket. Best-effort : un échec (objet déjà absent,
 * policy manquante) ne doit jamais casser le parcours utilisateur.
 */
export async function removeVideo(
  supabase: SupabaseClient,
  path: string | null | undefined
): Promise<void> {
  if (!path) return;
  try {
    await supabase.storage.from(VIDEO_BUCKET).remove([path]);
  } catch {
    /* silencieux : au pire un objet orphelin, jamais visible */
  }
}
