import { Check, Plus, Trash2, UserRound } from "lucide-react";
import { useState } from "react";
import {
  createProfile,
  DEFAULT_PROFILE_ID,
  defaultSettings,
  deleteProfile,
  getActiveProfileId,
  listProfiles,
  saveSettings,
  setActiveProfileId
} from "../services/storage";

/**
 * Mehrere Menschen auf einem Geraet.
 *
 * Jedes Profil hat eigene Notizen, Stimmungen, Stunden und Einstellungen; der
 * OpenAI-Schluessel bleibt geraeteweit, weil er zur Rechnung des Besitzers
 * gehoert und nicht zur Person im Profil.
 */
export function ProfileSwitcher({ onProfileChange }: { onProfileChange: () => void }) {
  const [profiles, setProfiles] = useState(listProfiles);
  const [activeId, setActiveId] = useState(getActiveProfileId);
  const [newName, setNewName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const refresh = () => {
    setProfiles(listProfiles());
    setActiveId(getActiveProfileId());
    onProfileChange();
  };

  const switchTo = (id: string) => {
    if (id === activeId) return;
    setActiveProfileId(id);
    refresh();
  };

  const add = () => {
    const profile = createProfile(newName);
    // Den Namen hat der Nutzer gerade eingetippt. Das neue Profil deshalb
    // fertig eingerichtet anlegen, statt ihn im Willkommensdialog noch einmal
    // nach etwas zu fragen, das eine Zeile darueber schon beantwortet wurde.
    saveSettings({ ...defaultSettings, name: profile.name, onboarded: true }, profile.id);
    setNewName("");
    setActiveProfileId(profile.id);
    refresh();
  };

  const remove = (id: string) => {
    // Zweistufig: ein Profil zu loeschen nimmt sein komplettes Journal mit,
    // und einen Papierkorb gibt es in einer App ohne Server nicht.
    if (pendingDelete !== id) {
      setPendingDelete(id);
      return;
    }
    deleteProfile(id);
    setPendingDelete(null);
    refresh();
  };

  return (
    <article className="connect-panel profile-panel">
      <header>
        <UserRound size={20} aria-hidden="true" />
        <div>
          <h3>Profile</h3>
          <p>Getrennte Journale auf demselben Geraet — etwa fuer zwei Menschen im Haushalt.</p>
        </div>
      </header>

      <ul className="profile-list">
        {profiles.map((profile) => {
          const isActive = profile.id === activeId;
          return (
            <li key={profile.id} className={isActive ? "is-active" : ""}>
              <button type="button" className="profile-pick" onClick={() => switchTo(profile.id)}>
                {isActive ? <Check size={14} aria-hidden="true" /> : <UserRound size={14} aria-hidden="true" />}
                <span>{profile.name}</span>
                {isActive && <small>aktiv</small>}
              </button>
              {profile.id !== DEFAULT_PROFILE_ID && (
                <button
                  type="button"
                  className={`profile-delete${pendingDelete === profile.id ? " is-armed" : ""}`}
                  onClick={() => remove(profile.id)}
                  onBlur={() => setPendingDelete(null)}
                  aria-label={
                    pendingDelete === profile.id
                      ? `Profil ${profile.name} endgueltig loeschen`
                      : `Profil ${profile.name} loeschen`
                  }
                >
                  <Trash2 size={14} aria-hidden="true" />
                  {pendingDelete === profile.id && <span>Wirklich?</span>}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="key-row">
        <input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder="Neues Profil, z. B. Gast"
          aria-label="Name des neuen Profils"
          onKeyDown={(event) => {
            if (event.key === "Enter" && newName.trim()) add();
          }}
        />
        <button type="button" onClick={add} disabled={!newName.trim()}>
          <Plus size={16} aria-hidden="true" /> Anlegen
        </button>
      </div>
    </article>
  );
}
