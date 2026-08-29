import { db } from "@/lib/db";

/* ADR-053 — vault global search (the reference SPEC §10.1/AC-17): one box that
   searches every section (ADR-070 added Links) and returns grouped hits. Metadata only — names,
   notes, descriptions — never file contents. Archived records never surface. */

export type VaultSearchHit = {
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
};

export type VaultSearchResults = {
  term: string;
  total: number;
  groups: {
    forms: VaultSearchHit[];
    /* ADR-070 — the Links section joins the one box, name/category/notes */
    links: VaultSearchHit[];
    sheets: VaultSearchHit[];
    documents: VaultSearchHit[];
    tasks: VaultSearchHit[];
  };
};

const PER_GROUP = 5;

export async function searchVault(term: string, perGroup = PER_GROUP): Promise<VaultSearchResults> {
  const q = term.trim();
  if (q.length < 2) {
    return {
      term: q,
      total: 0,
      groups: { forms: [], links: [], sheets: [], documents: [], tasks: [] },
    };
  }

  const like = { contains: q, mode: "insensitive" as const };
  const live = { archived: false };

  const [forms, links, sheets, documents, tasks] = await Promise.all([
    db.vaultForm.findMany({
      where: { ...live, OR: [{ name: like }, { notes: like }] },
      select: { id: true, name: true, notes: true },
      take: perGroup,
      orderBy: { updatedAt: "desc" },
    }),
    /* the CATEGORY is searched as well as the name: it is the founder's own
       word for the link ("Portfolio", "Content Calendar"), so it is very often
       what he will type looking for it */
    db.vaultLink.findMany({
      where: { ...live, OR: [{ name: like }, { category: like }, { notes: like }] },
      select: { id: true, name: true, category: true },
      take: perGroup,
      orderBy: { updatedAt: "desc" },
    }),
    db.vaultSheet.findMany({
      where: { ...live, OR: [{ name: like }, { notes: like }] },
      select: { id: true, name: true, type: true },
      take: perGroup,
      orderBy: { updatedAt: "desc" },
    }),
    db.vaultDocument.findMany({
      where: { ...live, OR: [{ name: like }, { description: like }] },
      select: { id: true, name: true, type: true, description: true },
      take: perGroup,
      orderBy: { updatedAt: "desc" },
    }),
    db.vaultTask.findMany({
      where: { ...live, OR: [{ name: like }, { description: like }] },
      select: { id: true, name: true, employee: { select: { name: true } } },
      take: perGroup,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const groups = {
    forms: forms.map((f) => ({
      id: f.id,
      title: f.name,
      subtitle: f.notes,
      href: `/vault/forms?q=${encodeURIComponent(f.name)}`,
    })),
    links: links.map((l) => ({
      id: l.id,
      title: l.name,
      /* his own words, printed verbatim — a stored category is never
         translated (ADR-070 §4) */
      subtitle: l.category,
      href: `/vault/links?q=${encodeURIComponent(l.name)}`,
    })),
    sheets: sheets.map((s) => ({
      id: s.id,
      title: s.name,
      subtitle: s.type,
      href: `/vault/sheets?q=${encodeURIComponent(s.name)}`,
    })),
    documents: documents.map((d) => ({
      id: d.id,
      title: d.name,
      subtitle: d.description ?? d.type,
      href: `/vault/documents?q=${encodeURIComponent(d.name)}`,
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.name,
      subtitle: t.employee.name,
      href: `/vault/tasks?q=${encodeURIComponent(t.name)}`,
    })),
  };

  const total =
    groups.forms.length +
    groups.links.length +
    groups.sheets.length +
    groups.documents.length +
    groups.tasks.length;

  return { term: q, total, groups };
}
