"use client";

import { useEffect } from "react";

/** Registers the service worker once (production only) so opened lessons stay readable offline (v2.1). */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
