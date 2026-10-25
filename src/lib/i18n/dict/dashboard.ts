import type { Msg } from "@/lib/i18n/core";
import type { RangeKey } from "@/lib/dashboard/periods";

/* ============================================================================
   The Home — EVERY string the dashboard prints, in one dictionary.

   It replaces two (dict/crm.ts `home` and dict/internal.ts `dash`), which had
   drifted into two Arabic words for the same figure on the two company Homes
   (dashboard spec A11). One body renders both companies now, so one wording
   per metric is a property of the file rather than a promise.

   D17 — the two figures that had two Arabic wordings get ONE each, pending the
   founder's choice: "Pipeline value" → قيمة الصفقات الجارية (the B-Systems
   wording, the default company) and "To be collected" → المطلوب تحصيله (the
   ByteForce wording — it is the only company that still shows the figure;
   B-Systems shows "Milestones outstanding"). Each is a one-line change here.

   English strings that existing journeys read by label are kept verbatim:
   "Pipeline value", "Total leads", "Won value", "To be collected", "Agents",
   "Agent & partner pipeline".

   Counts use the COLON form ("Open: 4") wherever a pluralised noun would need
   Arabic's four plural forms — the daily report's convention (ADR-081).
   ========================================================================== */

export const dash = {
  eyebrowHome: { en: "HOME", ar: "الرئيسية" },
  title: { en: "Home", ar: "الرئيسية" },
  welcome: { en: "Welcome back, {name}", ar: "مرحبًا بعودتك، {name}" },
  keyFigures: { en: "Key figures", ar: "الأرقام الرئيسية" },

  /* ---- range picker (W0b) */
  period: { en: "Period", ar: "الفترة" },
  choosePeriod: { en: "Choose the period", ar: "اختر الفترة" },

  /* ---- delta badge (§2.2) */
  deltaNew: { en: "New", ar: "جديد" },
  deltaSame: { en: "No change", ar: "بلا تغيير" },
  deltaNa: { en: "—", ar: "—" },
  pts: { en: "pts", ar: "نقطة" },
  notEnoughToCompare: {
    en: "Not enough closed deals to compare",
    ar: "لا توجد صفقات مغلقة كافية للمقارنة",
  },
  vsDates: { en: "vs {dates}", ar: "مقارنة بـ {dates}" },
  /* the badge's screen-reader sentence — the card around it already reads
     its label and value, so this names the change and BOTH periods' figures */
  srUp: { en: "up {change} from {prev} in {dates}", ar: "بزيادة {change} عن {prev} في {dates}" },
  srDown: { en: "down {change} from {prev} in {dates}", ar: "بانخفاض {change} عن {prev} في {dates}" },
  srNew: { en: "new — none in {dates}", ar: "جديد — لا شيء في {dates}" },
  srSame: { en: "no change from {prev} in {dates}", ar: "بلا تغيير عن {prev} في {dates}" },
  srNa: {
    en: "not enough closed deals to compare with {dates}",
    ar: "لا توجد صفقات مغلقة كافية للمقارنة مع {dates}",
  },
  percentPoints: { en: "{n} percentage points", ar: "{n} نقطة مئوية" },

  /* ---- K1 hero */
  bookedNotCash: { en: "Booked value · not cash collected", ar: "قيمة متعاقد عليها · وليست مبالغ محصّلة" },
  dealsWon: { en: "Deals won: {n}", ar: "صفقات مكسوبة: {n}" },
  wonTrend: { en: "Won value by month, last 6 months: {list}", ar: "قيمة الصفقات المكسوبة شهريًا، آخر 6 أشهر: {list}" },

  /* ---- K2 */
  newLeads: { en: "New leads", ar: "عملاء محتملون جدد" },
  newLeadsTrend: { en: "New leads by month, last 6 months: {list}", ar: "العملاء المحتملون الجدد شهريًا، آخر 6 أشهر: {list}" },

  /* ---- K3 */
  winRate: { en: "Win rate", ar: "معدل الفوز" },
  wonLost: { en: "{won} won · {lost} lost", ar: "{won} مكسوبة · {lost} خاسرة" },
  noClosedDeals: { en: "No closed deals in {dates}", ar: "لا توجد صفقات مغلقة في {dates}" },

  /* ---- K4 */
  pipelineValue: { en: "Pipeline value", ar: "قيمة الصفقات الجارية" },
  now: { en: "Now", ar: "الآن" },
  openLeads: { en: "Open: {n}", ar: "مفتوحة: {n}" },
  ofWhichParked: { en: "of which {value} parked", ar: "منها {value} مؤجلة" },
  pipelineByStage: { en: "Pipeline value by stage", ar: "قيمة الصفقات الجارية حسب المرحلة" },

  /* ---- W5 */
  leadsPerStage: { en: "Leads per stage", ar: "العملاء المحتملون حسب المرحلة" },
  newNotActioned: { en: "New / not actioned", ar: "جديد / بدون إجراء" },
  totalLeads: { en: "Total leads", ar: "إجمالي العملاء المحتملين" },
  wonValue: { en: "Won value", ar: "قيمة الصفقات المكسوبة" },
  toBeCollected: { en: "To be collected", ar: "المطلوب تحصيله" },
  milestonesOutstanding: { en: "Milestones outstanding", ar: "قيمة المراحل المتبقية" },
  allTimeFootnote: {
    en: "All-time figures. Won value is booked value, not cash.",
    ar: "أرقام منذ البداية. قيمة الصفقات المكسوبة متعاقد عليها، وليست مبالغ محصّلة.",
  },
  stageTip: { en: "{stage}: {n} · {pct}% of all leads", ar: "{stage}: {n} · {pct}% من كل العملاء المحتملين" },
  stageSummary: { en: "{stage} holds the most leads ({n}).", ar: "أكبر عدد من العملاء المحتملين في {stage} ({n})." },
  noLeadsYet: { en: "No leads yet.", ar: "لا يوجد عملاء محتملون بعد." },
  addLead: { en: "Add lead", ar: "إضافة عميل محتمل" },
  openBoard: { en: "Open the board", ar: "فتح اللوحة" },
  externalPipeline: { en: "Agent & partner pipeline", ar: "صفقات الوكلاء والشركاء" },
  agents: { en: "Agents", ar: "الوكلاء" },
  partners: { en: "Partners", ar: "الشركاء" },
  pendingAgents: { en: "+{n} pending", ar: "+{n} قيد المراجعة" },
  externalSummary: { en: "Leads owned by agents and partners: {n}.", ar: "عملاء محتملون يملكهم الوكلاء والشركاء: {n}." },

  /* ---- W6 */
  funnel: { en: "Pipeline funnel", ar: "قمع المبيعات" },
  added: { en: "Added", ar: "أُضيفت" },
  funnelCaption: {
    en: "Each step counts every lead added in {dates} that got at least this far. A lead that jumped straight to Won counts at every step before it.",
    ar: "تحسب كل خطوة كل عميل محتمل أُضيف في {dates} ووصل إلى هذه الخطوة على الأقل. العميل الذي انتقل مباشرة إلى المكسوب يُحسب في كل خطوة قبلها.",
  },
  funnelSummary: {
    en: "{pct}% of the leads added in {dates} reached Won.",
    ar: "{pct}% من العملاء المحتملين المضافين في {dates} وصلوا إلى المكسوب.",
  },
  funnelStepTip: { en: "{count} of {prev} reached {stage} ({pct}%)", ar: "{count} من {prev} وصلوا إلى {stage} ({pct}%)" },
  funnelFirstTip: { en: "{count} leads added in {dates}", ar: "{count} عميل محتمل أُضيف في {dates}" },
  ofAdded: { en: "{pct}% of added", ar: "{pct}% من المضافين" },
  noLeadsAdded: { en: "No leads were added in {dates}.", ar: "لم يُضَف أي عميل محتمل في {dates}." },

  /* ---- W7 */
  leadSources: { en: "Lead sources", ar: "مصادر العملاء المحتملين" },
  partnerReferred: { en: "Referred by partners: {n}", ar: "بإحالة من الشركاء: {n}" },
  sourcesSummary: {
    en: "{type} brought the most leads in {dates} ({n}).",
    ar: "جاء أكبر عدد من العملاء المحتملين من {type} في {dates} ({n}).",
  },
  sourceTip: { en: "{type}: {n} · {pct}%", ar: "{type}: {n} · {pct}%" },

  /* ---- W8 */
  tasksTitle: { en: "Today's tasks", ar: "مهام اليوم" },
  today: { en: "Today", ar: "اليوم" },
  doneOf: { en: "{done} of {total} done", ar: "{done} من {total} منجزة" },
  moreTasks: { en: "+{n} more on the To-Do", ar: "+{n} أخرى في قائمة المهام" },
  openTodo: { en: "Open the To-Do", ar: "فتح قائمة المهام" },
  nothingDue: { en: "Nothing due today.", ar: "لا شيء مستحق اليوم." },

  /* ---- W9 */
  needsYou: { en: "Needs you", ar: "بانتظارك" },
  readyToClose: { en: "Ready to close: {n}", ar: "جاهزة للإغلاق: {n}" },
  registrationsWaiting: { en: "Registrations waiting: {n}", ar: "تسجيلات بانتظار الموافقة: {n}" },
  reviewRegistrations: { en: "Review registrations", ar: "مراجعة التسجيلات" },
  nothingWaiting: { en: "Nothing is waiting on you.", ar: "لا شيء بانتظارك." },

  /* ---- W10 */
  recentWins: { en: "Recent wins", ar: "أحدث الصفقات المكسوبة" },
  allWonDeals: { en: "All won deals", ar: "كل الصفقات المكسوبة" },
  allClients: { en: "All clients", ar: "كل العملاء" },
  toCollect: { en: "To collect {value}", ar: "للتحصيل {value}" },
  dueOn: { en: "due {date}", ar: "تستحق {date}" },
  paidInFull: { en: "Paid in full", ar: "مدفوعة بالكامل" },
  milestoneOf: { en: "Milestone {k} of {n}", ar: "المرحلة {k} من {n}" },
  allMilestonesDone: { en: "All milestones complete", ar: "اكتملت كل المراحل" },
  noMilestones: { en: "No milestones", ar: "بدون مراحل" },
  contractOn: { en: "Contract {date}", ar: "العقد {date}" },
  noWins: { en: "No wins in {dates} yet.", ar: "لا صفقات مكسوبة في {dates} بعد." },
  unassigned: { en: "Unassigned", ar: "غير مُعيَّن" },

  /* ---- W11 */
  winRateTrend: { en: "Win rate, last 6 months", ar: "معدل الفوز، آخر 6 أشهر" },
  last6Months: { en: "LAST 6 MONTHS", ar: "آخر 6 أشهر" },
  trendTip: { en: "{month} · {pct}% · {won} won, {lost} lost", ar: "{month} · {pct}% · {won} مكسوبة، {lost} خاسرة" },
  trendGapTip: { en: "{month} · no deals won or lost", ar: "{month} · لا صفقات مكسوبة أو خاسرة" },
  trendSummary: { en: "Latest: {pct}% in {month}.", ar: "الأحدث: {pct}% في {month}." },
  trendEmpty: {
    en: "No deals were won or lost in the last 6 months.",
    ar: "لم تُكسب أو تُخسر أي صفقة في آخر 6 أشهر.",
  },

  /* ---- W12 */
  team: { en: "Team performance", ar: "أداء الفريق" },
  colOwner: { en: "Owner", ar: "المسؤول" },
  colNew: { en: "New", ar: "جدد" },
  colWon: { en: "Won", ar: "مكسوبة" },
  colRate: { en: "Win rate", ar: "معدل الفوز" },
  colOpen: { en: "Open now", ar: "مفتوحة الآن" },
  teamFootnote: {
    en: "Credited to each lead's current owner.",
    ar: "يُنسب إلى المسؤول الحالي عن كل عميل محتمل.",
  },
  teamEmpty: { en: "No owner had activity in {dates}.", ar: "لم يكن لأي مسؤول نشاط في {dates}." },
  teamSummary: { en: "{name} won the most in {dates}.", ar: "{name} حقق أعلى قيمة مكسوبة في {dates}." },

  /* ---- W13 */
  activity: { en: "Activity", ar: "النشاط" },
  latest: { en: "LATEST", ar: "الأحدث" },
  noActivity: { en: "No activity yet.", ar: "لا يوجد نشاط بعد." },
  archived: { en: "Archived", ar: "مؤرشف" },

  /* ---- shared chart chrome (§4) */
  viewAsTable: { en: "View as table", ar: "عرض كجدول" },
  thStage: { en: "Stage", ar: "المرحلة" },
  thLeads: { en: "Leads", ar: "العملاء المحتملون" },
  thShare: { en: "Share", ar: "النسبة" },
  thValue: { en: "Value", ar: "القيمة" },
  thStep: { en: "Step", ar: "الخطوة" },
  thReached: { en: "Reached", ar: "وصلوا" },
  thOfAdded: { en: "% of added", ar: "% من المضافين" },
  thSource: { en: "Source", ar: "المصدر" },
  thMonth: { en: "Month", ar: "الشهر" },
  thWon: { en: "Won", ar: "مكسوبة" },
  thLost: { en: "Lost", ar: "خاسرة" },
  thRate: { en: "Win rate", ar: "معدل الفوز" },
  eyebrowNow: { en: "NOW", ar: "الآن" },
  eyebrowAllTime: { en: "ALL TIME", ar: "منذ البداية" },
} satisfies Record<string, Msg>;

