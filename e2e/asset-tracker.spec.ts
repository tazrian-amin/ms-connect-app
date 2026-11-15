import { addAsset, assetMenu, connectSerial, nameField, tab, tabs } from "./support/assets";
import { enableEdits, settingCard, startDemo, statusChip } from "./support/devices";
import { expect, test } from "./support/test";
import { FakeTrackerApi } from "./support/tracker-api";

/*
 * The asset tracker page: assets as tabs, each linked to a tracker through the cloud by serial
 * number (lib/asset-tracker, lib/cloud). The backend is faked (support/tracker-api.ts).
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/devices/asset-tracker");
  await expect(page.getByRole("heading", { level: 1, name: "Asset Tracker" })).toBeVisible();
});

test.describe("assets", () => {
  test("starts empty, and the first asset gets a suggested name", async ({ page }) => {
    await expect(page.getByText("No assets yet")).toBeVisible();
    await page.getByRole("button", { name: "Add a new asset" }).click();
    await expect(nameField(page)).toHaveValue("Asset 1");
    await page.getByRole("dialog", { name: "Add asset" }).getByRole("button", { name: "Add" }).click();

    await expect(tabs(page)).toHaveCount(1);
    await expect(tab(page, "Asset 1")).toHaveAttribute("aria-selected", "true");
  });

  test("checks the name", async ({ page }) => {
    await addAsset(page, "Truck");
    await page.getByRole("button", { name: "Add asset" }).click();
    const dialog = page.getByRole("dialog", { name: "Add asset" });

    await nameField(page).fill("   ");
    await expect(dialog.getByText("Enter a name.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Add" })).toBeDisabled();

    await nameField(page).fill("TRUCK ");
    await expect(dialog.getByText("Another asset already has this name.")).toBeVisible();

    await nameField(page).fill("Loader");
    await dialog.getByRole("button", { name: "Add" }).click();
    await expect(tabs(page)).toHaveText([/Truck/, /Loader/]);
  });

  test("are kept after a reload, in order", async ({ page }) => {
    await addAsset(page, "Truck");
    await addAsset(page, "Loader");
    await addAsset(page, "Dozer");
    await page.reload();
    await expect(tabs(page)).toHaveText([/Truck/, /Loader/, /Dozer/]);
  });

  test("can be renamed", async ({ page }) => {
    await addAsset(page, "Truck");
    await assetMenu(page, "Rename");
    const dialog = page.getByRole("dialog", { name: "Rename asset" });
    await expect(nameField(page)).toHaveValue("Truck");
    await nameField(page).fill("Haul truck");
    await dialog.getByRole("button", { name: "Rename" }).click();
    await expect(tabs(page)).toHaveText([/Haul truck/]);
  });

  test("can be moved left and right", async ({ page }) => {
    await addAsset(page, "A");
    await addAsset(page, "B");
    // The new asset is selected, and it's last, so it can only move left.
    await page.getByRole("button", { name: "More actions for B" }).click();
    await expect(page.getByRole("menuitem", { name: "Move right" })).toBeDisabled();
    await page.getByRole("menuitem", { name: "Move left" }).click();
    await expect(tabs(page)).toHaveText([/B/, /A/]);

    await assetMenu(page, "Move right");
    await expect(tabs(page)).toHaveText([/A/, /B/]);
  });

  test("removing one selects its neighbour, and removing the last shows the empty state", async ({ page }) => {
    await addAsset(page, "A");
    await addAsset(page, "B");
    await tab(page, "A").click();

    await assetMenu(page, "Remove asset");
    const confirm = page.getByRole("dialog", { name: "Remove A?" });
    await confirm.getByRole("button", { name: "Remove" }).click();
    await expect(tabs(page)).toHaveText([/B/]);
    await expect(tab(page, "B")).toHaveAttribute("aria-selected", "true");

    await assetMenu(page, "Remove asset");
    await page.getByRole("dialog", { name: "Remove B?" }).getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("No assets yet")).toBeVisible();
  });

  test("removing can be cancelled", async ({ page }) => {
    await addAsset(page, "A");
    await assetMenu(page, "Remove asset");
    await page.getByRole("dialog", { name: "Remove A?" }).getByRole("button", { name: "Cancel" }).click();
    await expect(tabs(page)).toHaveText([/A/]);
  });
});

test.describe("connecting through the cloud", () => {
  let api: FakeTrackerApi;

  test.beforeEach(async ({ page }) => {
    api = new FakeTrackerApi();
    api.addTracker("AT-100", { device_name: "Loader 7", battery_percentage: 76 });
    api.addTracker("AT-200", { device_name: "Truck 3" });
    await api.install(page);
    await addAsset(page, "Loader");
  });

  test("asks for a serial number", async ({ page }) => {
    const dialog = await connectSerial(page, "  ");
    await expect(dialog.getByText("Enter the serial number.")).toBeVisible();
  });

  test("says when no tracker has that serial number", async ({ page }) => {
    const dialog = await connectSerial(page, "NOPE-1");
    await expect(dialog.getByText("No tracker with serial number NOPE-1 was found.")).toBeVisible();
    await expect(statusChip(page, "Not connected")).toBeVisible();
  });

  test("passes on the backend's error", async ({ page }) => {
    api.failWith = { status: 500, error: "database down" };
    const dialog = await connectSerial(page, "AT-100");
    await expect(dialog.getByText("The cloud service couldn't answer (database down).")).toBeVisible();
  });

  test("says when the backend can't be reached", async ({ page }) => {
    api.unreachable = true;
    const dialog = await connectSerial(page, "AT-100");
    await expect(
      dialog.getByText("Couldn't reach the cloud service. Check your internet connection and try again."),
    ).toBeVisible();
  });

  test("shows the tracker's latest report", async ({ page }) => {
    const dialog = await connectSerial(page, "AT-100");
    await expect(dialog).toBeHidden();
    await expect(statusChip(page, "Connected")).toBeVisible();
    await expect(page.getByText("AT-100", { exact: true })).toBeVisible();

    // The dashboard's widgets.
    await expect(page.getByRole("paragraph").filter({ hasText: /^Loader 7$/ })).toBeVisible();
    await expect(statusChip(page, "Charging")).toBeVisible();
    await expect(page.getByRole("paragraph").filter({ hasText: /^Latitude40\.8691°$/ })).toBeVisible();
  });

  test("follows new reports", async ({ page }) => {
    await page.clock.install();
    await page.reload();
    await connectSerial(page, "AT-100");
    await expect(statusChip(page, "Stationary")).toBeVisible();

    api.report("AT-100", { is_moving: true, battery_percentage: 75 });
    await page.clock.fastForward(16_000); // The tracker is polled every 15 s.
    await expect(statusChip(page, "Moving")).toBeVisible();
  });

  test("shows the last data as offline while the backend can't be reached", async ({ page }) => {
    await page.clock.install();
    await page.reload();
    await connectSerial(page, "AT-100");
    await expect(statusChip(page, "Connected")).toBeVisible();

    api.unreachable = true;
    await page.clock.fastForward(16_000);
    await expect(statusChip(page, "Offline")).toBeVisible();
    await expect(page.getByText("The cloud can't be reached right now")).toBeVisible();
    await expect(page.getByRole("paragraph").filter({ hasText: /^Loader 7$/ })).toBeVisible();

    api.unreachable = false;
    await page.clock.fastForward(16_000);
    await expect(statusChip(page, "Connected")).toBeVisible();
  });

  // Picked up again as the app starts (components/cloud/resume-cloud-links.tsx).
  test("stays linked after a reload", async ({ page }) => {
    await connectSerial(page, "AT-100");
    await expect(statusChip(page, "Connected")).toBeVisible();

    await page.reload();
    await expect(statusChip(page, "Connected")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole("paragraph").filter({ hasText: /^Loader 7$/ })).toBeVisible();
  });

  test("after a reload, shows the last data while the backend can't be reached", async ({ page }) => {
    await connectSerial(page, "AT-100");
    await expect(statusChip(page, "Connected")).toBeVisible();

    api.unreachable = true;
    await page.reload();
    await expect(statusChip(page, "Offline")).toBeVisible();
    await expect(page.getByRole("paragraph").filter({ hasText: /^Loader 7$/ })).toBeVisible();
  });

  test("the homepage card shows the linked tracker as connected", async ({ page }) => {
    await connectSerial(page, "AT-100");
    await expect(statusChip(page, "Connected")).toBeVisible();

    await page.goto("/");
    // Cards start hidden, so find the asset tracker's card by its chip.
    await expect(statusChip(page, "Connected")).toHaveCount(1);
  });

  test("prefills the serial number used last time", async ({ page }) => {
    await connectSerial(page, "AT-100");
    await expect(statusChip(page, "Connected")).toBeVisible();
    await page.getByRole("button", { name: "Disconnect" }).click();
    await expect(statusChip(page, "Not connected")).toBeVisible();

    await page.getByRole("button", { name: "Connect", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Serial number" })).toHaveValue("AT-100");
  });

  test("won't show one tracker on two assets", async ({ page }) => {
    await connectSerial(page, "AT-100");
    await expect(statusChip(page, "Connected")).toBeVisible();

    await addAsset(page, "Spare");
    const dialog = await connectSerial(page, "at-100");
    await expect(dialog.getByText("The device with serial number at-100 is already connected as Loader.")).toBeVisible();
  });

  test("each asset keeps its own tracker", async ({ page }) => {
    await connectSerial(page, "AT-100");
    await expect(statusChip(page, "Connected")).toBeVisible();
    await addAsset(page, "Truck");
    await connectSerial(page, "AT-200");
    await expect(page.getByText("Truck 3").first()).toBeVisible();

    await tab(page, "Loader").click();
    await expect(page.getByText("Loader 7").first()).toBeVisible();
    await expect(page.getByText("AT-100", { exact: true })).toBeVisible();
  });

  test("sends a changed setting to the tracker and shows what it reports back", async ({ page }) => {
    await connectSerial(page, "AT-100");
    await expect(statusChip(page, "Connected")).toBeVisible();
    await enableEdits(page);

    const card = settingCard(page, "Moving interval");
    await expect(card.getByText("Reported by the device: 60 s")).toBeVisible();
    await card.getByRole("spinbutton", { name: "Interval" }).fill("120");
    await card.getByRole("button", { name: "Apply" }).click();

    await expect(card.getByText("Reported by the device: 120 s")).toBeVisible();
    expect(api.commands).toContainEqual({ serial: "AT-100", body: { set_moving_interval_s: "120" } });
  });

  test("disconnecting forgets the link", async ({ page }) => {
    await connectSerial(page, "AT-100");
    await expect(statusChip(page, "Connected")).toBeVisible();
    await page.getByRole("button", { name: "Disconnect" }).click();
    await expect(statusChip(page, "Not connected")).toBeVisible();

    await page.reload();
    await expect(statusChip(page, "Not connected")).toBeVisible();
  });

  test("removing an asset ends its link", async ({ page }) => {
    await connectSerial(page, "AT-100");
    await expect(statusChip(page, "Connected")).toBeVisible();
    await assetMenu(page, "Remove asset");
    await page.getByRole("dialog", { name: "Remove Loader?" }).getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("No assets yet")).toBeVisible();

    // The tracker is free to link to a new asset.
    await addAsset(page, "Loader again");
    await connectSerial(page, "AT-100");
    await expect(statusChip(page, "Connected")).toBeVisible();
  });
});

test.describe("location history", () => {
  const HOUR = 60 * 60 * 1000;

  test("from the cloud: splits the route into stops and trips", async ({ page }) => {
    const now = Date.now();
    const api = new FakeTrackerApi();
    // Parked, a drive of about 1.1 km, parked again.
    api.addTracker("AT-100", {}, [
      { time: now - 5 * HOUR, latitude: 40.86, longitude: -85.16, moving: false },
      { time: now - 4 * HOUR, latitude: 40.86, longitude: -85.16, moving: true },
      { time: now - 4 * HOUR + 60_000, latitude: 40.865, longitude: -85.16, moving: true },
      { time: now - 4 * HOUR + 120_000, latitude: 40.87, longitude: -85.16, moving: false },
      { time: now - 1 * HOUR, latitude: 40.87, longitude: -85.16, moving: false },
    ]);
    await api.install(page);
    await addAsset(page, "Loader");
    await connectSerial(page, "AT-100");
    await expect(statusChip(page, "Connected")).toBeVisible();

    await page.getByRole("button", { name: "History" }).click();
    await expect(
      page.getByText("5 locations · about 1.1 km travelled · moving 2 min · stopped 3 h 58 min at 2 stops"),
    ).toBeVisible();

    // Already parked when the period began, so "at least"; still parked at the end, so "so far".
    const timeline = page.getByRole("complementary", { name: "Stops and trips" });
    await expect(timeline.getByRole("heading", { name: "Stops and trips · 2 stops" })).toBeVisible();
    await expect(timeline.getByRole("button", { name: /^Stop 1 Stopped · at least 1 h/ })).toBeVisible();
    await expect(timeline.getByRole("button", { name: /^Moving · 2 min · 1\.1 km/ })).toBeVisible();
    await expect(timeline.getByRole("button", { name: /^Stop 2 Stopped · 2 h 58 min so far/ })).toBeVisible();

    // The list can be folded away.
    await timeline.getByRole("button", { name: "Hide stops and trips" }).click();
    await expect(timeline.getByRole("button", { name: /^Moving/ })).toHaveCount(0);
    await expect(timeline.getByRole("button", { name: "Show stops and trips" })).toBeVisible();
  });

  test("from the cloud: says when nothing was recorded", async ({ page }) => {
    const api = new FakeTrackerApi();
    api.addTracker("AT-100");
    await api.install(page);
    await addAsset(page, "Loader");
    await connectSerial(page, "AT-100");
    await expect(statusChip(page, "Connected")).toBeVisible();

    await page.getByRole("button", { name: "History" }).click();
    await expect(page.getByText("No locations were recorded in this period.")).toBeVisible();
  });

  test("asks to connect first", async ({ page }) => {
    await addAsset(page, "Loader");
    await page.getByRole("button", { name: "History" }).click();
    await expect(page.getByText("Connect the tracker, or try the demo, to see where it has been.")).toBeVisible();
  });

  test("in the demo: shows a made-up week, and the quick ranges change the period", async ({ page }) => {
    await addAsset(page, "Loader");
    await startDemo(page);
    await page.getByRole("button", { name: "History" }).click();

    const summary = page.getByText(/^[\d,]+ locations? · about [\d.,]+ km travelled/);
    await expect(summary).toBeVisible();
    const day = await summary.textContent();

    await page.getByRole("group", { name: "Quick ranges" }).getByRole("button", { name: "Last 7 days" }).click();
    await expect(summary).not.toHaveText(day!);
  });
});
