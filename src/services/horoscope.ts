import { dayColors } from "../data/colors";
import { stableSeed, toDayKey } from "./dates";
import { mulberry32 } from "./markov";
import { isMasterNumber, reduceDigits } from "./numerology";

/**
 * Horoskop engine: western zodiac sign, classic life-path number and a
 * deterministic German daily horoscope composed from seeded fragment pools.
 * Everything is local, dependency-free and reproducible: same sign + date +
 * personal seed always yields the same text, lucky number and lucky color.
 *
 * Implemented zodiac boundaries (tropical, the common German almanac dates):
 *   Widder      ♈  21.03. – 19.04.   Feuer
 *   Stier       ♉  20.04. – 20.05.   Erde
 *   Zwillinge   ♊  21.05. – 20.06.   Luft
 *   Krebs       ♋  21.06. – 22.07.   Wasser
 *   Löwe        ♌  23.07. – 22.08.   Feuer
 *   Jungfrau    ♍  23.08. – 22.09.   Erde
 *   Waage       ♎  23.09. – 22.10.   Luft
 *   Skorpion    ♏  23.10. – 21.11.   Wasser
 *   Schütze     ♐  22.11. – 21.12.   Feuer
 *   Steinbock   ♑  22.12. – 19.01.   Erde
 *   Wassermann  ♒  20.01. – 18.02.   Luft
 *   Fische      ♓  19.02. – 20.03.   Wasser
 */

export type ZodiacElement = "Feuer" | "Erde" | "Luft" | "Wasser";

export interface ZodiacSign {
  id: string;
  /** German sign name. */
  name: string;
  /** Unicode glyph ♈…♓. */
  glyph: string;
  /** Human-readable date range, e.g. "21.03. – 19.04." */
  range: string;
  element: ZodiacElement;
}

interface ZodiacDefinition extends ZodiacSign {
  /** Inclusive start as [month, day]. */
  from: readonly [number, number];
  /** Inclusive end as [month, day]. */
  to: readonly [number, number];
}

const zodiacSigns: readonly ZodiacDefinition[] = [
  { id: "widder", name: "Widder", glyph: "♈", element: "Feuer", from: [3, 21], to: [4, 19], range: "21.03. – 19.04." },
  { id: "stier", name: "Stier", glyph: "♉", element: "Erde", from: [4, 20], to: [5, 20], range: "20.04. – 20.05." },
  { id: "zwillinge", name: "Zwillinge", glyph: "♊", element: "Luft", from: [5, 21], to: [6, 20], range: "21.05. – 20.06." },
  { id: "krebs", name: "Krebs", glyph: "♋", element: "Wasser", from: [6, 21], to: [7, 22], range: "21.06. – 22.07." },
  { id: "loewe", name: "Löwe", glyph: "♌", element: "Feuer", from: [7, 23], to: [8, 22], range: "23.07. – 22.08." },
  { id: "jungfrau", name: "Jungfrau", glyph: "♍", element: "Erde", from: [8, 23], to: [9, 22], range: "23.08. – 22.09." },
  { id: "waage", name: "Waage", glyph: "♎", element: "Luft", from: [9, 23], to: [10, 22], range: "23.09. – 22.10." },
  { id: "skorpion", name: "Skorpion", glyph: "♏", element: "Wasser", from: [10, 23], to: [11, 21], range: "23.10. – 21.11." },
  { id: "schuetze", name: "Schütze", glyph: "♐", element: "Feuer", from: [11, 22], to: [12, 21], range: "22.11. – 21.12." },
  { id: "steinbock", name: "Steinbock", glyph: "♑", element: "Erde", from: [12, 22], to: [1, 19], range: "22.12. – 19.01." },
  { id: "wassermann", name: "Wassermann", glyph: "♒", element: "Luft", from: [1, 20], to: [2, 18], range: "20.01. – 18.02." },
  { id: "fische", name: "Fische", glyph: "♓", element: "Wasser", from: [2, 19], to: [3, 20], range: "19.02. – 20.03." }
];

/**
 * Western zodiac sign for an ISO "yyyy-mm-dd" birth date, or null when the
 * input is missing/unparseable. Boundaries are documented in the module head.
 */
