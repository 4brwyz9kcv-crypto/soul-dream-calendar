// Geburtsort geocoding suite: Open-Meteo response parsing (fetch stubbed —
// no real network) and the built-in offline fallback with folded prefix
// matching. Mirrors the live.ts test conventions.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { offlinePlaces, offlinePlaceSearch, searchPlaces } from "../services/geo";

function jsonResponse(data: unknown) {
  return { ok: true, status: 200, json: async () => data };
}

const fetchMock = vi.fn();

describe("searchPlaces (live, fetch stubbed)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses Open-Meteo suggestions incl. name/label/coords/timezone", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        results: [
          {
            name: "Wien",
            latitude: 48.20849,
            longitude: 16.37208,
            timezone: "Europe/Vienna",
            country: "Österreich",
            admin1: "Wien"
          },
          {
            name: "Wiener Neustadt",
            latitude: 47.81,
            longitude: 16.24,
            timezone: "Europe/Vienna",
            country: "Österreich"
          }
        ]
      })
    );

    const result = await searchPlaces("Wien");
    expect(result.status).toBe("live");
    expect(result.places).toHaveLength(2);
    expect(result.places[0]).toEqual({
      name: "Wien",
      label: "Wien, Wien, Österreich",
      lat: 48.20849,
      lon: 16.37208,
      timezone: "Europe/Vienna"
    });
    expect(result.places[1].label).toBe("Wiener Neustadt, Österreich");
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("geocoding-api.open-meteo.com/v1/search");
    expect(url).toContain("name=Wien");
    expect(url).toContain("language=de");
  });

  it("drops malformed rows (missing coords or timezone)", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        results: [
          { name: "Kaputt", latitude: 1 }, // no lon, no timezone
          { name: "Halbgar", latitude: 1, longitude: 2 }, // no timezone
          { name: "Ganz", latitude: 1, longitude: 2, timezone: "Europe/Berlin" }
        ]
      })
    );
    const result = await searchPlaces("irgendwas");
    expect(result.status).toBe("live");
    expect(result.places.map((p) => p.name)).toEqual(["Ganz"]);
  });

  it("falls back to the offline list when fetch rejects", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const result = await searchPlaces("Wien");
    expect(result.status).toBe("offline");
    expect(result.places[0]?.name).toBe("Wien");
    expect(result.places[0]?.timezone).toBe("Europe/Vienna");
  });

  it("falls back to the offline list when the live result is empty", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ results: [] }));
    const result = await searchPlaces("Zürich");
    expect(result.status).toBe("offline");
    expect(result.places[0]?.name).toBe("Zürich");
  });

  it("skips the network entirely for queries shorter than 2 characters", async () => {
    const result = await searchPlaces("W");
    expect(result.places).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("offlinePlaceSearch (built-in city list)", () => {
  it("covers D-A-CH thoroughly and ships lat/lon/IANA timezone per city", () => {
    expect(offlinePlaces.length).toBeGreaterThanOrEqual(60);
    for (const place of offlinePlaces) {
      expect(place.name.length).toBeGreaterThan(0);
      expect(Number.isFinite(place.lat)).toBe(true);
      expect(Number.isFinite(place.lon)).toBe(true);
      expect(place.timezone).toMatch(/^[A-Za-z_]+\/[A-Za-z_/-]+$/);
    }
    const names = offlinePlaces.map((p) => p.name);
    for (const required of ["Berlin", "Hamburg", "München", "Köln", "Wien", "Graz", "Salzburg", "Innsbruck", "Zürich", "Bern", "Basel", "Genf", "London", "Tokio"]) {
      expect(names).toContain(required);
    }
  });

  it("matches by prefix", () => {
    expect(offlinePlaceSearch("Wie").map((p) => p.name)).toContain("Wien");
    expect(offlinePlaceSearch("Salz")[0]?.name).toBe("Salzburg");
    expect(offlinePlaceSearch("Xyzzy")).toEqual([]);
    expect(offlinePlaceSearch("")).toEqual([]);
  });

  it("folds umlauts both ways (Zür/Zuer/Zur -> Zürich, Muen/Mun -> München)", () => {
    expect(offlinePlaceSearch("Zür")[0]?.name).toBe("Zürich");
    expect(offlinePlaceSearch("Zuer")[0]?.name).toBe("Zürich");
    expect(offlinePlaceSearch("Zur")[0]?.name).toBe("Zürich");
    expect(offlinePlaceSearch("Muen")[0]?.name).toBe("München");
    expect(offlinePlaceSearch("Mün")[0]?.name).toBe("München");
    expect(offlinePlaceSearch("mun")[0]?.name).toBe("München");
  });

  it("caps the result list at 5", () => {
    // "B" prefixes: Bremen, Bielefeld, Bonn, Bochum, Bregenz, Bern, Basel, …
    expect(offlinePlaceSearch("B").length).toBeLessThanOrEqual(5);
  });

  it("Wien carries the coordinates the Aszendent math needs", () => {
    const wien = offlinePlaceSearch("Wien")[0];
    expect(wien?.lat).toBeCloseTo(48.208, 2);
    expect(wien?.lon).toBeCloseTo(16.373, 2);
    expect(wien?.timezone).toBe("Europe/Vienna");
  });
});
