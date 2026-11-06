"use client";

import { useEffect } from "react";
import { adoptEarlierTracker } from "@/lib/asset-tracker/assets";
import { resumeCloudDevices } from "@/lib/cloud/remembered-links";

/**
 * Links again, as the app starts, to every device linked through the cloud on an earlier visit, so
 * its last data shows straight away (online or not) and its homepage card reads as connected.
 */
export function ResumeCloudLinks() {
  useEffect(() => {
    adoptEarlierTracker();
    resumeCloudDevices();
  }, []);
  return null;
}