/* The range picker's presets, in menu order. */
export const rangeLabels: Record<RangeKey, Msg> = {
  mtd: { en: "This month", ar: "هذا الشهر" },
  last_month: { en: "Last month", ar: "الشهر الماضي" },
  "7d": { en: "Last 7 days", ar: "آخر 7 أيام" },
  "30d": { en: "Last 30 days", ar: "آخر 30 يومًا" },
  qtd: { en: "This quarter", ar: "هذا الربع" },
  ytd: { en: "This year", ar: "هذا العام" },
};

/* "vs last month" — what each preset is compared WITH (the badge's caption). */
export const vsLabels: Record<RangeKey, Msg> = {
  mtd: { en: "vs last month", ar: "مقارنة بالشهر الماضي" },
  last_month: { en: "vs the month before", ar: "مقارنة بالشهر الذي قبله" },
  "7d": { en: "vs the 7 days before", ar: "مقارنة بالأيام السبعة السابقة" },
  "30d": { en: "vs the 30 days before", ar: "مقارنة بالثلاثين يومًا السابقة" },
  qtd: { en: "vs last quarter", ar: "مقارنة بالربع الماضي" },
  ytd: { en: "vs last year", ar: "مقارنة بالعام الماضي" },
};

/* The hero's title follows the range — "Won this month" is the default. */
export const wonTitles: Record<RangeKey, Msg> = {
  mtd: { en: "Won this month", ar: "المكسوب هذا الشهر" },
  last_month: { en: "Won last month", ar: "المكسوب الشهر الماضي" },
  "7d": { en: "Won in the last 7 days", ar: "المكسوب في آخر 7 أيام" },
  "30d": { en: "Won in the last 30 days", ar: "المكسوب في آخر 30 يومًا" },
  qtd: { en: "Won this quarter", ar: "المكسوب هذا الربع" },
  ytd: { en: "Won this year", ar: "المكسوب هذا العام" },
};
