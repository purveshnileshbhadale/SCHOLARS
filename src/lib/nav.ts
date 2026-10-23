import type { To } from "react-router-dom";

export interface NavItem {
  to: To;
  label: string;
  icon: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/** Icon keys resolved to SVG paths in Shell.tsx. */
export type IconKey =
  | "sparkles" | "building" | "award" | "wrench" | "home" | "robot"
  | "file" | "clipboard" | "folder" | "calendar" | "user" | "map"
  | "target" | "users" | "settings" | "graduation" | "chart" | "book"
  | "dollar" | "clock" | "mail" | "shield" | "database" | "upload"
  | "user-check" | "card" | "check" | "globe" | "message" | "compass"
  | "plane" | "trophy" | "send" | "columns" | "briefcase" | "flag";

export function linksFor(role: string | undefined): { to: To; label: string }[] {
  return groupsFor(role).flatMap((g) => g.items.map((i) => ({ to: i.to, label: i.label })));
}

export function groupsFor(role: string | undefined): NavGroup[] {
  if (role === "admin")
    return [
      {
        title: "Platform",
        items: [
          { to: "/admin", label: "Overview", icon: "chart" },
          { to: "/admin/users", label: "Users", icon: "users" },
        ],
      },
      {
        title: "Data",
        items: [
          { to: "/admin/universities", label: "Universities", icon: "building" },
          { to: "/admin/scholarships", label: "Scholarships", icon: "award" },
          { to: "/admin/import", label: "Excel import", icon: "upload" },
        ],
      },
      {
        title: "People",
        items: [
          { to: "/admin/counsellors", label: "Counsellors", icon: "user-check" },
          { to: "/admin/bookings", label: "Bookings", icon: "card" },
        ],
      },
      {
        title: "Browse",
        items: [{ to: "/menu", label: "Menu", icon: "compass" }],
      },
    ];

  if (role === "counsellor")
    return [
      {
        title: "My work",
        items: [
          { to: "/counsellor", label: "My students", icon: "users" },
          { to: "/counsellor/bookings", label: "Bookings", icon: "calendar" },
        ],
      },
      {
        title: "Browse",
        items: [{ to: "/menu", label: "Menu", icon: "compass" }],
      },
    ];

  return [
    {
      title: "Explore",
      items: [
        { to: "/dashboard", label: "Shortlist", icon: "sparkles" },
        { to: "/universities", label: "Universities", icon: "building" },
        { to: "/scholarships", label: "Scholarships", icon: "award" },
        { to: "/cost-of-living", label: "Cost of living", icon: "dollar" },
      ],
    },
    {
      title: "Plan & apply",
      items: [
        { to: "/gaps", label: "Gap report", icon: "target" },
        { to: "/roadmap", label: "Roadmap", icon: "map" },
        { to: "/applications", label: "Applications", icon: "clipboard" },
        { to: "/compare-offers", label: "Compare offers", icon: "columns" },
        { to: "/scholarship-tracker", label: "Scholarship tracker", icon: "trophy" },
        { to: "/deadlines", label: "Deadlines", icon: "calendar" },
        { to: "/documents", label: "Documents", icon: "folder" },
        { to: "/sop", label: "SOP", icon: "file" },
        { to: "/cv", label: "CV", icon: "user" },
        { to: "/outreach", label: "Outreach", icon: "send" },
        { to: "/tools", label: "Tools", icon: "wrench" },
      ],
    },
    {
      title: "After you accept",
      items: [
        { to: "/pre-departure", label: "Pre-departure", icon: "plane" },
        { to: "/work-rights", label: "Work rights", icon: "briefcase" },
        { to: "/pr-pathway", label: "PR pathway", icon: "flag" },
      ],
    },
    {
      title: "Get help",
      items: [
        { to: "/mentor", label: "ScholarAI", icon: "robot" },
        { to: "/counsellors", label: "Counsellor", icon: "graduation" },
        { to: "/bookings", label: "Bookings", icon: "clock" },
        { to: "/community", label: "Community", icon: "message" },
      ],
    },
    {
      title: "Account",
      items: [
        { to: "/settings", label: "Settings", icon: "settings" },
        { to: "/menu", label: "Menu", icon: "compass" },
      ],
    },
  ];
}
