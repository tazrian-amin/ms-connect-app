// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

// The asset list lives in localStorage and in module state, so each test loads the module afresh.
let assets: typeof import("./assets");
const stored = () => JSON.parse(localStorage.getItem("asset-tracker:assets") ?? "null");
const names = () => stored().map((asset: { name: string }) => asset.name);

beforeEach(async () => {
  localStorage.clear();
  vi.resetModules();
  assets = await import("./assets");
});

describe("asset names", () => {
  it("suggests the next free number", () => {
    expect(assets.suggestAssetName()).toBe("Asset 1");
    assets.addAsset({ name: "Asset 1" });
    assets.addAsset({ name: "Asset 3" });
    expect(assets.suggestAssetName()).toBe("Asset 4");
    assets.addAsset({ name: "Asset 4" });
    // Three assets, so it tries "Asset 4" first; that's taken, so the next number.
    expect(assets.suggestAssetName()).toBe("Asset 5");
  });

  it("must be filled in, short enough and unique (ignoring case and spaces)", () => {
    expect(assets.validateAssetName("  ")).toBe("Enter a name.");
    expect(assets.validateAssetName("x".repeat(41))).toBe("Use at most 40 characters.");
    expect(assets.validateAssetName("x".repeat(40))).toBeNull();

    const truck = assets.addAsset({ name: " Truck " });
    expect(truck.name).toBe("Truck");
    expect(assets.validateAssetName("truck  ")).toBe("Another asset already has this name.");
    // An asset may keep its own name when renamed.
    expect(assets.validateAssetName("TRUCK", truck.id)).toBeNull();
  });
});

describe("the asset list", () => {
  it("is saved in order", () => {
    assets.addAsset({ name: "A" });
    assets.addAsset({ name: "B" });
    expect(names()).toEqual(["A", "B"]);
  });

  it("renames, moves and removes", () => {
    const a = assets.addAsset({ name: "A" });
    const b = assets.addAsset({ name: "B" });
    const c = assets.addAsset({ name: "C" });

    assets.renameAsset(b.id, "  Bee ");
    expect(names()).toEqual(["A", "Bee", "C"]);

    assets.moveAsset(c.id, 0);
    expect(names()).toEqual(["C", "A", "Bee"]);
    // Out of range moves stop at the ends.
    assets.moveAsset(c.id, 99);
    expect(names()).toEqual(["A", "Bee", "C"]);

    assets.removeAsset(a.id);
    expect(names()).toEqual(["Bee", "C"]);
  });

  it("removing an asset forgets its tracker link", () => {
    const a = assets.addAsset({ name: "A" });
    localStorage.setItem(`ms-connect:cloud-link:asset-tracker:${a.id}`, JSON.stringify({ serialNumber: "AT-1", snapshot: null }));
    assets.removeAsset(a.id);
    expect(localStorage.getItem(`ms-connect:cloud-link:asset-tracker:${a.id}`)).toBeNull();
  });

  it("ignores a corrupt saved list", async () => {
    localStorage.setItem("asset-tracker:assets", JSON.stringify([{ id: 1 }]));
    vi.resetModules();
    assets = await import("./assets");
    expect(assets.suggestAssetName()).toBe("Asset 1");
  });

  it("turns a tracker linked before assets existed into the first asset, named after it", () => {
    localStorage.setItem(
      "ms-connect:cloud-link:asset-tracker",
      JSON.stringify({ serialNumber: "AT-9", snapshot: { deviceId: "AT-9", timestamp: 1, data: { device_name: "Loader 2" } } }),
    );
    assets.adoptEarlierTracker();

    expect(names()).toEqual(["Loader 2"]);
    const [{ id }] = stored();
    expect(localStorage.getItem("ms-connect:cloud-link:asset-tracker")).toBeNull();
    expect(JSON.parse(localStorage.getItem(`ms-connect:cloud-link:asset-tracker:${id}`)!)).toMatchObject({
      serialNumber: "AT-9",
      instanceName: "Loader 2",
    });
  });
});
