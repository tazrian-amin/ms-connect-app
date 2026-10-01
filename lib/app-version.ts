import packageJson from "@/package.json";

/** Release version, bumped by hand in package.json. */
export const appVersion = packageJson.version;

/** Set per build in next.config.ts; tells apart deploys that share a release version. */
export const buildId = process.env.APP_BUILD_ID ?? "dev";
