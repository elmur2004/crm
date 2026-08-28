import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireCompanySection } from "@/lib/auth/page-guards";
import { bsRoleOf } from "@/lib/api/bsystems";
import { getRepProfile } from "@/lib/services/portal-reps";
import { formatCairoDate } from "@/lib/datetime";
import {
  CvReplaceForm,
  PasswordChangeForm,
  ProfileEditForm,
} from "@/components/portal/profileForms";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { common, profile as d } from "@/lib/i18n/dict/admin";

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: tFor(locale)(d.meta) };
}

/* V2 §8 — agent: the ex-portal profile (edit, CV, password). Partner: the
   auto-provisioned account's company data (read-only) + password change. */

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  /* ADR-067 — a B-Systems-ONLY section: refused under company=byteforce, and
     refused BEFORE the role narrowing below, so a ByteForce-only teammate is
     redirected rather than falling into bsRoleOf and turning into a 500.
     Past this line bsRoleOf is TOTAL: holding "bsystems" is exactly holding one
     of the five B-Systems roles, so it can no longer throw. */
  const { user } = await requireCompanySection(
    "bsystems",
    (await searchParams).company,
  );
  const role = bsRoleOf(user);
  if (role !== "bsystems_agent" && role !== "bsystems_partner") redirect("/b-systems");
  const locale = await getLocale();
  const t = tFor(locale);

  if (role === "bsystems_agent") {
    const profile = await getRepProfile(user.id);
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="page-head">
          <div>
            <p className="u-eyebrow">{t(d.eyebrow)}</p>
            <h1 className="u-h1">{t(d.title)}</h1>
          </div>
        </div>
        <div className="card card--flush0">
          <div className="identity-head">
            <div className="flex items-center gap-3">
              <span className="avatar-lg" aria-hidden="true">
                {profile.firstName.charAt(0)}
                {profile.lastName.charAt(0)}
              </span>
              <p className="identity-name">
                {profile.firstName} {profile.lastName}
              </p>
            </div>
          </div>
          <div className="fields-grid">
            <div className="fields-cell">
              <p className="fields-label">{t(common.labelPhone)}</p>
              <p className="fields-value">{profile.user.phone ?? "—"}</p>
            </div>
            <div className="fields-cell">
              <p className="fields-label">{t(common.labelAddress)}</p>
              <p className="fields-value">{profile.address}</p>
            </div>
            <div className="fields-cell">
              <p className="fields-label">{t(d.labelSpeciality)}</p>
              <p className="fields-value">{profile.speciality}</p>
            </div>
            {profile.cv ? (
              <div className="fields-cell">
                <p className="fields-label">{t(d.labelCv)}</p>
                <p className="fields-value flex items-center gap-3">
                  <span className="file-icon" aria-hidden="true">
                    PDF
                  </span>
                  <a href={`/api/files/${profile.cv.id}`} className="text-brand-link underline underline-offset-2">
                    {profile.cv.filename}
                  </a>
                </p>
              </div>
            ) : null}
          </div>
        </div>
        <ProfileEditForm profile={profile} />
        <div className="card card-pad">
          <CvReplaceForm />
        </div>
        <div className="card card-pad">
          <PasswordChangeForm />
        </div>
      </div>
    );
  }

  const partner = await db.partner.findUnique({ where: { userId: user.id } });
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="page-head">
        <div>
          <p className="u-eyebrow">{t(d.eyebrow)}</p>
          <h1 className="u-h1">{t(d.title)}</h1>
        </div>
      </div>
      {partner ? (
        <div className="card card--flush0">
          <div className="identity-head">
            <div className="flex items-center gap-3">
              <span className="avatar-lg" aria-hidden="true">
                {partner.companyName.charAt(0)}
              </span>
              <p className="identity-name">{partner.companyName}</p>
            </div>
          </div>
          <div className="fields-grid">
            <div className="fields-cell">
              <p className="fields-label">{t(d.labelKeyPerson)}</p>
              <p className="fields-value">
                {partner.keyPersonName} ({partner.keyPersonRole})
              </p>
            </div>
            <div className="fields-cell">
              <p className="fields-label">{t(common.labelNumber)}</p>
              <p className="fields-value">{partner.number}</p>
            </div>
            <div className="fields-cell">
              <p className="fields-label">{t(common.labelEmail)}</p>
              <p className="fields-value">{partner.email ?? "—"}</p>
            </div>
            <div className="fields-cell">
              <p className="fields-label">{t(common.labelAddress)}</p>
              <p className="fields-value">{partner.address}</p>
            </div>
            <div className="fields-cell">
              <p className="fields-label">{t(d.labelBusinessActivity)}</p>
              <p className="fields-value">{partner.businessActivity}</p>
            </div>
            <div className="fields-cell">
              <p className="fields-label">{t(d.labelPartnerSince)}</p>
              <p className="fields-value">{formatCairoDate(partner.dateJoined)}</p>
            </div>
          </div>
          <p className="panel-hint">{t(d.conversionHint)}</p>
        </div>
      ) : (
        <p className="empty">{t(d.noPartnerRecord)}</p>
      )}
      <div className="card card-pad">
        <PasswordChangeForm />
      </div>
    </div>
  );
}
