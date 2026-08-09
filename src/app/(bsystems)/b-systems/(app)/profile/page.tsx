import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/auth/page-guards";
import { bsRoleOf } from "@/lib/api/bsystems";
import { getRepProfile } from "@/lib/services/portal-reps";
import { formatCairoDate } from "@/lib/datetime";
import {
  CvReplaceForm,
  PasswordChangeForm,
  ProfileEditForm,
} from "@/components/portal/profileForms";

export const metadata = { title: "Profile — B-Systems CRM" };

/* V2 §8 — agent: the ex-portal profile (edit, CV, password). Partner: the
   auto-provisioned account's company data (read-only) + password change. */

export default async function ProfilePage() {
  const user = await requirePageRole(
    "/login",
    "bsystems_admin",
    "bsystems_sales",
    "bsystems_agent",
    "bsystems_partner",
  );
  const role = bsRoleOf(user);
  if (role !== "bsystems_agent" && role !== "bsystems_partner") redirect("/b-systems");

  if (role === "bsystems_agent") {
    const profile = await getRepProfile(user.id);
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="page-head">
          <div>
            <p className="u-eyebrow">B-SYSTEMS · PROFILE</p>
            <h1 className="u-h1">Profile</h1>
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
              <p className="fields-label">Phone:</p>
              <p className="fields-value">{profile.user.phone ?? "—"}</p>
            </div>
            <div className="fields-cell">
              <p className="fields-label">Address:</p>
              <p className="fields-value">{profile.address}</p>
            </div>
            <div className="fields-cell">
              <p className="fields-label">Speciality:</p>
              <p className="fields-value">{profile.speciality}</p>
            </div>
            {profile.cv ? (
              <div className="fields-cell">
                <p className="fields-label">CV:</p>
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
          <p className="u-eyebrow">B-SYSTEMS · PROFILE</p>
          <h1 className="u-h1">Profile</h1>
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
              <p className="fields-label">Key person:</p>
              <p className="fields-value">
                {partner.keyPersonName} ({partner.keyPersonRole})
              </p>
            </div>
            <div className="fields-cell">
              <p className="fields-label">Number:</p>
              <p className="fields-value">{partner.number}</p>
            </div>
            <div className="fields-cell">
              <p className="fields-label">Email:</p>
              <p className="fields-value">{partner.email ?? "—"}</p>
            </div>
            <div className="fields-cell">
              <p className="fields-label">Address:</p>
              <p className="fields-value">{partner.address}</p>
            </div>
            <div className="fields-cell">
              <p className="fields-label">Business activity:</p>
              <p className="fields-value">{partner.businessActivity}</p>
            </div>
            <div className="fields-cell">
              <p className="fields-label">Partner since:</p>
              <p className="fields-value">{formatCairoDate(partner.dateJoined)}</p>
            </div>
          </div>
          <p className="panel-hint">
            These details come from the partnership conversion — ask the B-Systems admin to
            correct anything.
          </p>
        </div>
      ) : (
        <p className="empty">No partner record is linked to this account.</p>
      )}
      <div className="card card-pad">
        <PasswordChangeForm />
      </div>
    </div>
  );
}
