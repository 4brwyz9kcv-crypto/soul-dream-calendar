# Fremde Bestandteile

Diese Datei listet alles auf, was nicht aus eigener Hand stammt, und unter
welchen Bedingungen es hier verwendet wird. Die Lizenz des eigenen Codes
steht in `LICENSE`.

## Daten im Repository

| Bestandteil | Herkunft | Lizenz | Status |
|---|---|---|---|
| `src/data/colors.ts` — 949 Farbnamen | [xkcd Color Survey](https://xkcd.com/color/rgb/) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (Public Domain) | unbedenklich |
| `src/data/verses.ts` — Bibelverse | King-James-Bibel (1611) | gemeinfrei | unbedenklich |
| Engel-Grafiken (`src/assets/angels/`) | eigenes Material | siehe `LICENSE` | eigenes Werk |

## Dienste zur Laufzeit

Alle sind optional. Fällt einer aus, greift die eingebaute Offline-Antwort —
die App funktioniert vollständig ohne Netz.

| Dienst | Wofür | Zu beachten |
|---|---|---|
| [Open-Meteo Geocoding](https://open-meteo.com/) | Geburtsort suchen | [CC BY 4.0](https://open-meteo.com/en/license), kein Schlüssel nötig |
| [Wikipedia (de)](https://de.wikipedia.org/) | „An diesem Tag" | Texte CC BY-SA 4.0 |
| [Numbers API](http://numbersapi.com/) | Zahlen-Fakt | frei nutzbar |
| [PokéAPI](https://pokeapi.co/) | Pokémon des Tages | **siehe unten** |
| [OpenAI](https://openai.com/) | Engelsbotschaften | nur mit eigenem Schlüssel des Nutzers |

## Pokémon — vor einer Veröffentlichung klären

Die PokéAPI selbst ist frei nutzbar, aber **die ausgelieferten Sprites und die
Namen sind Material von Nintendo, Game Freak und The Pokémon Company**. Die
API stellt sie ohne eigene Rechtsübertragung bereit.

Für ein privates Projekt ist das in der Praxis unproblematisch. Für ein
Produkt, das verkauft, beworben oder in einen App-Store gestellt wird, ist es
ein echtes markenrechtliches Risiko.

Deshalb gibt es den Schalter **Einstellungen → „Pokémon des Tages zeigen"**.
Ist er aus, wird die PokéAPI nicht angefragt und nichts davon angezeigt; das
Tagesorakel bleibt in allen anderen Punkten identisch, weil der deterministische
Startwert davon unabhängig ist.

Empfehlung vor einer kommerziellen Veröffentlichung: den Schalter
standardmäßig auf „aus" setzen (`showPokemon: false` in `defaultSettings`)
oder das Feature durch eigene Kreaturen ersetzen.

## Abhängigkeiten

Laufzeit: `react`, `react-dom` (MIT), `lucide-react` (ISC).
Build und Test: `vite`, `vitest`, `typescript`, `@vitejs/plugin-react`,
`@testing-library/react`, `jsdom`, `sharp`, `@tauri-apps/cli` — alle MIT oder
Apache-2.0, und keine davon landet im ausgelieferten Bundle.

`npm run licenses` gibt die vollständige, aktuelle Liste aus.
