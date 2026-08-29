import "server-only";
import { cache } from "react";
import { db } from "./db";
import { getCurrentUser } from "./auth";

export type Brand = { name: string; logoUrl: string | null; primaryColor: string; tagline: string; orgId: string | null };

export const DEFAULT_BRAND: Brand = { name: "e-learner", logoUrl: null, primaryColor: "#4f46e5", tagline: "", orgId: null };

const HEX = /^#[0-9a-fA-F]{6}$/;
export const isHexColor = (s: string) => HEX.test(s);

/** The viewer's organization brand (v2.1), or the platform default. Cached per request. */
export const getBrand = cache(async (): Promise<Brand> => {
  const user = await getCurrentUser();
  if (!user?.organizationId) return DEFAULT_BRAND;
  const org = await db.organization.findUnique({ where: { id: user.organizationId }, select: { id: true, name: true, logoUrl: true, primaryColor: true, tagline: true } });
  if (!org) return DEFAULT_BRAND;
  return {
    name: org.name,
    logoUrl: org.logoUrl,
    primaryColor: isHexColor(org.primaryColor) ? org.primaryColor : DEFAULT_BRAND.primaryColor,
    tagline: org.tagline,
    orgId: org.id,
  };
});

/** Darkens a hex colour for hover states (simple, no colour library). */
export function darken(hex: string, amount = 0.12) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 - amount))));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
