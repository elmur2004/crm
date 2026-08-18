import type { Msg } from "@/lib/i18n/core";

/* Data Vault dictionary (ADR-053). The reference app was English-only, so the
   Arabic here is AUTHORED for this module: concise Egyptian-business MSA,
   matching the accounting module's register. EN strings are the literals the
   e2e suite asserts on. Brand names stay untranslated; Latin runs inside
   Arabic prose get .u-ltr at the component layer. */

export const vault = {
  navItem: { en: "Data Vault", ar: "خزنة البيانات" },

  /* shell */
  metaTitle: { en: "Data Vault", ar: "خزنة البيانات" },
  eyebrow: { en: "DATA VAULT", ar: "خزنة البيانات" },

  /* tabs */
  tabOverview: { en: "Overview", ar: "نظرة عامة" },
  tabForms: { en: "Forms", ar: "النماذج" },
  tabSheets: { en: "Sheets", ar: "الجداول" },
  tabDocuments: { en: "Documents", ar: "المستندات" },
  tabTasks: { en: "Tasks", ar: "المهام" },
  tabEmployees: { en: "Employees", ar: "الموظفون" },
  tabArchive: { en: "Archive", ar: "الأرشيف" },

  /* overview */
  overviewTitle: { en: "Overview", ar: "نظرة عامة" },
  overviewSub: {
    en: "The internal registry: forms, sheets, documents and tasks — archived, never deleted.",
    ar: "السجل الداخلي: نماذج وجداول ومستندات ومهام — تُؤرشف ولا تُحذف أبدًا.",
  },
  liveForms: { en: "Forms", ar: "النماذج" },
  liveSheets: { en: "Sheets", ar: "الجداول" },
  liveDocuments: { en: "Documents", ar: "المستندات" },
  openTasks: { en: "Open tasks", ar: "مهام مفتوحة" },
  overdueTasks: { en: "Overdue", ar: "متأخرة" },
  archivedRecords: { en: "Archived records", ar: "سجلات مؤرشفة" },
  recentActivity: { en: "Recent activity", ar: "آخر النشاط" },
  noActivity: { en: "Nothing has happened yet.", ar: "لا يوجد نشاط بعد." },
  whenCol: { en: "When", ar: "الوقت" },
  actionCol: { en: "Action", ar: "الإجراء" },
  detailCol: { en: "Detail", ar: "التفاصيل" },
  /* activity-log vocabulary (closed sets — the trigger column stays technical
     mono text: it embeds names/dates and is provenance, not prose) */
  entityEmployee: { en: "Employee", ar: "موظف" },
  entityForm: { en: "Form", ar: "نموذج" },
  entitySheet: { en: "Sheet", ar: "جدول" },
  entityDocument: { en: "Document", ar: "مستند" },
  entityTask: { en: "Task", ar: "مهمة" },
  actionCreate: { en: "Created", ar: "إنشاء" },
  actionUpdate: { en: "Updated", ar: "تعديل" },
  actionArchive: { en: "Archived", ar: "أرشفة" },
  actionRestore: { en: "Restored", ar: "استعادة" },
  actionComplete: { en: "Completed", ar: "إكمال" },
  actionReopen: { en: "Reopened", ar: "إعادة فتح" },
  actionReplaceFile: { en: "File replaced", ar: "استبدال ملف" },
  searchTitle: { en: "Search the vault", ar: "البحث في الخزنة" },
  searchPlaceholder: {
    en: "Search forms, sheets, documents, tasks…",
    ar: "ابحث في النماذج والجداول والمستندات والمهام…",
  },
  searchButton: { en: "Search", ar: "بحث" },
  searchNoResults: { en: "No matches.", ar: "لا توجد نتائج." },
  searchMin: { en: "Type at least two characters.", ar: "اكتب حرفين على الأقل." },

  /* shared table / form vocabulary */
  name: { en: "Name", ar: "الاسم" },
  company: { en: "Company", ar: "الشركة" },
  companyBoth: { en: "Both", ar: "الشركتان" },
  type: { en: "Type", ar: "النوع" },
  notes: { en: "Notes", ar: "ملاحظات" },
  description: { en: "Description", ar: "الوصف" },
  url: { en: "URL", ar: "الرابط" },
  link: { en: "Link", ar: "رابط" },
  file: { en: "File", ar: "ملف" },
  open: { en: "Open", ar: "فتح" },
  download: { en: "Download", ar: "تنزيل" },
  added: { en: "Added", ar: "تاريخ الإضافة" },
  edit: { en: "Edit", ar: "تعديل" },
  save: { en: "Save", ar: "حفظ" },
  cancel: { en: "Cancel", ar: "إلغاء" },
  close: { en: "Close", ar: "إغلاق" },
  archive: { en: "Archive", ar: "أرشفة" },
  restore: { en: "Restore", ar: "استعادة" },
  confirmArchive: {
    en: "Archive this record? It leaves the lists — restore it any time from the Archive tab.",
    ar: "أرشفة هذا السجل؟ سيغادر القوائم — يمكن استعادته في أي وقت من تبويب الأرشيف.",
  },
  all: { en: "All", ar: "الكل" },
  filters: { en: "Filters", ar: "التصفية" },
  apply: { en: "Apply", ar: "تطبيق" },
  clear: { en: "Clear", ar: "مسح" },
  searchShort: { en: "Search", ar: "بحث" },
  somethingWentWrong: { en: "Something went wrong", ar: "حدث خطأ ما" },
  archivedBadge: { en: "Archived", ar: "مؤرشف" },

  /* forms */
  formsTitle: { en: "Forms", ar: "النماذج" },
  formsSub: {
    en: "Named links to the live forms — one URL each, duplicates flagged.",
    ar: "روابط مسماة للنماذج المستخدمة — رابط لكل نموذج، مع تنبيه عند التكرار.",
  },
  addForm: { en: "Add form", ar: "إضافة نموذج" },
  editForm: { en: "Edit form", ar: "تعديل النموذج" },
  noForms: { en: "No forms yet. Add the first one.", ar: "لا توجد نماذج بعد. أضف الأول." },
  duplicateConfirm: {
    en: "Save anyway (I know this URL is already filed)",
    ar: "احفظ على أي حال (أعلم أن هذا الرابط مسجل بالفعل)",
  },

  /* sheets */
  sheetsTitle: { en: "Sheets", ar: "الجداول" },
  sheetsSub: {
    en: "Spreadsheets as links or uploaded files — one of the two, never both.",
    ar: "جداول بيانات كروابط أو ملفات مرفوعة — أحدهما فقط، وليس الاثنين معًا.",
  },
  addSheet: { en: "Add sheet", ar: "إضافة جدول" },
  editSheet: { en: "Edit sheet", ar: "تعديل الجدول" },
  noSheets: { en: "No sheets yet. Add the first one.", ar: "لا توجد جداول بعد. أضف الأول." },
  storageMode: { en: "Stored as", ar: "طريقة الحفظ" },
  storageLink: { en: "Link", ar: "رابط" },
  storageFile: { en: "Uploaded file", ar: "ملف مرفوع" },
  dateCreated: { en: "Date created", ar: "تاريخ الإنشاء" },
  records: { en: "Records", ar: "عدد السجلات" },
  recordCount: { en: "Record count", ar: "عدد السجلات" },
  recordCountAsOf: { en: "Count as of", ar: "العدد بتاريخ" },
  countedFromFile: { en: "counted from the file", ar: "محسوب من الملف" },
  manualCountHint: {
    en: "XLSX/XLS files are stored but not auto-counted — enter the count and the date it was accurate.",
    ar: "ملفات XLSX/XLS تُحفظ دون عدّ تلقائي — أدخل العدد وتاريخ صحته.",
  },
  replaceFile: { en: "Replace file", ar: "استبدال الملف" },
  uploadFile: { en: "Upload file", ar: "رفع ملف" },
  fileVersions: { en: "versions", ar: "إصدارات" },
  sheetFileTypes: { en: "XLSX, XLS or CSV — up to 25 MB", ar: "XLSX أو XLS أو CSV — حتى 25 ميجابايت" },

  /* documents */
  documentsTitle: { en: "Documents", ar: "المستندات" },
  documentsSub: {
    en: "Contracts, proposals, reports — the file itself, typed and filed.",
    ar: "عقود وعروض وتقارير — الملف نفسه، مصنفًا ومحفوظًا.",
  },
  addDocument: { en: "Add document", ar: "إضافة مستند" },
  editDocument: { en: "Edit document", ar: "تعديل المستند" },
  noDocuments: { en: "No documents yet. Add the first one.", ar: "لا توجد مستندات بعد. أضف الأول." },
  documentFileTypes: { en: "PDF, DOCX or XLSX — up to 25 MB", ar: "PDF أو DOCX أو XLSX — حتى 25 ميجابايت" },

  /* employees */
  employeesTitle: { en: "Employees", ar: "الموظفون" },
  employeesSub: {
    en: "Assignee cards — a name, a title, a company. Cards, not accounts.",
    ar: "بطاقات المكلفين بالمهام — اسم ومسمى وشركة. بطاقات، وليست حسابات.",
  },
  addEmployee: { en: "Add employee", ar: "إضافة موظف" },
  editEmployee: { en: "Edit employee", ar: "تعديل الموظف" },
  noEmployees: {
    en: "No employee cards yet. Add one to start assigning tasks.",
    ar: "لا توجد بطاقات موظفين بعد. أضف بطاقة لبدء إسناد المهام.",
  },
  jobTitle: { en: "Job title", ar: "المسمى الوظيفي" },
  deactivate: { en: "Deactivate", ar: "إيقاف" },
  reactivate: { en: "Reactivate", ar: "تفعيل" },
  inactiveBadge: { en: "Deactivated", ar: "موقوف" },
  showInactive: { en: "Show deactivated", ar: "عرض الموقوفين" },
  openCount: { en: "Open", ar: "مفتوحة" },
  overdueCount: { en: "Overdue", ar: "متأخرة" },
  completedCount: { en: "Completed", ar: "مكتملة" },
  deactivateHint: {
    en: "A deactivated card takes no new tasks; its history stays.",
    ar: "البطاقة الموقوفة لا تُسند إليها مهام جديدة، ويبقى سجلها كما هو.",
  },

  /* tasks */
  tasksTitle: { en: "Tasks", ar: "المهام" },
  tasksSub: {
    en: "A task completes only with a recorded result — and lateness is written once, forever.",
    ar: "لا تكتمل المهمة إلا بنتيجة مسجلة — ويُحسب التأخير مرة واحدة ويبقى ثابتًا.",
  },
  addTask: { en: "Add task", ar: "إضافة مهمة" },
  editTask: { en: "Edit task", ar: "تعديل المهمة" },
  noTasks: { en: "No tasks here.", ar: "لا توجد مهام هنا." },
  assignee: { en: "Assignee", ar: "المكلف" },
  deadline: { en: "Deadline", ar: "الموعد النهائي" },
  status: { en: "Status", ar: "الحالة" },
  statusOpen: { en: "Open", ar: "مفتوحة" },
  statusCompleted: { en: "Completed", ar: "مكتملة" },
  overdueBadge: { en: "Overdue", ar: "متأخرة" },
  late: { en: "Late", ar: "التأخير" },
  onTime: { en: "On time", ar: "في الموعد" },
  lateByDays: { en: "Late by {days} day(s)", ar: "متأخرة {days} يوم/أيام" },
  completedOn: { en: "Completed on", ar: "اكتملت في" },
  result: { en: "Result", ar: "النتيجة" },
  onlyOverdue: { en: "Overdue only", ar: "المتأخرة فقط" },
  allEmployees: { en: "All employees", ar: "كل الموظفين" },

  /* the result panel — the gate's UX */
  completeTask: { en: "Complete task", ar: "إكمال المهمة" },
  reopenTask: { en: "Reopen", ar: "إعادة فتح" },
  resultPanelTitle: { en: "Record the result", ar: "تسجيل النتيجة" },
  resultPanelHint: {
    en: "A task needs a result to complete: a note, a file, or a link — any one of them.",
    ar: "تحتاج المهمة إلى نتيجة لتكتمل: ملاحظة أو ملف أو رابط — أي واحد منها يكفي.",
  },
  resultText: { en: "Result note", ar: "ملاحظة النتيجة" },
  resultFiles: { en: "Result files", ar: "ملفات النتيجة" },
  resultLinks: { en: "Result links", ar: "روابط النتيجة" },
  addLink: { en: "Add link", ar: "إضافة رابط" },
  linkLabel: { en: "Label (optional)", ar: "التسمية (اختياري)" },
  saveResult: { en: "Save result", ar: "حفظ النتيجة" },
  saveAndComplete: { en: "Save & complete", ar: "حفظ وإكمال" },
  attachmentFileTypes: {
    en: "PDF, DOCX, XLSX, PPTX, PNG, JPG or TXT — up to 25 MB each",
    ar: "PDF أو DOCX أو XLSX أو PPTX أو PNG أو JPG أو TXT — حتى 25 ميجابايت للملف",
  },
  reopenHint: {
    en: "Reopening keeps the result but clears the completion and its lateness record — the log keeps the erased values.",
    ar: "إعادة الفتح تُبقي النتيجة وتمسح الإكمال وسجل التأخير — ويحتفظ السجل بالقيم الممسوحة.",
  },

  /* archive screen */
  archiveTitle: { en: "Archive", ar: "الأرشيف" },
  archiveSub: {
    en: "Nothing in the vault is ever deleted — archived records rest here, restorable.",
    ar: "لا شيء في الخزنة يُحذف أبدًا — السجلات المؤرشفة هنا، وقابلة للاستعادة.",
  },
  archiveEmpty: { en: "The archive is empty.", ar: "الأرشيف فارغ." },
  archivedOn: { en: "Archived on", ar: "تاريخ الأرشفة" },

  /* misc */
  filesCount: { en: "file(s)", ar: "ملف/ملفات" },
  linksCount: { en: "link(s)", ar: "رابط/روابط" },
  noteShort: { en: "note", ar: "ملاحظة" },
} satisfies Record<string, Msg>;
