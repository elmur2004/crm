import { requireVaultPage } from "@/lib/auth/page-guards";
import { getLocale } from "@/lib/i18n/server";
import { formatMsg, tFor } from "@/lib/i18n/core";
import { vault } from "@/lib/i18n/dict/vault";
import { formatCairoDate } from "@/lib/datetime";
import {
  listVaultLinkCategories,
  listVaultLinks,
  vaultLinkListParams,
  vaultLinkSuggestionPair,
} from "@/lib/services/vault/links";
import {
  VAULT_COMPANIES,
  VAULT_COMPANY_LABELS,
  VAULT_LINK_CATEGORY_SUGGESTIONS,
  VAULT_LINK_TYPE_LABELS,
  VAULT_LINK_TYPES,
  type VaultCompany,
  type VaultLinkType,
} from "@/lib/services/vault/constants";
import { VaultHead } from "@/components/vault/VaultHead";
import { AddLinkButton, EditLinkButton } from "@/components/vault/forms";
import { ArchiveButton } from "@/components/shared/ArchiveButton";

/* ADR-070 — the vault LINKS section (founder: "a central place to keep any
   important or repeated resources and links we use constantly, instead of
   hunting for them every time").

   Built in the Forms page's image: the same head, the same filter card, the
   same table, the same Edit + Archive pair, admin only behind the same guard.
   What this section adds is the hunting cure — three filters (company,
   category, type) beside the search box, because fifty links are only useful
   if you can cut them down to the three you meant.

   The HOST is printed under every name. He asked to open these straight from
   the Vault, and a link you are about to press should say where it goes before
   you press it. Every link opens in a new tab with rel="noopener noreferrer" —
   the tab it opens can never reach back into the vault through window.opener. */

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: tFor(locale)(vault.metaTitle) };
}

/** The host, for the "where does this go" line. The URL passed the http/https
    rule when it was stored, so this only ever falls back for a row that arrived
    through a module import. */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

/* ADR-070 §5 says the http/https rule absolutely, and the three REST doors keep
   it. There is one write path into this table that does NOT re-run the Zod
   schema: a vault backup IMPORT createMany's the rows of a file verbatim
   (src/lib/services/vault/backup.ts). So a hand-edited export could seat any
   string in `url`, and this is the one page whose whole purpose is that he
   CLICKS these. React would refuse to navigate a javascript: href on its own,
   but the rule is ours to keep, not React's — an address that is not http or
   https is simply not openable here, and the row says so instead of offering a
   link that goes somewhere else. */
