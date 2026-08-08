import { db } from "@/lib/db";

/* §8.3 — Won Deals. THE REP-FACING SERIALIZER REDACTS LOCKED MILESTONE VALUES
   SERVER-SIDE (ARCHITECTURE §4): milestone 1 is visible; milestone i+1 stays
   locked with a hidden value until the admin checks milestone i. Disclosure is
   controlled here, never in the UI (P-7 API test asserts absence from the payload). */

export interface RepMilestone {
  id: string;
  index: number;
  completed: boolean;
  locked: boolean;
  /** null when locked — the value never reaches the client (§8.3) */
  value: number | null;
}

export interface RepWonDeal {
  id: string;
  deal: {
    id: string;
    name: string;
    position: string;
    number: string;
    email: string | null;
    companyName: string;
    industry: string;
  };
  estimatedValue: number | null;
  totalCommission: number | null;
  milestones: RepMilestone[];
}

function redactMilestones(
  milestones: Array<{ id: string; index: number; value: number; completed: boolean }>,
): RepMilestone[] {
  const sorted = [...milestones].sort((a, b) => a.index - b.index);
  return sorted.map((m, i) => {
    const previous = sorted[i - 1];
    const unlocked = m.index === 1 || Boolean(previous?.completed);
    return {
      id: m.id,
      index: m.index,
      completed: m.completed,
      locked: !unlocked,
      value: unlocked ? m.value : null, // P-7: locked values hidden from the rep
    };
  });
}

export async function repWonDeals(repId: string): Promise<RepWonDeal[]> {
  const wonDeals = await db.wonDeal.findMany({
    where: { deal: { repId } },
    include: {
      deal: true,
      milestones: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return wonDeals.map((w) => ({
    id: w.id,
    deal: {
      id: w.deal.id,
      name: w.deal.name,
      position: w.deal.position,
      number: w.deal.number,
      email: w.deal.email,
      companyName: w.deal.companyName,
      industry: w.deal.industry,
    },
    estimatedValue: w.estimatedValue,
    totalCommission: w.totalCommission,
    milestones: redactMilestones(w.milestones),
  }));
}
