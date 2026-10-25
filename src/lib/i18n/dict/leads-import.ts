import type { Msg } from "@/lib/i18n/core";

/* ============================================================================
   IMPORT LEADS FROM EXCEL — every word the feature says, in both languages.

   Founder, verbatim: "add import lead button when I click on it it gives me the
   option to download the import template or import the leads actually".

   A NEW dictionary rather than keys appended to an existing one: not one
   existing English string moves (the e2e suite asserts them byte for byte), and
   the feature's words live together where a translator can read them as one
   piece. Product words that already exist are REFERENCED by the modules that
   use them (common.name, board.close, leadTypeMsgs…) rather than retyped here,
   so one English string cannot grow a second Arabic.

   Two house rules carried over from ADR-083's review:
     · the Arabic noun for a lead is "العميل المحتمل" — never "العميل" alone,
       which is this product's word for a CLIENT;
     · a brand wordmark stays Latin in both languages ("Excel", "WhatsApp").
   Counts use the colon form ("Imported: 3") because Arabic needs several
   plural forms for a counted noun and the colon form needs none (the daily
   report's precedent).
   ========================================================================== */

export const leadsImport = {
  /* ---- the button and its two-item menu -------------------------------- */

  /* the button NAMES its company, like the export's, because importing one
     company's list into the other is the one mistake that matters */
  button: { en: "Import leads — {company}", ar: "استيراد العملاء المحتملين — {company}" },
  downloadTemplate: { en: "Download template", ar: "تنزيل النموذج" },
  importLeads: { en: "Import leads", ar: "استيراد العملاء المحتملين" },
  menuHint: {
    en: ".xlsx only · up to {rows} leads · {mb} MB · leads arrive unassigned",
    ar: "‎.xlsx فقط · حتى {rows} عميل محتمل · {mb} ميجابايت · يصلون دون إسناد",
  },

  /* ---- in flight -------------------------------------------------------- */

  importing: { en: "Importing {file}…", ar: "جارٍ استيراد {file}…" },
  importingHint: {
    en: "Every row is checked before anything is saved.",
    ar: "يُفحص كل صف قبل حفظ أي شيء.",
  },

  /* ---- the result screen ------------------------------------------------ */

  resultTitle: { en: "Import finished", ar: "اكتمل الاستيراد" },
  failedTitle: { en: "Nothing was imported", ar: "لم يُستورد أي شيء" },
  /* the two tiles' labels, and the same two counts as one sentence for a
     screen reader */
  importedLabel: { en: "Imported", ar: "تم استيرادهم" },
  skippedLabel: { en: "Skipped", ar: "تم تخطيهم" },
  importedCount: { en: "Imported: {n}", ar: "تم استيرادهم: {n}" },
  skippedCount: { en: "Skipped: {n}", ar: "تم تخطيهم: {n}" },
  /* where the new leads are — a lead nobody owns is invisible on a board built
     around owners, so the result screen says where to look (ADR-051's queue) */
  unassignedBsystems: {
    en: "The imported leads have no owner yet. They are under Owner: Unassigned, waiting to be assigned.",
    ar: "العملاء المحتملون المستوردون بلا مالك حتى الآن. ستجدهم ضمن «المالك: غير مُسند» بانتظار الإسناد.",
  },
  unassignedByteforce: {
    en: "The imported leads have no sales rep yet. They are in the Unassigned card on the Leads page, waiting to be assigned.",
    ar: "العملاء المحتملون المستوردون بلا مسؤول مبيعات حتى الآن. ستجدهم في بطاقة «غير مُعيَّن» في صفحة العملاء المحتملين بانتظار الإسناد.",
  },
  showUnassigned: { en: "Show the unassigned leads", ar: "عرض العملاء المحتملين غير المُسندين" },
  restoredTitle: { en: "Leading 0 put back", ar: "أُعيد الصفر في بداية الرقم" },
  restoredNote: {
    en: "Excel had saved these numbers as numbers, which drops the leading 0. Each one is an Egyptian mobile, so the 0 (or the +) was put back.",
    ar: "كان Excel قد حفظ هذه الأرقام كقيم حسابية، فحذف الصفر في بدايتها. كلٌّ منها رقم محمول مصري، لذا أُعيد الصفر (أو علامة +).",
  },
  restoredRow: { en: "Row {row}: {from} became {to}", ar: "الصف {row}: {from} أصبح {to}" },
  skippedTitle: { en: "Skipped rows", ar: "الصفوف التي تم تخطيها" },
  thRow: { en: "Row", ar: "الصف" },
  thReason: { en: "Why it was skipped", ar: "سبب التخطي" },
  noneSkipped: { en: "Nothing was skipped.", ar: "لم يتم تخطي أي صف." },
  downloadSkipped: {
    en: "Download the skipped rows (.xlsx)",
    ar: "تنزيل الصفوف التي تم تخطيها (‎.xlsx)",
  },
  skippedFileHint: {
    en: "The file is already in the template's format — fix the rows in it and import it again.",
    ar: "الملف بتنسيق النموذج نفسه — صحّح الصفوف فيه ثم استورده مرة أخرى.",
  },
  importAnother: { en: "Import another file", ar: "استيراد ملف آخر" },

  /* ---- why a ROW was skipped (one or more per row) ---------------------- */

  reasonExample: {
    en: "The template's example row — not imported",
    ar: "صف المثال في النموذج — لا يُستورد",
  },
  reasonMissingName: { en: "Name is missing", ar: "الاسم غير موجود" },
  reasonMissingNumber: { en: "Number is missing", ar: "الرقم غير موجود" },
  reasonInvalidNumber: {
    en: "“{value}” is not a phone number",
    ar: "«{value}» ليس رقم هاتف",
  },
  reasonNumberStoredAsNumber: {
    en: "Excel saved {value} as a number and may have dropped its leading 0 — format the Number column as Text and type it again",
    ar: "حفظ Excel القيمة {value} كرقم حسابي وربما حذف الصفر في بدايتها — اجعل تنسيق عمود Number نصًّا واكتب الرقم مرة أخرى",
  },
  reasonMissingType: { en: "Type is missing", ar: "النوع غير موجود" },
  reasonUnknownType: {
    en: "“{value}” is not a lead type — use one of: {types}",
    ar: "«{value}» ليس نوعًا معروفًا — استخدم أحد الأنواع: {types}",
  },
  reasonMissingCompany: {
    en: "Company is missing — B-Systems leads need one",
    ar: "الشركة غير موجودة — العملاء المحتملون لدى B-Systems يتطلبون اسم الشركة",
  },
  reasonInvalidEmail: {
    en: "“{value}” is not an email address",
    ar: "«{value}» ليس بريدًا إلكترونيًا صحيحًا",
  },
  reasonTooLong: {
    en: "{field} is too long — at most {max} characters",
    ar: "{field} أطول من اللازم — الحد الأقصى {max} حرفًا",
  },
  reasonInvalidValue: { en: "{field} is not valid", ar: "{field} غير صالح" },
  reasonDuplicateInSystem: {
    en: "Already in {company} — this number belongs to “{name}”",
    ar: "موجود بالفعل في {company} — هذا الرقم يخص «{name}»",
  },
  reasonDuplicateInFile: {
    en: "The same number is already on row {row} of this file",
    ar: "الرقم نفسه موجود في الصف {row} من هذا الملف",
  },
  reasonInvalidDate: {
    en: "“{value}” is not a date — type the created date as DD/MM/YYYY, for example 15/03/2024",
    ar: "«{value}» ليس تاريخًا — اكتب تاريخ الإنشاء بالصيغة DD/MM/YYYY، مثل 15/03/2024",
  },
  reasonFutureDate: {
    en: "The created date {date} is in the future",
    ar: "تاريخ الإنشاء {date} في المستقبل",
  },
  reasonTooOldDate: {
    en: "The created date {date} is before 01/01/{year} — check it",
    ar: "تاريخ الإنشاء {date} قبل 01/01/{year} — راجعه",
  },
  /* the template's "Description" column; the B-Systems form calls the same
     field "Notes", and the column keeps the founder's own word for it */
  fieldDescription: { en: "Description", ar: "الوصف" },
  /* the optional "Created date" column — when the lead was really first had,
     so an import of old leads does not make them all "new this month" */
  fieldCreatedDate: { en: "Created date", ar: "تاريخ الإنشاء" },

  /* ---- why the whole FILE was refused (nothing imported) ---------------- */

  errorNoFile: { en: "Choose an .xlsx file to import.", ar: "اختر ملف ‎.xlsx لاستيراده." },
  errorNotXlsx: {
    en: "Only .xlsx files can be imported — save the file as an Excel Workbook (.xlsx) and try again.",
    ar: "يمكن استيراد ملفات ‎.xlsx فقط — احفظ الملف بصيغة Excel Workbook ‏(‎.xlsx) ثم حاول مرة أخرى.",
  },
  errorTooLarge: {
    en: "The file is larger than {mb} MB — split it into smaller files.",
    ar: "حجم الملف أكبر من {mb} ميجابايت — قسّمه إلى ملفات أصغر.",
  },
  errorTooManyRows: {
    en: "The file has {n} leads — at most {max} can be imported at once. Split it into smaller files.",
    ar: "عدد العملاء المحتملين في الملف: {n}، والحد الأقصى في المرة الواحدة: {max}. قسّمه إلى ملفات أصغر.",
  },
  errorWrongTemplate: {
    en: "This file is not the import template — download the template from the Import leads menu and copy your leads into it.",
    ar: "هذا الملف ليس نموذج الاستيراد — نزّل النموذج من قائمة استيراد العملاء المحتملين وانسخ عملاءك المحتملين إليه.",
  },
  errorMissingColumns: { en: "Missing columns: {list}", ar: "أعمدة ناقصة: {list}" },
  errorUnexpectedColumns: {
    en: "Columns the template does not have: {list}",
    ar: "أعمدة ليست في النموذج: {list}",
  },
  errorDuplicatedColumns: {
    en: "Columns that appear twice: {list}",
    ar: "أعمدة مكررة: {list}",
  },
  errorWrongCompany: {
    en: "This is the {other} template, and you are importing into {company}. Download the {company} template, or switch to {other} first.",
    ar: "هذا نموذج {other}، وأنت تستورد إلى {company}. نزّل نموذج {company}، أو انتقل إلى {other} أولًا.",
  },
  errorEmpty: {
    en: "The file has no leads in it — fill in rows under the header row.",
    ar: "لا يحتوي الملف على أي عميل محتمل — املأ الصفوف أسفل صف العناوين.",
  },
  errorUnreadable: {
    en: "The file could not be read — open it in Excel, save it as .xlsx and try again.",
    ar: "تعذّرت قراءة الملف — افتحه في Excel واحفظه بصيغة ‎.xlsx ثم حاول مرة أخرى.",
  },
  errorFailed: {
    en: "The import stopped and nothing was imported — no lead was created. Try again.",
    ar: "توقف الاستيراد ولم يُستورد أي شيء — لم يُنشأ أي عميل محتمل. حاول مرة أخرى.",
  },

  /* ---- the History pill and the daily-report line (trigger leads_import) */

  historyPill: { en: "Imported from Excel", ar: "مستورد من ملف Excel" },

  /* ---- the template's INSTRUCTIONS sheets (one English, one Arabic) ----- */

  sheetInstructions: { en: "Instructions", ar: "التعليمات" },
  insTitle: {
    en: "How to fill in this template — {company}",
    ar: "طريقة ملء هذا النموذج — {company}",
  },
  insRows: {
    en: "One lead per row on the “{sheet}” sheet, starting on row 3 — or on row 2 once you delete the example. Keep the header row exactly as it is: the import reads the column names.",
    ar: "عميل محتمل واحد في كل صف في ورقة «{sheet}»، بدءًا من الصف 3 — أو من الصف 2 بعد حذف المثال. اترك صف العناوين كما هو تمامًا: فالاستيراد يقرأ أسماء الأعمدة.",
  },
  insRequired: {
    en: "Columns marked * are required: {list}.",
    ar: "الأعمدة المعلَّمة بـ * إلزامية: {list}.",
  },
  insNumber: {
    en: "Number: type it exactly as you dial it, with its leading 0 — for example 01012345678. The column is already formatted as Text, so Excel keeps the 0. If you paste numbers from another file, use Paste Special, then Values, so the Text format stays.",
    ar: "Number (الرقم): اكتبه كما تتصل به تمامًا، مع الصفر في بدايته — مثل 01012345678. تنسيق العمود نصّي مسبقًا حتى يحتفظ Excel بالصفر. إذا نسخت أرقامًا من ملف آخر فاستخدم «لصق خاص» ثم «قيم» حتى يبقى التنسيق نصّيًا.",
  },
  insNumberRule: {
    en: "If a number still arrives as a number, the 0 is put back only where it is certain: a 10-digit Egyptian mobile such as 1012345678 becomes 01012345678. Any other number saved as a number is skipped and listed — nothing is guessed.",
    ar: "إذا وصل رقم مع ذلك كقيمة حسابية، يُعاد الصفر فقط حين يكون ذلك مؤكدًا: رقم محمول مصري من 10 أرقام مثل 1012345678 يصبح 01012345678. وأي رقم آخر محفوظ كقيمة حسابية يُتخطّى ويُذكر في النتيجة — فلا يُخمَّن شيء.",
  },
  insType: {
    en: "Type: pick it from the cell's list — {types}.",
    ar: "Type (النوع): اختره من قائمة الخلية — {types}.",
  },
  insDuplicates: {
    en: "A number that is already in {company} is skipped and listed in the result — the existing lead is never changed. A number repeated inside this file is imported once, from its first row, and the repeats are skipped.",
    ar: "الرقم الموجود بالفعل في {company} يُتخطّى ويُذكر في النتيجة — ولا يُعدَّل العميل المحتمل الموجود أبدًا. والرقم المكرر داخل هذا الملف يُستورد مرة واحدة من أول صف له، وتُتخطّى التكرارات.",
  },
  insUnassigned: {
    en: "Imported leads arrive UNASSIGNED — no owner and no sales rep. An admin assigns them afterwards.",
    ar: "يصل العملاء المحتملون المستوردون دون إسناد — بلا مالك ولا مسؤول مبيعات. ويُسندهم المدير بعد ذلك.",
  },
  insCreatedDate: {
    en: "Created date (optional): the day this lead was first added, typed as DD/MM/YYYY — for example 15/03/2024. The column is Text, so Excel cannot swap the day and the month. Leave it empty and the lead is dated the moment you import it. A date in the future, or before 01/01/{year}, is skipped and listed.",
    ar: "Created date (تاريخ الإنشاء، اختياري): اليوم الذي أُضيف فيه هذا العميل المحتمل أول مرة، بالصيغة DD/MM/YYYY — مثل 15/03/2024. تنسيق العمود نصّي حتى لا يبدّل Excel اليوم والشهر. إن تركته فارغًا يُؤرَّخ العميل المحتمل بلحظة الاستيراد. والتاريخ الذي في المستقبل أو قبل 01/01/{year} يُتخطّى ويُذكر في النتيجة.",
  },
  insExample: {
    en: "Row 2 is an example. Type over it or delete it — if it is left as it is, it is skipped.",
    ar: "الصف 2 مثال. اكتب فوقه أو احذفه — وإن تُرك كما هو فسيُتخطّى.",
  },
  insLimits: {
    en: "At most {max} leads and {mb} MB per file, .xlsx only.",
    ar: "الحد الأقصى للملف الواحد: {max} عميل محتمل و{mb} ميجابايت، وبصيغة ‎.xlsx فقط.",
  },
  insCompany: {
    en: "This template is for {company}: leads are imported into the company whose Leads page you import from.",
    ar: "هذا النموذج خاص بـ {company}: يُستورد العملاء المحتملون إلى الشركة التي تستورد من صفحة عملائها المحتملين.",
  },
  insColColumn: { en: "Column", ar: "العمود" },
  insColRequired: { en: "Required", ar: "إلزامي" },
  insColWhat: { en: "What to type", ar: "ماذا تكتب" },
  insWhatName: { en: "The person's name.", ar: "اسم الشخص." },
  insWhatNumber: {
    en: "The phone number, with its leading 0.",
    ar: "رقم الهاتف مع الصفر في بدايته.",
  },
  insWhatType: { en: "One of: {types}.", ar: "أحد الأنواع: {types}." },
  insWhatEmail: {
    en: "An email address, or leave it empty.",
    ar: "عنوان بريد إلكتروني، أو اتركه فارغًا.",
  },
  insWhatCompany: {
    en: "The company the person works for.",
    ar: "الشركة التي يعمل بها الشخص.",
  },
  insWhatPosition: { en: "Their job title.", ar: "المسمى الوظيفي." },
  insWhatIndustry: { en: "The company's field.", ar: "مجال الشركة." },
  insWhatRequirements: { en: "What they need.", ar: "ما يحتاجه." },
  insWhatDescription: { en: "Any notes.", ar: "أي ملاحظات." },
  insWhatCreatedDate: {
    en: "The day the lead was first added, DD/MM/YYYY. Empty = today.",
    ar: "يوم إضافة العميل المحتمل أول مرة، DD/MM/YYYY. فارغ = اليوم.",
  },
} satisfies Record<string, Msg>;
