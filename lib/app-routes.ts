import { devices } from "@/lib/homepage/devices";

export const DEVICE_PAGE_PREFIX = "/devices/";

export const devicePages = devices.map(({ slug }) => `${DEVICE_PAGE_PREFIX}${slug}`);

/** Every page in the app. All are static, so all are cached for offline use. */
export const appRoutes = ["/", ...devicePages];

/** The pages a visitor may open: device pages only in view mode. */
export function accessiblePages(viewMode: boolean): string[] {
  return viewMode ? appRoutes : ["/"];
}