export function zodiacSign(birthDate: string | undefined): ZodiacSign | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate ?? "");
  if (!match) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const value = month * 100 + day;
  for (const sign of zodiacSigns) {
    const from = sign.from[0] * 100 + sign.from[1];
    const to = sign.to[0] * 100 + sign.to[1];
    const hit = from <= to ? value >= from && value <= to : value >= from || value <= to;
    if (hit) {
      const { id, name, glyph, range, element } = sign;
      return { id, name, glyph, range, element };
    }
  }
  return null;
}

/**
 * Zodiac sign for an ecliptic longitude in degrees: sign = floor(λ/30) in the
 * classic Widder-first order (0°–30° Widder, 30°–60° Stier, …). Used by the
 * real Mond/Aszendent astronomy in astrology.ts; the almanac DATE boundaries
 * above stay untouched for the sun sign.
 */
export function zodiacSignFromLongitude(longitudeDeg: number): ZodiacSign {
  const normalized = ((longitudeDeg % 360) + 360) % 360;
  const { id, name, glyph, range, element } = zodiacSigns[Math.floor(normalized / 30) % 12];
  return { id, name, glyph, range, element };
}

/**
 * Classic numerology life-path number: digit sum of the full yyyymmdd string,
 * reduced with the legacy reduceDigits (master numbers 11/22 are preserved).
 * Returns null for missing/unparseable dates.
 */
export function lifePathNumber(birthDate: string | undefined): number | null {
  const digits = (birthDate ?? "").replace(/\D/g, "");
  if (digits.length !== 8) return null;
  return reduceDigits(digits);
}

/** Short German one-liner for each life-path number (incl. masters). */
export function lifePathMeaning(value: number): string {
  const meanings: Record<number, string> = {
    1: "Der Pfad der Pionierin und des Anfangs — du gehst zuerst.",
    2: "Der Pfad der Verbindung — du hältst die Leiterbahnen zusammen.",
    3: "Der Pfad des Ausdrucks — deine Kreativität will gesendet werden.",
    4: "Der Pfad des Fundaments — du baust, was bleibt.",
    5: "Der Pfad der Freiheit — Bewegung ist deine Energiequelle.",
    6: "Der Pfad der Fürsorge — du bringst Harmonie in jedes System.",
    7: "Der Pfad der Suche — du liest die verborgenen Schaltpläne.",
    8: "Der Pfad der Kraft — du orchestrierst die großen Ströme.",
    9: "Der Pfad der Weite — deine Seele denkt in ganzen Welten.",
    11: "Meisterzahl der Intuition — dein Empfang reicht weiter als der Verstand.",
    22: "Meisterzahl des Baumeisters — Visionen werden unter deinen Händen real."
  };
  return meanings[value] ?? "";
}

export interface DailyHoroscope {
  /** 3 deterministic German sentences: Thema, Element-Ton, Rat. */
  text: string;
  /** Seeded lucky number 1–99. */
  luckyNumber: number;
  /** Lucky color from the xkcd day-color list. */
  luckyColorName: string;
  luckyColorHex: string;
}

/* --- fragment pools (≥12 per slot, mystisch-warm im Ton der App) ------- */

const themeOpeners: readonly string[] = [
  "Liebe funkt heute leise auf deiner Frequenz – ein ehrlicher Blick genügt, um eine Verbindung zu löten.",
  "Deine Energie läuft heute auf voller Spannung, nutze sie für den ersten mutigen Schritt.",
  "In der Arbeit öffnet sich heute ein Schaltkreis, der lange blockiert war.",
  "Deine Intuition sendet heute klarer als jedes Orakel – hör auf das leise Signal.",
  "Eine Begegnung legt heute eine neue Leiterbahn durch deinen Tag.",
  "Altes Loslassen schafft heute Platz auf deiner inneren Platine.",
  "Ein Gespräch bringt heute mehr Klarheit als tagelanges Grübeln.",
  "Dein Mut wird heute leise geprüft – und ebenso leise belohnt.",
  "Geduld ist heute dein stärkstes Werkzeug im Maschinenraum des Alltags.",
  "Die Sterne takten heute langsamer – gönn deinem Herzen denselben Rhythmus.",
  "Ein kleiner Zufall trägt heute eine größere Botschaft in sich.",
  "Heute lohnt es sich, einem alten Traum neue Spannung zu geben.",
  "Dein Zuhause will heute geordnet werden – innen wie außen.",
  "Kreativität fließt heute wie Strom durch frisch verlötete Bahnen."
];

