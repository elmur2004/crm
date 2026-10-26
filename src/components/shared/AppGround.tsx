/* The ambient ground behind every app screen (src/themes/glass.css).

   Founder, choosing how far the sign-in's glass should go: "Glass frame,
   solid data" — the soft indigo / lavender glow sits BEHIND the solid cards,
   the way the sign-in's ground sits behind its glass. One fixed, aria-hidden,
   pointer-events:none layer, painted below all content and above the canvas.

   · default ("app") — every app shell: a halo that lives only behind the
     header band (it shows through the header's glass) and a faint wash in two
     corners, light enough that plain muted text still reads AA on it.
   · rich — the launcher, /no-access and the portal's sign-up: the sign-in's
     own composition (a strong halo, the brand glow, the wash and three glass
     bubbles), for pages whose words are heading / ink / quiet only.

   A server component with no JavaScript: it is CSS on an empty element. Its
   colours are the NEAREST [data-brand] scope's ground tokens, so it must be
   rendered inside the brand scope it belongs to (the modules mount it inside
   ModuleBrandScope). Removed from print by glass.css. */

export function AppGround({ variant = "app" }: { variant?: "app" | "rich" }) {
  if (variant === "rich") {
    return (
      <div className="app-ground app-ground--rich" aria-hidden="true">
        <span className="ag-blob ag-blob--halo" />
        <span className="ag-blob ag-blob--glow" />
        <span className="ag-blob ag-blob--wash" />
        <span className="ag-orb ag-orb--1" />
        <span className="ag-orb ag-orb--2" />
        <span className="ag-orb ag-orb--3" />
      </div>
    );
  }
  return <div className="app-ground" aria-hidden="true" />;
}
