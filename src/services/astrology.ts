import type { BirthPlace } from "../types";
import { zodiacSign, zodiacSignFromLongitude, type ZodiacSign } from "./horoscope";

/**
 * Real positional astronomy for the "großen Drei" (Sonne / Mond / Aszendent),
 * dependency-free and precise to sign level:
 *
 *  - Local birth time -> UTC via the IANA timezone shipped with the browser
 *    (Intl.DateTimeFormat formats a candidate UTC instant into the zone; the
 *    wall-clock difference is the historical offset, iterated once to
 *    converge across DST edges). Without a timezone the offset degrades to
 *    round(lon/15) hours — solar time, so results are marked "ungefähr".
 *  - Julian Date, GMST and obliquity from the standard IAU 1982 polynomials
 *    (Meeus, "Astronomical Algorithms", ch. 12/22).
 *    Validated: JD(2000-01-01 12:00 UTC) = 2451545.0 exactly and
 *    GMST(JD 2446895.5 = 1987-04-10 0h UT) = 197.693195° (Meeus example 12.a).
 *  - Aszendent: λ_asc = atan2( cos(RAMC), −( sin(RAMC)·cos ε + tan φ·sin ε ) ).
 *    NOTE the quadrant variant: the frequently quoted
 *    atan2(−cos RAMC, sin RAMC·cos ε + tan φ·sin ε) returns the DESCENDANT
 *    (exactly 180° off) — verified against three Rodden-AA documented charts:
 *      Albert Einstein   1879-03-14 11:30 LMT Ulm      -> 101.6° (11°38' Krebs,
 *        astro-databank lists Cancer rising ~11°)
 *      Kurt Cobain       1967-02-20 19:38 PST Aberdeen -> 173.3° (Jungfrau,
 *        documented Virgo rising)
 *      Elizabeth II      1926-04-21 02:40 BST London   -> 291.4° (21° Steinbock,
 *        documented 21° Capricorn rising)
 *    plus the analytic equator identities (lat 0: RAMC 0/90/180/270 ->
 *    Asc 90/180/270/0).
 *  - Mondzeichen: the classic low-precision lunar longitude (Astronomical
 *    Almanac / truncated ELP series, all terms ≥ 0.1°, accuracy ~0.3° —
 *    plenty for sign level). The series below is the corrected almanac form:
 *    the evection argument is 259.26° − 413335.36·T (a widely circulated
 *    transcription uses 100.74°, which is wrong) and the solar-anomaly term
 *    −0.186·sin(357.53 + 35999.05·T) is required. Validated:
 *      1992-04-12 0h TD  -> 133.25° vs. Meeus ex. 47.a published 133.1627°
 *      2015-09-28 02:47Z (total lunar eclipse)  -> 4.4° Widder (sun 184.7°)
 *      2024-04-08 18:18Z (total solar eclipse)  -> 19.6° Widder (conj. sun)
 *      Einstein moon 254.4° (documented ~14° Schütze), Elizabeth II moon
 *      132.1° (documented ~12° Löwe), Cobain moon 103.5° (documented Krebs).
 */

const DEG2RAD = Math.PI / 180;

/** Normalizes any angle in degrees into [0, 360). */
export function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

/** Julian Date of a UTC instant given as Unix epoch milliseconds. */
export function julianDate(utcMs: number): number {
  return utcMs / 86400000 + 2440587.5;
}

/**
 * Greenwich Mean Sidereal Time in degrees (IAU 1982, Meeus 12.4),
 * normalized to [0, 360).
 */
export function gmstDegrees(jd: number): number {
  const d = jd - 2451545.0;
  const t = d / 36525;
  return normalizeDegrees(
    280.46061837 + 360.98564736629 * d + 0.000387933 * t * t - (t * t * t) / 38710000
  );
}

