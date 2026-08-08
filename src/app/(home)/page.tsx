/* Brand-neutral root shell — styling via src/themes/neutral.css (the audit-
   sanctioned home for neutral values); the three apps are brand-scoped under their
   own route groups, per SPEC §1/§4. */
export default function Home() {
  return (
    <main style={{ padding: "3rem", maxWidth: "42rem" }}>
      <h1>ByteForce × B-Systems Sales Platform</h1>
      <p>Foundation build (Phase 0). The three applications ship by phase:</p>
      <ul>
        <li>ByteForce CRM — Phase 1</li>
        <li>B-Systems CRM + Partners — Phase 2</li>
        <li>B-Systems Partnership Portal — Phases 3–4</li>
      </ul>
    </main>
  );
}