function openableHref(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export default async function VaultLinksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireVaultPage();
  const locale = await getLocale();
  const t = tFor(locale);
  const params = vaultLinkListParams.parse(await searchParams);
  const [rows, stored] = await Promise.all([
    listVaultLinks(params),
    listVaultLinkCategories(),
  ]);

  /* the datalist: OUR eight suggestions in the reader's language, then every
     category he has actually typed that is not already among them. His own
     words are never translated (ADR-070 §4) — they are offered back verbatim.

     A stored category is "already among them" if it folds onto EITHER half of a
     suggestion pair, not merely onto the half he is being shown: an English
     "Portfolio" on file is the same category as the Arabic "بورتفوليو" in the
     list, so on the Arabic screen it must not appear a second time. Otherwise
     eight concepts would be offered as nine options, two of them the same
     category — which is what canonicalise() now folds together anyway. */
  const suggestions = VAULT_LINK_CATEGORY_SUGGESTIONS.map(t);
  const categories = [
    ...suggestions,
    ...stored.filter(
      (c) => !vaultLinkSuggestionPair(c.trim().replace(/\s+/g, " ").toLocaleLowerCase()),
    ),
  ];

  /* The category filter offers what is on file — but the filter that is APPLIED
     may no longer be on file: archive the last link in a category and the query
     still carries it, so the select would find no matching option, silently fall
     back to its first ("All"), and read "All" over an empty list with no visible
     reason. What the box shows must be what the query is doing. */
  const filterCategories =
    params.category && !stored.includes(params.category)
      ? [...stored, params.category]
      : stored;

  const companyLabel = (c: string) =>
    (VAULT_COMPANIES as readonly string[]).includes(c)
      ? t(VAULT_COMPANY_LABELS[c as VaultCompany])
      : c;
  const typeLabel = (x: string) =>
    (VAULT_LINK_TYPES as readonly string[]).includes(x)
      ? t(VAULT_LINK_TYPE_LABELS[x as VaultLinkType])
      : x;

  const filtered = Boolean(params.q || params.company || params.category || params.type);

  return (
    <div className="space-y-5">
      <VaultHead locale={locale} title={vault.linksTitle} sub={vault.linksSub} />

      <div className="page-actions">
        <AddLinkButton categories={categories} />
      </div>

      <form method="get" className="card card-pad flex flex-wrap gap-3 items-end">
        <label className="field">
          <span className="field-label">{t(vault.searchShort)}</span>
          <input className="field-input" name="q" defaultValue={params.q ?? ""} maxLength={200} />
        </label>
        <label className="field">
          <span className="field-label">{t(vault.company)}</span>
          <select className="field-input" name="company" defaultValue={params.company ?? ""}>
            <option value="">{t(vault.all)}</option>
            {VAULT_COMPANIES.map((c) => (
              <option key={c} value={c}>
                {t(VAULT_COMPANY_LABELS[c])}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">{t(vault.category)}</span>
          {/* the categories on file, his spelling — never our translation */}
          <select className="field-input" name="category" defaultValue={params.category ?? ""}>
            <option value="">{t(vault.all)}</option>
            {filterCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">{t(vault.type)}</span>
          <select className="field-input" name="type" defaultValue={params.type ?? ""}>
            <option value="">{t(vault.all)}</option>
            {VAULT_LINK_TYPES.map((x) => (
              <option key={x} value={x}>
                {t(VAULT_LINK_TYPE_LABELS[x])}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-ghost">
          {t(vault.apply)}
        </button>
        {filtered ? (
          <a className="btn-ghost" href="/vault/links">
            {t(vault.clear)}
          </a>
        ) : null}
      </form>

      <section className="card card--flush0">
        {rows.length === 0 ? (
          <p className="empty m-4">{t(filtered ? vault.noLinksFiltered : vault.noLinks)}</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>{t(vault.name)}</th>
                  <th>{t(vault.company)}</th>
                  <th>{t(vault.category)}</th>
                  <th>{t(vault.type)}</th>
                  <th>{t(vault.url)}</th>
                  <th>{t(vault.notes)}</th>
                  <th>{t(vault.added)}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => {
                  const href = openableHref(l.url);
                  return (
                    <tr key={l.id}>
                      <td className="td-title">
                        {l.name}
                        {/* where it points, before he presses it */}
                        <span className="td-mono u-ltr block" dir="ltr">
                          {hostOf(l.url)}
                        </span>
                      </td>
                      <td>
                        <span className="chip-outline">{companyLabel(l.company)}</span>
                      </td>
                      {/* his own words, printed exactly as he typed them */}
                      <td>{l.category}</td>
                      <td>
                        <span className="chip-outline">{typeLabel(l.type)}</span>
                      </td>
                      <td>
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="chat-mention"
                            title={l.url}
                            /* the accessible name OPENS WITH THE VISIBLE WORDS, so
                               "click Open link" reaches it by voice (WCAG 2.5.3,
                               Label in Name) and still says WHICH link it opens */
                            aria-label={t(formatMsg(vault.openLinkNamed, { name: l.name }))}
                          >
                            {t(vault.openLink)}
                          </a>
                        ) : (
                          <span className="empty" title={l.url}>
                            {t(vault.linkNotOpenable)}
                          </span>
                        )}
                      </td>
                      <td>{l.notes ?? "—"}</td>
                      <td className="td-mono u-ltr">{formatCairoDate(l.createdAt, locale)}</td>
                      <td>
                        <span className="inline-flex items-center gap-2 flex-wrap">
                          <EditLinkButton
                            row={{
                              id: l.id,
                              company: l.company,
                              name: l.name,
                              url: l.url,
                              category: l.category,
                              type: l.type,
                              notes: l.notes,
                            }}
                            categories={categories}
                          />
                          <ArchiveButton
                            postUrl={`/api/vault/links/${l.id}/archive`}
                            archived={false}
                            confirmText={t(vault.confirmArchive)}
                          />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