/** Mean obliquity of the ecliptic in degrees (linear term, per assignment). */
export function obliquityDegrees(jd: number): number {
  const t = (jd - 2451545.0) / 36525;
  return 23.4392911 - 0.0130042 * t;
}

/**
 * Ecliptic longitude of the ascendant from RAMC (= local sidereal time in
 * degrees), geographic latitude and obliquity — the pure trigonometric core,
 * exported for the analytic identity tests (equator: Asc = RAMC + 90°).
 * Latitude is clamped just short of the poles where tan(φ) degenerates.
 */
export function ascendantFromRamc(ramcDeg: number, latDeg: number, epsDeg: number): number {
  const ramc = normalizeDegrees(ramcDeg) * DEG2RAD;
  const eps = epsDeg * DEG2RAD;
  const phi = Math.max(-89.9, Math.min(89.9, latDeg)) * DEG2RAD;
  const y = Math.cos(ramc);
  const x = -(Math.sin(ramc) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps));
  return normalizeDegrees(Math.atan2(y, x) / DEG2RAD);
}

/**
 * Ecliptic longitude of the ascendant for a UTC instant and geographic
 * position (longitude east-positive): RAMC = GMST + lon.
 */
export function ascendantLongitude(utcMs: number, latDeg: number, lonDeg: number): number {
  const jd = julianDate(utcMs);
  return ascendantFromRamc(gmstDegrees(jd) + lonDeg, latDeg, obliquityDegrees(jd));
}

/**
 * Low-precision geocentric ecliptic longitude of the moon in degrees
 * (truncated ELP series, all terms ≥ 0.1°, ~0.3° accuracy — see module head
 * for the validation table).
 */
export function moonLongitude(utcMs: number): number {
  const t = (julianDate(utcMs) - 2451545.0) / 36525;
  const sinDeg = (deg: number) => Math.sin(normalizeDegrees(deg) * DEG2RAD);
  return normalizeDegrees(
    218.3165 + 481267.8813 * t
    + 6.289 * sinDeg(134.963 + 477198.8676 * t)   // M' (mean anomaly)
    - 1.274 * sinDeg(259.263 - 413335.3554 * t)   // M' - 2D (evection)
    + 0.658 * sinDeg(235.700 + 890534.2230 * t)   // 2D (variation)
    + 0.214 * sinDeg(269.927 + 954397.7352 * t)   // 2M'
    - 0.186 * sinDeg(357.529 + 35999.0503 * t)    // M (annual equation)
    - 0.114 * sinDeg(186.544 + 966404.0350 * t)   // 2F
  );
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Wall-clock offset of an IANA timezone at a UTC instant, in minutes
 * (east-positive, e.g. Europe/Berlin summer = +120). Sub-minute historical
 * LMT offsets (e.g. Europe/Berlin pre-1893 = +53.47) come out fractional.
 * Returns null when the timezone id is unknown to the runtime.
 */
export function utcOffsetMinutes(timeZone: string, utcMs: number): number | null {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    const parts: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
    for (const part of formatter.formatToParts(new Date(utcMs))) {
      parts[part.type] = part.value;
    }
    const wallMs = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    if (!Number.isFinite(wallMs)) return null;
    return (wallMs - utcMs) / 60000;
  } catch {
    return null;
  }
}

/** Documented reduced-accuracy fallback: solar time, round(lon/15) hours. */
export function longitudeFallbackOffsetMinutes(lonDeg: number): number {
  return Math.round(lonDeg / 15) * 60;
}

export interface BirthInstant {
  /** UTC instant of the birth as Unix epoch milliseconds. */
  utcMs: number;
  /**
   * True when the conversion could NOT use a real historical timezone
   * lookup (missing/unknown zone -> lon/15 solar time or plain UTC) or the
   * birth time itself was assumed — i.e. the result is "ungefähr".
   */
  approximate: boolean;
}