const elementMiddles: Record<ZodiacElement, readonly string[]> = {
  Feuer: [
    "Als {sign} glüht dein Kern dabei heller als der Rest des Netzes.",
    "Dein {sign}-Feuer gibt dem Tag die Zündspannung, die anderen fehlt.",
    "Was du als {sign} heute anfasst, bekommt Funkenflug – dosiere ihn weise.",
    "Die Glut in dir, {sign}, will nicht bewacht, sondern benutzt werden.",
    "Als {sign} spürst du früh, wo heute Energie verschwendet wird – geh dort zuerst hin.",
    "Dein inneres Feuer, {sign}, wärmt heute auch die, die es nicht zugeben.",
    "Als {sign} brennst du heute für Ideen, nicht für Eile – das ist ein Unterschied.",
    "Die Flamme des {sign} flackert heute nicht, sie steht ruhig und hoch.",
    "Heute schaltet dein {sign}-Temperament vom Sturm auf gerichtete Hitze.",
    "Als {sign} darfst du heute laut denken – dein Funke springt über.",
    "Dein {sign}-Herz läuft heute auf Betriebstemperatur, nicht auf Überhitzung.",
    "Was dich als {sign} heute entflammt, verdient mehr als einen kurzen Blick."
  ],
  Erde: [
    "Als {sign} liegt deine Kraft heute im ruhigen, tragfähigen Fundament.",
    "Dein {sign}-Boden hält heute auch das, was andere fallen lassen.",
    "Als {sign} baust du heute mit kleinen Schritten etwas erstaunlich Großes.",
    "Die Wurzeln des {sign} finden heute Wasser, wo andere nur Staub sehen.",
    "Als {sign} spürst du heute genau, welche Struktur bleiben darf und welche nicht.",
    "Dein {sign}-Pragmatismus ist heute keine Bremse, sondern ein Kompass.",
    "Als {sign} verwandelst du heute Geduld in etwas Greifbares.",
    "Der Fels in dir, {sign}, gibt heute anderen den Halt, den sie suchen.",
    "Als {sign} erkennst du heute den Wert des Langsamen im Takt des Schnellen.",
    "Dein {sign}-Instinkt für das Echte trennt heute Signal von Rauschen.",
    "Als {sign} erntest du heute, was du in stillen Stunden gesät hast.",
    "Was du als {sign} heute ordnest, trägt dich durch die nächste Woche."
  ],
  Luft: [
    "Als {sign} weht dir heute jeder Gedanke frischer und klarer zu.",
    "Dein {sign}-Verstand verbindet heute Punkte, die niemand sonst sieht.",
    "Als {sign} bist du heute das Funknetz zwischen getrennten Welten.",
    "Die Leichtigkeit des {sign} löst heute Knoten, an denen Kraft scheitert.",
    "Als {sign} findest du heute Worte für das, was andere nur ahnen.",
    "Dein {sign}-Wind dreht heute günstig – setz die Segel für Neues.",
    "Als {sign} hörst du heute zwischen den Zeilen die eigentliche Nachricht.",
    "Ideen umkreisen dich heute wie Satelliten, {sign} – wähle eine und lande sie.",
    "Als {sign} bringst du heute Bewegung in festgefahrene Gespräche.",
    "Dein {sign}-Blick von oben zeigt heute den Ausweg aus dem Labyrinth.",
    "Als {sign} tanzt dein Denken heute – gib ihm eine Richtung, keinen Käfig.",
    "Die Neugier des {sign} öffnet heute eine Tür, die verschlossen wirkte."
  ],
  Wasser: [
    "Als {sign} liest du heute die Strömungen unter der Oberfläche zuerst.",
    "Dein {sign}-Gefühl ist heute der genaueste Sensor im ganzen Raum.",
    "Als {sign} heilst du heute mit Zuhören mehr als mit Ratschlägen.",
    "Die Tiefe des {sign} findet heute Schätze, die im Flachen unsichtbar bleiben.",
    "Als {sign} spürst du heute, wem ein stilles Wort mehr hilft als ein lautes.",
    "Dein {sign}-Wasser umfließt heute Hindernisse, statt sich an ihnen zu brechen.",
    "Als {sign} trägst du heute Stimmungen wie Gezeiten – lass sie kommen und gehen.",
    "Der Traum von letzter Nacht will dir als {sign} heute noch etwas sagen.",
    "Als {sign} verwandelst du heute Empfindsamkeit in leise Stärke.",
    "Dein {sign}-Mitgefühl ist heute ein Anker, kein Ballast.",
    "Als {sign} spiegelst du heute anderen, was sie selbst nicht sehen konnten.",
    "Die Flut des {sign} hebt heute alle Boote, die ehrlich gebaut sind."
  ]
};

