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
        <h1 className="font-brand-display text-2xl font-bold text-brand-heading">Profile</h1>
        <div className="bg-brand-surface-card border border-brand-border rounded-brand-card p-4 text-sm space-y-1">
          <p className="font-bold text-base">
            {profile.firstName} {profile.lastName}
          </p>
          <p>
            <span className="text-brand-muted">Phone:</span> {profile.user.phone ?? "—"}
          </p>
          <p>
            <span className="text-brand-muted">Address:</span> {profile.address}
          </p>
          <p>
            <span className="text-brand-muted">Speciality:</span> {profile.speciality}
          </p>
          {profile.cv ? (
            <p>
              <span className="text-brand-muted">CV:</span>{" "}
              <a href={`/api/files/${profile.cv.id}`} className="text-brand-link underline underline-offset-2">
                {profile.cv.filename}
              </a>
            </p>
          ) : null}
        </div>
        <ProfileEditForm profile={profile} />
        <div className="bg-brand-surface-card border border-brand-border rounded-brand-card p-4">
          <CvReplaceForm />
        </div>
        <div className="bg-brand-surface-card border border-brand-border rounded-brand-card p-4">
          <PasswordChangeForm />
        </div>
      </div>
    );
  }

  const partner = await db.partner.findUnique({ where: { userId: user.id } });
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="font-brand-display text-2xl font-bold text-brand-heading">Profile</h1>
      {partner ? (
        <div className="bg-brand-surface-card border border-brand-border rounded-brand-card p-4 text-sm space-y-1">
          <p className="font-bold text-base">{partner.companyName}</p>
          <p>
            <span className="text-brand-muted">Key person:</span> {partner.keyPersonName} (
            {partner.keyPersonRole})
          </p>
          <p>
            <span className="text-brand-muted">Number:</span> {partner.number}
          </p>
          <p>
            <span className="text-brand-muted">Email:</span> {partner.email ?? "—"}
          </p>
          <p>
            <span className="text-brand-muted">Address:</span> {partner.address}
          </p>
          <p>
            <span className="text-brand-muted">Business activity:</span> {partner.businessActivity}
          </p>
          <p>
            <span className="text-brand-muted">Partner since:</span>{" "}
            {formatCairoDate(partner.dateJoined)}
          </p>
          <p className="text-xs text-brand-muted pt-1">
            These details come from the partnership conversion — ask the B-Systems admin to
            correct anything.
          </p>
        </div>
      ) : (
        <p className="text-sm text-brand-muted">No partner record is linked to this account.</p>
      )}
      <div className="bg-brand-surface-card border border-brand-border rounded-brand-card p-4">
        <PasswordChangeForm />
      </div>
    </div>
  );
}
