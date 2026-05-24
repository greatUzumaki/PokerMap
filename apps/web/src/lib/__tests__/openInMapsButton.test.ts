import { describe, expect, it } from "vitest";
import {
  appleMapsUrl,
  detectPlatform,
  geoIntent,
  googleMapsWebUrl,
  twogisWebUrl,
  urlForPlatform,
  yandexWebUrl,
  type MapsTarget,
} from "@/components/OpenInMapsButton";

const target: MapsTarget = { lat: 59.9, lng: 30.3, name: "Bluff", address: "Фурштатская 44" };

describe("OpenInMapsButton URL builders", () => {
  it("yandex web url", () => {
    expect(yandexWebUrl(target)).toBe("https://yandex.ru/maps/?pt=30.3,59.9&z=17");
  });
  it("2gis web url", () => {
    expect(twogisWebUrl(target)).toBe("https://2gis.ru/spb/geo/30.3,59.9");
  });
  it("google maps web url", () => {
    expect(googleMapsWebUrl(target)).toBe("https://www.google.com/maps/search/?api=1&query=59.9,30.3");
  });
  it("apple maps url encodes address", () => {
    expect(appleMapsUrl(target)).toBe("maps://?daddr=59.9,30.3&q=%D0%A4%D1%83%D1%80%D1%88%D1%82%D0%B0%D1%82%D1%81%D0%BA%D0%B0%D1%8F%2044");
  });
  it("geo intent encodes name", () => {
    expect(geoIntent(target)).toBe("geo:59.9,30.3?q=59.9,30.3(Bluff)");
  });
});

describe("detectPlatform", () => {
  it("ios", () => {
    expect(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)")).toBe("ios");
  });
  it("android", () => {
    expect(detectPlatform("Mozilla/5.0 (Linux; Android 13)")).toBe("android");
  });
  it("desktop", () => {
    expect(detectPlatform("Mozilla/5.0 (Macintosh)")).toBe("desktop");
  });
  it("telegram overrides everything", () => {
    expect(detectPlatform("Mozilla/5.0 (iPhone)", true)).toBe("telegram");
  });
});

describe("urlForPlatform", () => {
  it("ios → apple maps", () => {
    expect(urlForPlatform(target, "ios").startsWith("maps://")).toBe(true);
  });
  it("android → geo:", () => {
    expect(urlForPlatform(target, "android").startsWith("geo:")).toBe(true);
  });
  it("desktop → yandex web", () => {
    expect(urlForPlatform(target, "desktop")).toBe(yandexWebUrl(target));
  });
  it("telegram → yandex web (handled by openLink)", () => {
    expect(urlForPlatform(target, "telegram")).toBe(yandexWebUrl(target));
  });
});
