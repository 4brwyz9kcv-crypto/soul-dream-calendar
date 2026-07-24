import { HardDriveDownload, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { onStorageIssue, type StorageIssue } from "../services/safeStorage";

/**
 * Meldet, wenn der lokale Speicher voll oder gar nicht verfuegbar ist.
 *
 * In einer App ohne Backend ist das der einzige Moment, in dem echter
 * Datenverlust droht - er darf nicht stillschweigend passieren. Der Hinweis
 * bleibt stehen, bis die Ursache weg ist, und bietet direkt den Export an.
 */
export function StorageNotice({ onExport }: { onExport: () => void }) {
  const [issue, setIssue] = useState<StorageIssue | null>(null);

  useEffect(() => onStorageIssue(setIssue), []);

  if (!issue) return null;

  const isQuota = issue.kind === "quota";

  return (
    <div className="storage-notice" role="alert">
      <TriangleAlert size={18} aria-hidden="true" />
      <div>
        <strong>{isQuota ? "Der lokale Speicher ist voll" : "Kein lokaler Speicher verfuegbar"}</strong>
        <p>
          {isQuota
            ? "Neue Eintraege koennen gerade nicht gesichert werden. Sichere deine Daten und loesche danach alte Tage oder Browserdaten."
            : "Dieser Browser erlaubt keinen Speicher (privater Modus?). Die App laeuft normal weiter, aber alles ist nach dem Schliessen des Tabs weg."}
        </p>
      </div>
      <button type="button" onClick={onExport}>
        <HardDriveDownload size={16} aria-hidden="true" />
        Daten sichern
      </button>
    </div>
  );
}