/**
 * Converts a local birth date + time (+ place) into a UTC instant.
 *
 * With an IANA timezone the historical offset is resolved via Intl: format a
 * candidate UTC instant into the zone, compare wall clocks, subtract, and
 * iterate once more so DST transitions around the birth converge (fixed
 * point after ≤ 2 steps for every real zone). Without a usable timezone the
 * offset degrades to round(lon/15) hours (solar time), without any place to
 * plain UTC — both marked approximate. Returns null for unparseable input.
 */
export function birthInstantUtc(
  birthDate: string,
  birthTime: string,
  place?: Pick<BirthPlace, "lon" | "timezone">
): BirthInstant | null {
  const dateMatch = DATE_PATTERN.exec(birthDate);
  const timeMatch = TIME_PATTERN.exec(birthTime);
  if (!dateMatch || !timeMatch) return null;
  const wallMs = Date.UTC(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2])
  );
  if (!Number.isFinite(wallMs)) return null;

  if (place?.timezone) {
    const firstOffset = utcOffsetMinutes(place.timezone, wallMs);
    if (firstOffset !== null) {
      const guess = wallMs - firstOffset * 60000;
      const refined = utcOffsetMinutes(place.timezone, guess) ?? firstOffset;
      return { utcMs: wallMs - refined * 60000, approximate: false };
    }
  }
  if (place && Number.isFinite(place.lon)) {
    return { utcMs: wallMs - longitudeFallbackOffsetMinutes(place.lon) * 60000, approximate: true };
  }
  return { utcMs: wallMs, approximate: true };
}

/** A zodiac sign together with the exact ecliptic longitude it came from. */
export interface SignPosition extends ZodiacSign {
  longitude: number;
  /** True when computed via a reduced-accuracy path ("ungefähr"). */
  approximate: boolean;
}

export interface BigThree {
  /** Sun sign from the classic almanac date boundaries (needs birthDate). */
  sun: ZodiacSign | null;
  /**
   * Moon sign from the real lunar longitude. Needs birthDate; without a
   * birth time 12:00 local is assumed (the moon moves only ~13°/day, so the
   * sign is usually still right) and the result is marked approximate, as it
   * is when no timezone-based local->UTC conversion was possible.
   */
  moon: SignPosition | null;
  /**
   * Ascendant sign — needs birthDate + a REAL birthTime AND a place
   * (lat/lon): the ascendant sweeps the full zodiac once per day, so an
   * assumed noon would be meaningless here.
   */
  ascendant: SignPosition | null;
}

/**
 * The astrological "großen Drei" (Sonne / Mond / Aszendent) for a person.
 * Every part degrades gracefully to null when its inputs are missing, so the
 * UI can show friendly prompts instead of wrong numbers.
 */
export function bigThree(
  birthDate?: string,
  birthTime?: string,
  birthPlace?: BirthPlace
): BigThree {
  const sun = zodiacSign(birthDate);
  if (!sun || !birthDate) return { sun: sun ?? null, moon: null, ascendant: null };

  const hasExactTime = birthTime !== undefined && TIME_PATTERN.test(birthTime);
  const instant = birthInstantUtc(birthDate, hasExactTime ? birthTime : "12:00", birthPlace);
  if (!instant) return { sun, moon: null, ascendant: null };

  const moonLon = moonLongitude(instant.utcMs);
  const moon: SignPosition = {
    ...zodiacSignFromLongitude(moonLon),
    longitude: moonLon,
    approximate: !hasExactTime || instant.approximate
  };

  let ascendant: SignPosition | null = null;
  if (
    hasExactTime &&
    birthPlace &&
    Number.isFinite(birthPlace.lat) &&
    Number.isFinite(birthPlace.lon)
  ) {
    const ascLon = ascendantLongitude(instant.utcMs, birthPlace.lat, birthPlace.lon);
    ascendant = {
      ...zodiacSignFromLongitude(ascLon),
      longitude: ascLon,
      approximate: instant.approximate
    };
  }

  return { sun, moon, ascendant };
}
