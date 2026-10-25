import type { Msg } from "@/lib/i18n/core";
import { acct } from "./accounting";
import { vault } from "./vault";
import { todoPage } from "./todo";
import { pPipeline } from "./partners";
import { dailyReport } from "./daily-report";
import { nav } from "./crm";

/* ============================================================================
   THE APP LAUNCHER's own words — the icon grid a person lands on after
   signing in (founder: "something like this, with little icons opening each
   section"), and its one second-level screen, Reports & Dashboards.

   A TILE IS NAMED WHAT THE APP IT OPENS IS ALREADY CALLED. Accounting, the
   Data Vault, the To-Do and Partners & Agents reuse the very Msg the module
   header or the page title already prints, so the word under the icon and the
   word on the screen it opens cannot drift (the ADR-051 brand-audit finding,
   applied to a new surface). Only the two CRM tiles, the Reports tile and the
   chrome are new strings.

   Brand names stay untranslated in Arabic, as the accounting dictionary
   already rules ("Brand names and currency codes stay untranslated").
   ========================================================================== */

export const launcher = {
  metaTitle: { en: "Apps", ar: "التطبيقات" },

  /* the greeting — by the hour in Africa/Cairo (lib/launcher/greeting.ts) */
  greetingMorning: { en: "Good morning, {name}", ar: "صباح الخير، {name}" },
  greetingAfternoon: { en: "Good afternoon, {name}", ar: "مساء الخير، {name}" },
  greetingEvening: { en: "Good evening, {name}", ar: "مساء الخير، {name}" },

  /* the grid's heading — the list of tiles is labelled by it */
  appsHeading: { en: "Your apps", ar: "تطبيقاتك" },

  /* the way back to the grid: the header home icon in every app (wired after
     the dark-mode push) and the back link on the Reports screen. One Msg, so
     the icon's accessible name and the link's text say the same thing. */
  allApps: { en: "All apps", ar: "كل التطبيقات" },

  /* the platform's own name for the header (the root layout's <title>) */
  platform: { en: "ByteForce × B-Systems", ar: "ByteForce × B-Systems" },

  logOut: nav.logOut,

  /* ---- the seven tiles ---- */
  crmByteforce: { en: "ByteForce CRM", ar: "إدارة عملاء ByteForce" },
  crmBsystems: { en: "B-Systems CRM", ar: "إدارة عملاء B-Systems" },
  accounting: acct.navItem,
  vault: vault.navItem,
  todo: todoPage.navItem,
  reports: { en: "Reports & Dashboards", ar: "التقارير ولوحات المتابعة" },
  partners: pPipeline.title,
} satisfies Record<string, Msg>;

/* ---- the Reports & Dashboards screen (/apps/reports) ---- */

export const launcherReports = {
  title: launcher.reports,
  sub: {
    en: "Every dashboard and report you can open, in one place.",
    ar: "كل لوحات المتابعة والتقارير المتاحة لك، في مكان واحد.",
  },
  groupCrm: nav.crm,
  groupAccounting: acct.navItem,

  bsDashboard: { en: "B-Systems dashboard", ar: "لوحة متابعة B-Systems" },
  bsDashboardDesc: {
    en: "Leads per stage, pipeline and won value, what is still to be collected, and the agent and partner pipeline.",
    ar: "العملاء المحتملون حسب المرحلة، وقيمة الصفقات الجارية والمكسوبة، وما زال قيد التحصيل، وصفقات الوكلاء والشركاء.",
  },
  bfDashboard: { en: "ByteForce dashboard", ar: "لوحة متابعة ByteForce" },
  bfDashboardDesc: {
    en: "ByteForce leads per stage, pipeline and won value, and what is still to be collected.",
    ar: "عملاء ByteForce المحتملون حسب المرحلة، وقيمة الصفقات الجارية والمكسوبة، وما زال قيد التحصيل.",
  },
  dailyReport: dailyReport.navItem,
  dailyReportDesc: dailyReport.subtitle,
  acctDashboard: { en: "Accounting dashboard", ar: "لوحة الحسابات" },
  acctDashboardDesc: {
    en: "Treasury balance, income collected, expenses paid and the month's target.",
    ar: "رصيد الخزينة، والدخل المحصّل، والمصروفات المدفوعة، وهدف الشهر.",
  },
  acctPnl: acct.tabPnl,
  acctPnlDesc: {
    en: "The month's income statement and its six-month trend.",
    ar: "قائمة دخل الشهر واتجاهها خلال ستة أشهر.",
  },
  acctDepartments: { en: "Department profitability", ar: "ربحية الأقسام" },
  acctDepartmentsDesc: {
    en: "Income against cost for each department, with shared overhead shown apart.",
    ar: "الدخل مقابل التكلفة لكل قسم، مع عرض المصروفات المشتركة على حدة.",
  },
} satisfies Record<string, Msg>;
