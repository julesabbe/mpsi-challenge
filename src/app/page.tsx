import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Racine : affiche toujours la page publique. Aucune reconnexion
 * automatique — chacun se connecte via S'INSCRIRE / J'AI DÉJÀ UN COMPTE
 * (ou l'espace admin), quel que soit l'appareil.
 */
export default async function RootPage() {
  redirect("/guest");
}
