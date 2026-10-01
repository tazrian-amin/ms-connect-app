import { devices } from "@/lib/homepage/devices";

/** Every page in the app. All are static, so all are cached for offline use. */
export const appRoutes = ["/", ...devices.map(({ slug }) => `/devices/${slug}`)];
