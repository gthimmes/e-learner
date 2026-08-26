import { handle, json, requireApiUser } from "@/lib/api";

export const GET = handle(async (req: Request) => {
  const u = await requireApiUser(req);
  return json({ id: u.id, email: u.email, name: u.name, role: u.role, organizationId: u.organizationId, orgAdmin: u.orgAdmin });
});
