import { EntitySwitch } from "@/components/shared/EntitySwitch";
import { ShellNav } from "@/components/shared/ShellNav";
import { logout } from "@/lib/auth/actions";
import type { Role } from "@/lib/pipeline-engine/constants";

/* ByteForce app chrome — the prototype's light header (spec §2.1): white bar,
   notched-square mark, orange-tint active nav. Logical properties only (A-12). */

export function AppNav({
  basePath,
  userName,
  roles = [],
  extraItems = [],
}: {
  basePath: string;
  userName: string;
  roles?: Role[];
  extraItems?: Array<{ href: string; label: string }>;
}) {
  const items = [
    { href: basePath, label: "Home" },
    { href: `${basePath}/leads`, label: "Leads" },
    { href: `${basePath}/crm`, label: "CRM" },
    { href: `${basePath}/clients`, label: "Clients" },
    ...extraItems,
  ];
  const initials = userName
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <header className="app-header">
      <span className="logo-a" aria-hidden />
      <span className="wordmark">ByteForce</span>
      <ShellNav items={items} />
      <div className="user">
        <EntitySwitch roles={roles} current="byteforce" />
        <span className="user-avatar" aria-hidden>
          {initials}
        </span>
        <span className="user-meta">
          <span className="user-name block">{userName}</span>
          <span className="user-role block">Staff</span>
        </span>
        <form action={logout.bind(null, "/login")}>
          <button type="submit" className="nav-item" title={userName}>
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}
