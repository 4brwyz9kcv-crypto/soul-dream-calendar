# Soul Dream Calendar Modern

Cyber-occult PCB rebuild of the original Python/Tkinter Soul Dream Calendar.
React 19 + Vite + TypeScript (strict) + Vitest. UI language is German; the
aesthetic is a "cyber-occult PCB oracle".

## Features

- **Kalender**: Monatsansicht mit Heute-Ring und Markierung fuer Tage mit Journal-Notiz.
- **Tagesorakel** (deterministisch, portiert aus den Legacy-Python-Algorithmen):
  - Farbe des Tages (xkcd-Formel), Bibelvers (KJV-Formel), Fake-Bibelvers (eigene Markov-Kette),
    Zahlen des Tages, Reisezeiten zu Sonne und Mond (echte Distanzen).
  - **Numerologie**: alle 7 Kategorien (Schicksal, Persoenlichkeit, Einstellung, Charakter,
    Seele, Agenda, Bestimmung) mit Meisterzahl-Hervorhebung (11/22).
  - **Traum-Sigil**: prozedurales, deterministisches SVG-Tagesbild (Leiterbahnen, okkulte Ringe,
    Auge/Stern) — ersetzt das alte Pixabay/DALL-E-Bild komplett lokal und ohne API-Key.
- **Live-Daten** (optional, mit Live/Offline-Badge):
  - Pokemon des Tages via PokeAPI (Sprite, Shiny bei Hover/Tipp, Typen, Groesse),
  - "An diesem Tag" via deutscher Wikipedia inkl. Markov-Fake-News aus den echten Events,
  - Zahlen-Fakt via Numbers API (Quersumme des Datums).
- **Journal & Stimmung**: lokale Notizen, Prompt-Antworten und Mood-Tracking pro Tag.
- **Universal Logger**: 24 Stundenfelder pro Tag (aus dem Tkinter-Original).
- **Rueckblick**: der Monat als Farbstreifen (jeder Tag in seiner Tagesfarbe, auch die
  leeren), Serienzaehler, Volltextsuche ueber Notizen, Antworten und Stundenlog.
- **PCB-Engel**: vier Personas mit lokalen Botschaften; optional via eigenem
  OpenAI-Key persoenliche Botschaften (gpt-4o-mini).
- **Profile**: getrennte Journale fuer mehrere Menschen auf demselben Geraet.
- **Export/Import**: alle Daten als JSON sichern und wiederherstellen (ohne API-Key),
  zusaetzlich Export als Markdown fuer Obsidian, Notion und jeden Editor.
- **Teilbare Tage**: Ansicht und Tag stehen in der Adresszeile (`?v=oracle&d=2026-07-25`),
  der Zurueck-Knopf des Browsers funktioniert.

## Offline-first

Die App ist ohne Internet voll funktionsfaehig: Jeder Live-Fetch hat ein ~6s-Timeout,
cached Ergebnisse in localStorage (Pokemon pro ID dauerhaft, Wikipedia pro Datum 7 Tage,
Zahlen-Fakt pro Tag) und faellt sonst auf die deterministischen lokalen Daten zurueck.
Die Badges an den Karten zeigen "Live" oder "Offline" an.

## Bring your own key (OpenAI)

Es wird **kein API-Key mitgeliefert**. Unter *Einstellungen → OpenAI verbinden* den eigenen
Key eintragen und mit "Testen & Verbinden" pruefen (GET /v1/models). Bei Erfolg schaltet der
Provider-Modus auf OpenAI und der Engel spricht via `gpt-4o-mini`; schlaegt ein Aufruf fehl,
uebernehmen nahtlos die lokalen Botschaften. Der Key liegt nur in localStorage dieses Geraets,
wird nie exportiert und nur an api.openai.com gesendet. "Schluessel entfernen" loescht ihn
und schaltet zurueck auf lokal.

## Datenschutz

Alles liegt im localStorage dieses Browsers. Kein Server, kein Konto, keine
Synchronisierung, kein Tracking. Nach aussen geht nur das **Datum** — an
Wikipedia, Numbers API, optional PokeAPI, und an Open-Meteo beim Suchen eines
Geburtsorts. Notizen sind dabei nie im Spiel. Ohne Netz laeuft die App
vollstaendig weiter.

Der Pokemon-Block laesst sich abschalten (*Einstellungen → Pokemon des Tages
zeigen*); dann unterbleibt der Aufruf an die PokeAPI ganz. Warum das relevant
ist, steht in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

## Entwicklung

```powershell
npm install
npm run dev        # Vite Dev-Server (127.0.0.1:5173)
npm test           # Vitest (inkl. Legacy-Crosscheck der portierten Algorithmen)
npm run typecheck  # tsc --noEmit
npm run build      # tsc + vite build
```

Hilfsskripte:

```powershell
npm run assets:convert  # Engel-GIFs -> animiertes WebP (braucht die Quellen)
npm run assets:og       # Vorschaubild, favicon.ico, robots.txt neu erzeugen
npm run licenses        # Lizenzen aller Abhaengigkeiten auflisten
```

## Ausliefern

CI (`.github/workflows/ci.yml`) prueft Typen, Tests und Build bei jedem Pull
Request gegen `main`.

Der Deploy (`.github/workflows/deploy.yml`) ist **nur von Hand ausloesbar** —
Actions → „Deploy nach gh-pages" → *Run workflow*. Er baut neu und schreibt
das Ergebnis auf `gh-pages`. Wann sich die oeffentliche Seite aendert, soll
eine Entscheidung bleiben und keine Nebenwirkung eines Pushes.

## Git LFS

Die Engel-Assets liegen in Git LFS. Nach dem Klonen einmal:

```powershell
git lfs install
git lfs pull
```

Ohne diesen Schritt liegen nur Zeiger-Textdateien im Arbeitsverzeichnis, und
der Build erzeugt kaputte Bilder, **ohne zu scheitern**.

## Notes

- The legacy Python app remains untouched in the parent folder.
- All data is stored in browser localStorage (local-first, no backend).
- Tauri packaging is scaffolded (icons + CSP configured); a native build needs
  Rust/Cargo on this machine before `npm run tauri build` can run.
- Lizenz: siehe [LICENSE](LICENSE) — bewusst nicht MIT, damit die Option auf
  ein kommerzielles Produkt offen bleibt.
