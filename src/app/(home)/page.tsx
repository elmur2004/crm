import Link from "next/link";

/* Platform root `/` (ADR-007) — the prototype's hub screen applied per
   docs/DESIGN-APPLICATION-SPEC.md §2.15. Three doors: the two brand apps plus
   the partnership-programme funnel. Demo credentials render in dev only. */

const DEV = process.env.NODE_ENV !== "production";

const DEMOS = [
  { role: "Admin", cred: "admin@byteforce.com / password123" },
  { role: "ByteForce", cred: "sara@byteforce.example / byteforce123" },
  { role: "B-Sys sales", cred: "omar@b-systems.example / bsystems123" },
  { role: "Agent", cred: "01001234567 / partner123" },
];

export default function Home() {
  return (
    <main>
      <header className="hub-hero">
        <p className="hub-eyebrow">Platform root · /</p>
        <h1 className="hub-title">Two companies. One platform.</h1>
        <p className="hub-sub">
          Neutral ground. Pick an application — each one loads its own brand, its own
          pipelines and its own permissions. Sign in once at{" "}
          <span className="hub-code">/login</span> for all of them.
        </p>
      </header>

      <div className="hub-grid">
        <Link href="/byteforce" className="hub-card">
          <span className="hub-card-top">
            <span className="hub-mark-a" aria-hidden />
            <span className="hub-letter">App A</span>
          </span>
          <span className="hub-card-title">ByteForce CRM</span>
          <span className="hub-card-desc">
            The internal ByteForce sales team: leads, reps, the pipeline board and clients.
          </span>
          <span className="hub-card-foot">
            <span className="hub-path">/byteforce</span>
            <span className="hub-arrow hub-arrow--a" aria-hidden>
              →
            </span>
          </span>
        </Link>

        <Link href="/b-systems" className="hub-card">
          <span className="hub-card-top">
            <span className="hub-mark-b" aria-hidden>
              S
            </span>
            <span className="hub-letter">App B</span>
          </span>
          <span className="hub-card-title hub-card-title--b">B-Systems CRM</span>
          <span className="hub-card-desc">
            One role-aware workspace for the whole B-Systems operation — admin, internal
            sales, agents and partners.
          </span>
          <span className="hub-card-foot">
            <span className="hub-path">/b-systems</span>
            <span className="hub-arrow hub-arrow--b" aria-hidden>
              →
            </span>
          </span>
        </Link>

        <Link href="/portal" className="hub-card">
          <span className="hub-card-top">
            <span className="hub-mark-b" aria-hidden>
              S
            </span>
            <span className="hub-letter">Programme</span>
          </span>
          <span className="hub-card-title hub-card-title--b">Partnership Programme</span>
          <span className="hub-card-desc">
            External partner reps apply here — approved reps sign in to the B-Systems CRM.
          </span>
          <span className="hub-card-foot">
            <span className="hub-path">/portal</span>
            <span className="hub-arrow hub-arrow--b" aria-hidden>
              →
            </span>
          </span>
        </Link>
      </div>

      <div className="hub-demo">
        {DEV ? (
          <div>
            <p className="hub-demo-label">Demo accounts · dev only</p>
            <div className="hub-demo-chips">
              {DEMOS.map((d) => (
                <span key={d.role} className="hub-demo-chip">
                  <span className="hub-demo-role">{d.role}</span>
                  {d.cred}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <span />
        )}
        <Link href="/login" className="hub-cta">
          Go to sign in
        </Link>
      </div>
    </main>
  );
}
