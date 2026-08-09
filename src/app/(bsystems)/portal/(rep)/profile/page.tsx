import { requirePageRole } from "@/lib/auth/page-guards";
import { getRepProfile } from "@/lib/services/portal-reps";
import { CvReplaceForm, PasswordChangeForm, ProfileEditForm } from "@/components/portal/profileForms";
import { redirect } from "next/navigation";

export const metadata = { title: "Profile — Partnership Portal" };

/* §8.4 — all sign-up info; basics editable, CV replaceable/downloadable, password
   change (A-10). */

export default async function Profile() {
  const user = await requirePageRole("/login", "portal_rep", "portal_admin");
  let profile;
  try {
    profile = await getRepProfile(user.id);
  } catch {
    redirect("/portal/crm"); // admin accounts without a rep profile
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="font-brand-display text-2xl font-bold text-brand-heading">Profile</h1>

      <div className="bg-brand-surface-card border border-brand-border rounded-brand-card p-4 text-sm space-y-1">
        <p>
          <span className="text-brand-muted">Name:</span> {profile.firstName} {profile.lastName}
        </p>
        <p>
          <span className="text-brand-muted">Phone:</span> {profile.user.phone}
        </p>
        <p>
          <span className="text-brand-muted">Address:</span> {profile.address}
        </p>
        <p>
          <span className="text-brand-muted">Speciality:</span> {profile.speciality}
        </p>
        <p>
          <span className="text-brand-muted">CV:</span>{" "}
          {profile.cv ? (
            <a
              href={`/api/files/${profile.cv.id}`}
              className="text-brand-link underline underline-offset-2"
            >
              {profile.cv.filename}
            </a>
          ) : (
            "—"
          )}
        </p>
      </div>

      <ProfileEditForm profile={profile} />

      <div className="bg-brand-surface-card border border-brand-border rounded-brand-card p-4">
        <h2 className="text-brand-meta text-brand-muted mb-3">CV</h2>
        <CvReplaceForm />
      </div>

      <div className="bg-brand-surface-card border border-brand-border rounded-brand-card p-4">
        <h2 className="text-brand-meta text-brand-muted mb-3">Password</h2>
        <PasswordChangeForm />
      </div>
    </div>
  );
}
