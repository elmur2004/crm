import Link from "next/link";
import { db } from "@/lib/db";
import { formatCairoDate } from "@/lib/datetime";
import { formatMsg, tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { stageLabel } from "@/lib/i18n/dict/labels";
import { massAssign as m } from "@/lib/i18n/dict/users-app";
import type { Brand, Role } from "@/lib/pipeline-engine/constants";
import {
  listMassAssignCandidates,
  massAssignCompaniesFor,
  OWNER_FILTERS,
  parseCandidateFilters,
  stageOptionsFor,
} from "@/lib/services/mass-assign";
import { USERS_PATH } from "@/lib/launcher/apps";
import { inputCls, labelCls } from "@/components/portal/groupForms";
import { MassAssignForm, type MassAssignRow } from "./MassAssignForm";

/* ============================================================================
   ADR-105 — "Assign leads" for ONE person, on the admin's "All users" view
   (/users?assign=<id>). Founder, 2026-11-15: "add a way to mass assign leads
   to someone — I can choose them in the users section and select mass assign
   and select from the crms both crms".

   The person is the address; the leads are the list: every live lead of a
   company he can own (both CRMs when he can own both) that is not already his,
   narrowed by a plain GET form — which CRM, whose it is now, its stage, a
   search — and ticked in the client half below. The default is the pile the
   admin hands out: unassigned leads and his own, open stages only.

   A same-page view of /users, like `?tab=me` (one-way.test.ts: a view of the
   page is not a door): "Close" and the All users tab both lead back to the
   table. The page renders this for the B-Systems admin alone; the write behind
   it re-checks the company admin of every lead and the target (mass-assign.ts).
   ========================================================================== */

const CRM_NAME: Record<Brand, string> = { bsystems: "B-Systems", byteforce: "ByteForce" };

export interface MassAssignParams {
  company?: string;
  owner?: string;
  stage?: string;
  q?: string;
}

export async function MassAssignBody({
  viewer,
  targetId,
  params,
}: {
  viewer: { id: string; roles: readonly Role[] };
  targetId: string;
  params: MassAssignParams;
}) {
  const locale = await getLocale();
  const t = tFor(locale);
  const close = (
    <Link href={USERS_PATH} prefetch={false} className="btn-ghost btn--sm">
      {t(m.close)}
    </Link>
  );

  const target = await db.user.findUnique({
    where: { id: targetId },
    include: { roles: true },
  });
  const companies = target
    ? massAssignCompaniesFor({ ...target, roles: target.roles.map((r) => r.role) }, viewer)
    : [];
  if (!target || companies.length === 0) {
    const why = !target
      ? t(m.notFound)
      : !target.active || target.registrationStatus !== "approved"
        ? t(formatMsg(m.inactive, { name: target.name }))
        : t(formatMsg(m.cannotOwn, { name: target.name }));
    return (
      <div className="card card-pad lx-assign-card space-y-3">
        <p role="alert" className="alert-error">
          {why}
        </p>
        <div>{close}</div>
      </div>
    );
  }

  const parsed = parseCandidateFilters(params, companies);
  /* a person in the Owner filter must BE a person — not the admin himself (he
     is "Yours"), not the target (his leads are not on offer), not an id that
     names nobody — or the select would say one thing and the list show
     another. Checked BEFORE the list is read, so both always agree. */
  let named: { id: string; name: string } | null = null;
  if (!(OWNER_FILTERS as readonly string[]).includes(parsed.owner)) {
    named =
      parsed.owner === viewer.id || parsed.owner === target.id
        ? null
        : await db.user.findUnique({ where: { id: parsed.owner }, select: { id: true, name: true } });
  }
  const filters = (OWNER_FILTERS as readonly string[]).includes(parsed.owner) || named
    ? parsed
    : { ...parsed, owner: "free" };
  const owner = filters.owner;
  const data = await listMassAssignCandidates(viewer.id, target.id, companies, filters);
  /* a person who owns NONE of these leads any more (the admin just handed them
     all over) stays in the list at 0, so the select keeps saying what the list
     is showing */
  const owners = [...data.owners];
  if (named && !owners.some((o) => o.id === named.id)) owners.push({ ...named, count: 0 });
  const filtered =
    (companies.length > 1 && filters.company !== "both") ||
    owner !== "free" ||
    filters.stage !== "open" ||
    filters.q !== "";

  const rows: MassAssignRow[] = data.rows.map((r) => ({
    id: r.id,
    name: r.name,
    companyName: r.companyName,
    number: r.number,
    crm: CRM_NAME[r.brand],
    stage: stageLabel(locale, r.stage),
    owner:
      r.ownerUserId === null
        ? t(m.ownerUnassigned)
        : r.ownerUserId === viewer.id
          ? t(m.you)
          : (r.ownerName ?? "—"),
    added: formatCairoDate(r.createdAt, locale),
  }));
  const countLine =
    data.total > rows.length
      ? t(formatMsg(m.capped, { shown: String(rows.length), total: String(data.total) }))
      : data.total === 1
        ? t(m.showingOne)
        : t(formatMsg(m.showing, { n: String(data.total) }));

  return (
    <section className="space-y-4" aria-labelledby="mass-assign-title">
      <div className="card card-pad lx-assign-card space-y-4">
        <div className="lx-assign-head">
          <div>
            <h2 id="mass-assign-title" className="u-h3">
              {t(formatMsg(m.title, { name: target.name }))}
            </h2>
            <p className="u-muted mt-1">{t(formatMsg(m.sub, { name: target.name }))}</p>
          </div>
          {close}
        </div>
        <form method="get" action={USERS_PATH} className="lx-assign-filters" aria-label={t(m.filtersAria)}>
          {/* a GET submit REPLACES the query string: keep the person */}
          <input type="hidden" name="assign" value={target.id} />
          {companies.length > 1 ? (
            <label className="lx-assign-field">
              <span className={labelCls}>{t(m.crm)}</span>
              <select name="company" defaultValue={filters.company} className={inputCls}>
                <option value="both">{t(m.bothCrms)}</option>
                {companies.map((c) => (
                  <option key={c} value={c}>
                    {CRM_NAME[c]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="lx-assign-field">
            <span className={labelCls}>{t(m.owner)}</span>
            <select name="owner" defaultValue={owner} className={inputCls}>
              <option value="free">{t(m.ownerFree)}</option>
              <option value="unassigned">{t(m.ownerUnassigned)}</option>
              <option value="mine">{t(m.ownerMine)}</option>
              <option value="any">{t(m.ownerAny)}</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {t(formatMsg(m.ownerCount, { name: o.name, count: String(o.count) }))}
                </option>
              ))}
            </select>
          </label>
          <label className="lx-assign-field">
            <span className={labelCls}>{t(m.stage)}</span>
            <select name="stage" defaultValue={filters.stage} className={inputCls}>
              <option value="open">{t(m.stageOpen)}</option>
              <option value="any">{t(m.stageAny)}</option>
              {stageOptionsFor(companies).map((s) => (
                <option key={s} value={s}>
                  {stageLabel(locale, s)}
                </option>
              ))}
            </select>
          </label>
          <label className="lx-assign-field lx-assign-field--wide">
            <span className={labelCls}>{t(m.search)}</span>
            <input
              type="search"
              name="q"
              defaultValue={filters.q}
              placeholder={t(m.searchPlaceholder)}
              className={inputCls}
            />
          </label>
          <div className="lx-assign-actions">
            <button type="submit" className="btn-primary btn--sm">
              {t(m.apply)}
            </button>
            {filtered ? (
              <Link href={`${USERS_PATH}?assign=${target.id}`} prefetch={false} className="btn-ghost btn--sm">
                {t(m.clear)}
              </Link>
            ) : null}
          </div>
        </form>
      </div>
      <MassAssignForm targetId={target.id} targetName={target.name} rows={rows} countLine={countLine} />
    </section>
  );
}
