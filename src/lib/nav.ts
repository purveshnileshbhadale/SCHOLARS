import type { To } from "react-router-dom";

export function linksFor(role: string | undefined): { to: To; label: string }[] {
  if (role === "admin")
    return [
      { to: "/admin", label: "Overview" },
      { to: "/admin/universities", label: "Universities" },
      { to: "/admin/import", label: "Excel import" },
      { to: "/admin/counsellors", label: "Counsellors" },
      { to: "/admin/bookings", label: "Bookings" },
    ];
  if (role === "counsellor")
    return [
      { to: "/counsellor", label: "My students" },
      { to: "/counsellor/bookings", label: "Bookings" },
    ];
  return [
    { to: "/dashboard", label: "Shortlist" },
    { to: "/universities", label: "Universities" },
    { to: "/scholarships", label: "Scholarships" },
    { to: "/tools", label: "Tools" },
    { to: "/mentor", label: "ScholarAI" },
    { to: "/sop", label: "SOP" },
    { to: "/applications", label: "Applications" },
    { to: "/documents", label: "Documents" },
    { to: "/deadlines", label: "Deadlines" },
    { to: "/counsellors", label: "Counsellor" },
    { to: "/bookings", label: "Bookings" },
    { to: "/community", label: "Community" },
    { to: "/settings", label: "Settings" },
  ];
}