const adviceEndings: readonly string[] = [
  "Schreib einen Satz dazu in dein Journal, bevor der Tag sich schließt.",
  "Triff die wichtigste Entscheidung vor dem Mittag, die unwichtigste gar nicht.",
  "Atme dreimal tief, dann sende deine Antwort – nicht umgekehrt.",
  "Gönn dir am Abend zehn Minuten ohne Bildschirm und mit offenem Fenster.",
  "Sag heute einem Menschen ehrlich, was du an ihm schätzt.",
  "Trink mehr Wasser als Kaffee und dein Signal bleibt klar.",
  "Lass eine Aufgabe bewusst unerledigt – sie war nie deine.",
  "Geh ein Stück zu Fuß, das dein Tag nicht eingeplant hatte.",
  "Notiere die Idee sofort, sonst nimmt der Nebel sie zurück.",
  "Beende den Tag mit Dank für eine kleine, unscheinbare Sache.",
  "Räum eine einzige Schublade auf – der Rest ordnet sich nach.",
  "Hör das Lied, das dich an dein mutigeres Ich erinnert.",
  "Stell eine Frage mehr, als du heute beantworten willst.",
  "Vertrau dem ersten Impuls beim Kleinen und dem zweiten beim Großen."
];

/**
 * Aszendent-flavored closing sentences, 8 per element with the ascendant sign
 * name woven in via {asz}. Drawn from an OWN seeded stream so the classic
 * three-sentence horoscope (and its lucky picks) stays byte-identical for
 * everyone without an ascendant.
 */
