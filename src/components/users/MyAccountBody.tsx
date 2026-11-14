import { getMyAccount } from "@/lib/services/my-account";
import { formatCairoDate } from "@/lib/datetime";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { common, profile as profileLabels, roleBadges, usersAdmin } from "@/lib/i18n/dict/admin";
import { usersApp as m } from "@/lib/i18n/dict/users-app";
import { MyCvForm, MyDetailsForm, MyPasswordForm } from "./MyAccountForms";

/* ADR-103 — "My account": what every person sees in the Users app, and the
   B-Systems admin's second tab. The person's OWN row, read by the session's id
   (the page passes `requireUser().id`) — there is no id in the address, so
   there is nothing to change to reach somebody else's.

   Solid cards on the launcher's glass ground (ADR-092: "glass frame, solid
   data"). Every company's people use it, so it wears the neutral scope like the
   launcher; the B-Systems agent's CV and the partner's company details are the
   only parts that are one company's. */

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

export async function MyAccountBody({ userId }: { userId: string }) {
  const account = await getMyAccount(userId);
  const locale = await getLocale();
  const t = tFor(locale);

  return (
    <div className="lx-account">
      <section className="card card--flush0" aria-label={account.name}>
        <div className="identity-head">
          <div className="flex items-center gap-3">
            <span className="avatar-lg" aria-hidden="true">
              {initialsOf(account.name)}
            </span>
            <div className="min-w-0">
              <p className="identity-name">{account.name}</p>
              <p className="u-muted">{account.email ?? account.phone ?? "—"}</p>
            </div>
          </div>
        </div>
        <div className="card-pad space-y-2">
          <p className="fields-label">{t(m.accessLabel)}</p>
          <p className="flex gap-1 flex-wrap">
            {account.roles.map((role) => (
              <span key={role} className="badge badge--entity">
                {roleBadges[role] ? t(roleBadges[role]) : role}
              </span>
            ))}
          </p>
          <p className="field-hint">{t(m.accessHint)}</p>
        </div>
      </section>

      <section className="card card-pad space-y-3" aria-labelledby="me-details">
        <h2 id="me-details" className="u-h3">
          {t(m.detailsTitle)}
        </h2>
        <MyDetailsForm
          details={{
            kind: account.kind,
            name: account.name,
            email: account.email,
            phone: account.phone,
            pinned: account.pinned,
            agent: account.agent,
          }}
        />
      </section>

      <section className="card card-pad space-y-3" aria-labelledby="me-password">
        <h2 id="me-password" className="u-h3">
          {t(m.passwordTitle)}
        </h2>
        {account.pinned ? (
          /* bootstrap.ts re-asserts this password on every sign-in */
          <p className="field-hint">{t(usersAdmin.pinnedPasswordHint)}</p>
        ) : (
          <MyPasswordForm />
        )}
      </section>

      {account.agent ? (
        <section className="card card-pad space-y-3" aria-labelledby="me-cv">
          <h2 id="me-cv" className="u-h3">
            {t(m.cvTitle)}
          </h2>
          {account.agent.cv ? (
            <p className="flex items-center gap-3">
              <span className="file-icon" aria-hidden="true">
                PDF
              </span>
              <a href={`/api/files/${account.agent.cv.id}`} className="text-brand-link underline underline-offset-2">
                {account.agent.cv.filename}
              </a>
            </p>
          ) : (
            <p className="u-muted">{t(m.noCv)}</p>
          )}
          <MyCvForm />
        </section>
      ) : null}

      {account.partner ? (
        <section className="card card--flush0" aria-labelledby="me-company">
          <div className="identity-head">
            <h2 id="me-company" className="u-h3">
              {t(m.companyTitle)} · {account.partner.companyName}
            </h2>
          </div>
          <div className="fields-grid">
            <div className="fields-cell">
              <p className="fields-label">{t(profileLabels.labelKeyPerson)}</p>
              <p className="fields-value">
                {account.partner.keyPersonName} ({account.partner.keyPersonRole})
              </p>
            </div>
            <div className="fields-cell">
              <p className="fields-label">{t(common.labelNumber)}</p>
              <p className="fields-value">{account.partner.number}</p>
            </div>
            <div className="fields-cell">
              <p className="fields-label">{t(common.labelEmail)}</p>
              <p className="fields-value">{account.partner.email ?? "—"}</p>
            </div>
            <div className="fields-cell">
              <p className="fields-label">{t(common.labelAddress)}</p>
              <p className="fields-value">{account.partner.address}</p>
            </div>
            <div className="fields-cell">
              <p className="fields-label">{t(profileLabels.labelBusinessActivity)}</p>
              <p className="fields-value">{account.partner.businessActivity}</p>
            </div>
            <div className="fields-cell">
              <p className="fields-label">{t(profileLabels.labelPartnerSince)}</p>
              <p className="fields-value">{formatCairoDate(account.partner.dateJoined, locale)}</p>
            </div>
          </div>
          <p className="panel-hint">{t(profileLabels.conversionHint)}</p>
        </section>
      ) : null}
    </div>
  );
}
