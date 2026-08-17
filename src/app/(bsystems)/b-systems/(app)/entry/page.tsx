import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/page-guards";
import { bsRoleOf } from "@/lib/api/bsystems";
import { listMyEntries } from "@/lib/services/data-entry";
import { formatCairoDate } from "@/lib/datetime";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { common } from "@/lib/i18n/dict/crm";
import { entryPage as d } from "@/lib/i18n/dict/entry";
import { prospectKindLabel } from "@/lib/i18n/dict/partners";
import { BsAddLeadForm } from "@/components/bsystems/leadActions";
import { AddProspectForm } from "@/components/partners/forms";
import { CorrectEntryButtons } from "@/components/bsystems/dataEntry";

/* ADR-051 — the data-entry role's whole application: two Add buttons and an
   honest record of what this person has entered. There is no board, no stage
   control and no other lead here, because those are not theirs. */

export async function generateMetadata() {
  return { title: tFor(await getLocale())(d.meta) };
}

export default async function DataEntryPage() {
  const user = await requirePageRole(
    "/login",
    "bsystems_admin",
    "bsystems_sales",
    "bsystems_agent",
    "bsystems_partner",
    "bsystems_data_entry",
  );
  /* the page belongs to data entry; the admin has the real sections */
  if (bsRoleOf(user) !== "bsystems_data_entry") redirect("/b-systems");

  const locale = await getLocale();
  const t = tFor(locale);
  const { leads, prospects } = await listMyEntries(user.id);

  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <p className="u-eyebrow">{t(d.eyebrow)}</p>
          <h1 className="u-h1">{t(d.title)}</h1>
          <p className="u-sub">{t(d.intro)}</p>
        </div>
        {/* both Add actions sit in the page header, exactly as they do on the
            Leads page and the Partners & Agents board — each form renders its
            own card when it opens, so wrapping them here would double it */}
        <div className="page-actions">
          <BsAddLeadForm />
          <AddProspectForm />
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="u-h2">{t(d.leadsHeading)}</h2>
        <p className="u-muted">{t(d.correctHint)}</p>
        {leads.length === 0 ? (
          <p className="empty">{t(d.leadsEmpty)}</p>
        ) : (
          <div className="card card--flush0">
            <div className="table-scroll">
              <table className="table table--embedded">
                <thead>
                  <tr>
                    <th>{t(common.name)}</th>
                    <th>{t(common.company)}</th>
                    <th>{t(common.number)}</th>
                    <th>{t(d.thAdded)}</th>
                    <th>{t(d.thStatus)}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id}>
                      <td>
                        <span className="td-title">{lead.name}</span>
                      </td>
                      <td>{lead.companyName ?? "—"}</td>
                      <td className="td-mono u-ltr">{lead.number}</td>
                      <td>{formatCairoDate(lead.createdAt)}</td>
                      <td>{t(lead.editable ? d.statusWaiting : d.statusTaken)}</td>
                      <td>
                        {lead.editable ? (
                          <CorrectEntryButtons
                            kind="lead"
                            id={lead.id}
                            defaults={{
                              name: lead.name,
                              number: lead.number,
                              email: lead.email,
                              companyName: lead.companyName,
                            }}
                          />
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="u-h2">{t(d.cardsHeading)}</h2>
        {prospects.length === 0 ? (
          <p className="empty">{t(d.cardsEmpty)}</p>
        ) : (
          <div className="card card--flush0">
            <div className="table-scroll">
              <table className="table table--embedded">
                <thead>
                  <tr>
                    <th>{t(common.name)}</th>
                    <th>{t(d.thKind)}</th>
                    <th>{t(common.number)}</th>
                    <th>{t(d.thAdded)}</th>
                    <th>{t(d.thStatus)}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {prospects.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <span className="td-title">{p.companyName ?? p.name}</span>
                      </td>
                      <td>{prospectKindLabel(locale, p.kind)}</td>
                      <td className="td-mono u-ltr">{p.number}</td>
                      <td>{formatCairoDate(p.createdAt)}</td>
                      <td>{t(p.editable ? d.statusWaiting : d.statusInPipeline)}</td>
                      <td>
                        {/* the same correction right, on the same terms — the
                            server grants it for cards too, so the UI must too */}
                        {p.editable ? (
                          <CorrectEntryButtons
                            kind="prospect"
                            id={p.id}
                            withCompany={p.kind !== "agent"}
                            defaults={{
                              name: p.name,
                              number: p.number,
                              email: p.email,
                              companyName: p.companyName,
                            }}
                          />
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