const ascendantAccents: Record<ZodiacElement, readonly string[]> = {
  Feuer: [
    "Dein Aszendent {asz} legt Zündfunken auf deinen ersten Eindruck – nutze ihn beim ersten Hallo.",
    "Mit {asz} am Horizont wirkt dein Auftreten heute wie frisch verlötet: hell und direkt.",
    "Dein Aszendent {asz} schiebt Energie in deine Außenwirkung – andere sehen dein Feuer zuerst.",
    "{asz} im Aufgang macht deinen ersten Schritt heute mutiger, als er sich anfühlt.",
    "Dein Aszendent {asz} funkt Aufbruch: Wer dich heute neu kennenlernt, spürt die Glut sofort.",
    "Der aufsteigende {asz} gibt deiner Stimme heute Zündspannung – sprich das Wichtige zuerst.",
    "Mit Aszendent {asz} trägst du heute eine sichtbare Flamme vor dir her – führe damit, nicht blende.",
    "{asz} am Osthorizont heißt: Dein Anfangsimpuls ist heute dein bestes Werkzeug."
  ],
  Erde: [
    "Dein Aszendent {asz} erdet deinen Auftritt – man vertraut dir heute die schweren Dinge an.",
    "Mit {asz} am Horizont wirkst du heute wie ein sicheres Fundament, auf das andere bauen.",
    "Dein Aszendent {asz} verleiht deiner Präsenz ruhige Tragkraft – nutze sie für ein klares Nein.",
    "{asz} im Aufgang macht dich heute zum Fels im Signalrauschen des Tages.",
    "Der aufsteigende {asz} zeigt der Welt deine verlässliche Seite – halte ein Versprechen sichtbar ein.",
    "Mit Aszendent {asz} beginnt dein Tag geordnet: Struktur ist heute deine Aura.",
    "{asz} am Osthorizont lässt dich heute geerdet erscheinen, selbst wenn es innen funkt.",
    "Dein Aszendent {asz} gibt deinem ersten Eindruck heute Bodenhaftung – Schritt für Schritt gewinnst du."
  ],
  Luft: [
    "Dein Aszendent {asz} legt Leichtigkeit auf deine Worte – heute öffnen Gespräche Türen.",
    "Mit {asz} am Horizont wirkst du heute wie ein offenes Funknetz: Ideen finden dich zuerst.",
    "Dein Aszendent {asz} macht deinen ersten Eindruck heute neugierig und wach – frag einfach nach.",
    "{asz} im Aufgang schenkt dir heute die richtigen Worte im richtigen Moment.",
    "Der aufsteigende {asz} lässt dein Denken sichtbar tanzen – teile eine unfertige Idee.",
    "Mit Aszendent {asz} bist du heute die Brücke zwischen zwei Welten, die sich sonst nicht hören.",
    "{asz} am Osthorizont gibt deiner Erscheinung heute frischen Wind – wechsle bewusst die Perspektive.",
    "Dein Aszendent {asz} sendet auf allen Kanälen Charme – ein kluger Satz reicht heute weit."
  ],
  Wasser: [
    "Dein Aszendent {asz} legt Tiefe in deinen Blick – andere fühlen sich heute von dir verstanden.",
    "Mit {asz} am Horizont wirkt deine Ruhe heute wie ein sicherer Hafen für laute Seelen.",
    "Dein Aszendent {asz} macht deine Empfindsamkeit heute sichtbar – sie ist deine leise Stärke.",
    "{asz} im Aufgang lässt dich heute Stimmungen lesen, bevor Worte fallen.",
    "Der aufsteigende {asz} umgibt dich mit Gezeitenkraft: Du ziehst an, ohne zu ziehen.",
    "Mit Aszendent {asz} spiegelt dein erster Eindruck heute mehr, als du sagst – wähle den Raum weise.",
    "{asz} am Osthorizont schenkt deiner Präsenz heute Traumtiefe – vertraue dem Bild der letzten Nacht.",
    "Dein Aszendent {asz} fließt durch deine Begegnungen – heute heilt Zuhören mehr als jeder Rat."
  ]
};

/**
 * Deterministic German daily horoscope for a sign, date and personal seed:
 * theme opener + element-flavored middle (with the sign name woven in) +
 * concrete advice, plus a seeded lucky number (1–99) and lucky color from
 * the xkcd day-color list.
 *
 * When an ascendant sign is passed (real astronomy, needs Geburtszeit +
 * Geburtsort) a fourth ascendant-flavored sentence is appended from an
 * independent seeded pool — text, lucky number and lucky color of the classic
 * three-sentence horoscope are provably unchanged for callers without one.
 */
export function dailyHoroscope(
  sign: ZodiacSign,
  date: Date,
  pSeed: number,
  ascendant?: ZodiacSign
): DailyHoroscope {
  const key = toDayKey(date);
  const seed = (stableSeed(`horoskop:${key.iso}:${sign.id}`) + pSeed) >>> 0;
  const rand = mulberry32(seed);

  const opener = themeOpeners[Math.floor(rand() * themeOpeners.length)];
  const middlePool = elementMiddles[sign.element];
  const middle = middlePool[Math.floor(rand() * middlePool.length)].replace(/\{sign\}/g, sign.name);
  const advice = adviceEndings[Math.floor(rand() * adviceEndings.length)];

  const luckyNumber = 1 + Math.floor(rand() * 99);
  const luckyColor = dayColors[Math.floor(rand() * dayColors.length)];

  let text = `${opener} ${middle} ${advice}`;
  if (ascendant) {
    const ascRand = mulberry32((stableSeed(`aszendent:${key.iso}:${ascendant.id}`) + pSeed) >>> 0);
    const pool = ascendantAccents[ascendant.element];
    text += ` ${pool[Math.floor(ascRand() * pool.length)].replace(/\{asz\}/g, ascendant.name)}`;
  }

  return {
    text,
    luckyNumber,
    luckyColorName: luckyColor.name,
    luckyColorHex: luckyColor.hex
  };
}

export { isMasterNumber };
