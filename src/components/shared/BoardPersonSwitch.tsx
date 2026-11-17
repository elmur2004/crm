"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setBoardPerson } from "@/lib/crm/board-person-actions";
import { arrivedByHop, HOP_MARKER_PARAM } from "@/lib/crm/board-person";
import type { Brand } from "@/lib/pipeline-engine/constants";

/* ADR-109 — the company admin's "whose leads" switch, at the top of both CRM
   boards. Founder: "either mine or either this person or this person".

   A native <select>: it carries a long roster on a phone without a custom
   listbox to get wrong, and its accessible name is its own visible label. All
   strings and every option arrive from the server, which also decides whether
   this renders at all (the company admin only) — the client only reports the
   choice. The choice goes through the one server action that writes the
   cookie, then the board re-renders on the server with it. While that runs,
   the select shows what was picked, not what the server last rendered. */

/** After the choice is saved: re-render the board with it.

    On the page a search hop LANDED on, the address carries ADR-085's marker
    naming the other company, and the board shows everyone there
    (board-person.ts, rule 4) — so the marker is dropped and the board he lands
    on is the same address without it. That cannot start a second hop: the
    search already found its card on this board.

    On the page the notice's "Back" link opens, the marker names THIS company:
    it is the loop guard, and this board found nothing for the search — that
    is why the hop happened. Dropping it would hop him straight back to the
    other company, so there the board only refreshes; his choice already
    applies on it (`arrivedByHop` is false). A repeated marker is junk, as it
    is to `parseCompany`, and is left alone. */
function showChoice(router: ReturnType<typeof useRouter>, company: Brand) {
  const url = new URL(window.location.href);
  const markers = url.searchParams.getAll(HOP_MARKER_PARAM);
  if (markers.length === 1 && arrivedByHop(markers[0], company)) {
    url.searchParams.delete(HOP_MARKER_PARAM);
    router.replace(`${url.pathname}${url.search}`);
  } else {
    router.refresh();
  }
}

export interface BoardPersonOptionProps {
  value: string;
  label: string;
}

export function BoardPersonSwitch({
  company,
  value,
  fixed,
  people,
  label,
  teamLabel,
}: {
  company: "bsystems" | "byteforce";
  /** the choice the board is applying right now */
  value: string;
  fixed: BoardPersonOptionProps[];
  people: BoardPersonOptionProps[];
  label: string;
  teamLabel: string;
}) {
  const id = useId();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [picked, setPicked] = useState<string | null>(null);

  function choose(next: string) {
    setPicked(next);
    startTransition(async () => {
      await setBoardPerson(company, next);
      showChoice(router, company);
    });
  }

  return (
    <div className="person-switch" data-pending={pending ? "" : undefined}>
      <label htmlFor={id} className="person-switch-label">
        {label}
      </label>
      <select
        id={id}
        className="field-input person-switch-select"
        value={pending && picked !== null ? picked : value}
        onChange={(e) => choose(e.target.value)}
        aria-busy={pending || undefined}
        data-board-person=""
      >
        {fixed.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {people.length > 0 ? (
          <optgroup label={teamLabel}>
            {people.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </optgroup>
        ) : null}
      </select>
    </div>
  );
}

/** The one-press way out of a search the switch emptied: back to Everyone. */
export function BoardPersonReset({
  company,
  label,
}: {
  company: "bsystems" | "byteforce";
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="btn-ghost btn--sm person-switch-reset"
      disabled={pending}
      aria-busy={pending || undefined}
      onClick={() =>
        startTransition(async () => {
          await setBoardPerson(company, "all");
          showChoice(router, company);
        })
      }
    >
      {label}
    </button>
  );
}
