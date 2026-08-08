import Link from "next/link";

/* Brand-neutral root entry (ADR-007) — links the three applications; each app is
   fully branded inside its own route group. Styling via src/themes/neutral.css.
   Demo credentials render in development only. */

const DEV = process.env.NODE_ENV !== "production";

const APPS = [
  {
    href: "/byteforce",
    name: "ByteForce CRM",
    audience: "Internal ByteForce team",
    login: "sara@byteforce.example / byteforce123",
  },
  {
    href: "/b-systems",
    name: "B-Systems CRM + Partners",
    audience: "Internal B-Systems team",
    login: "omar@b-systems.example / bsystems123",
  },
  {
    href: "/portal",
    name: "B-Systems Partnership Portal",
    audience: "External sales reps + admin",
    login: "rep 01001234567 / partner123 · admin admin@b-systems.example / admin123",
  },
];

export default function Home() {
  return (
    <main style={{ padding: "3rem", maxWidth: "44rem" }}>
      <h1>ByteForce × B-Systems Sales Platform</h1>
      <p style={{ marginTop: "0.5rem" }}>
        One platform, two brands, three applications — pick yours:
      </p>
      <ul style={{ marginTop: "1.5rem", listStyle: "none", padding: 0, display: "grid", gap: "1rem" }}>
        {APPS.map((app) => (
          <li key={app.href} className="neutral-card">
            <Link href={app.href} style={{ fontWeight: 700, fontSize: "1.125rem" }}>
              {app.name}
            </Link>
            <p className="neutral-muted" style={{ marginTop: "0.25rem" }}>
              {app.audience}
            </p>
            {DEV ? (
              <p className="neutral-faint" style={{ marginTop: "0.25rem" }}>
                Demo login: {app.login}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      {DEV ? (
        <p className="neutral-faint" style={{ marginTop: "1.5rem" }}>
          First run: <code>npx prisma migrate dev</code> then <code>npx prisma db seed</code> for
          the demo data (see README).
        </p>
      ) : null}
    </main>
  );
}
