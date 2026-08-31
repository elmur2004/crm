import { db } from "@/lib/db";

/* Deletes all operational rows in FK-safe order. Used by integration tests. */

export async function resetDb(): Promise<void> {
  /* accounting (ADR-052) — children before parents */
  await db.acctLoanPayment.deleteMany();
  await db.acctLoan.deleteMany();
  await db.acctIncome.deleteMany(); // references AcctMediaEntry
  await db.acctExpense.deleteMany(); // references AcctRosterMember
  await db.acctMediaEntry.deleteMany();
  await db.acctPayrollPayment.deleteMany();
  await db.acctRosterSegment.deleteMany();
  await db.acctRosterMember.deleteMany();
  await db.acctTreasuryMove.deleteMany();
  await db.acctTarget.deleteMany();
  await db.acctSettings.deleteMany();
  await db.activityLog.deleteMany();
  await db.undoEntry.deleteMany(); // ADR-045 — undo snapshots are operational rows too
  await db.attachment.deleteMany(); // references Statement/WonDeal/PortalRep + vault rows — first
  /* data vault (ADR-053) — children before parents (task references employee) */
  await db.vaultTask.deleteMany();
  await db.vaultSheet.deleteMany();
  await db.vaultDocument.deleteMany();
  await db.vaultForm.deleteMany();
  await db.vaultLink.deleteMany(); // ADR-070 — no relations, so order is free
  await db.vaultEmployee.deleteMany();
  await db.todoDone.deleteMany(); // references FollowUp/Meeting/Statement/Milestone — before all four
  await db.statement.deleteMany(); // references Milestone (restrict)
  await db.milestone.deleteMany();
  await db.wonDeal.deleteMany();
  await db.followUp.deleteMany();
  await db.meetingAttendee.deleteMany(); // ADR-071 — references Meeting + User, before both
  await db.meeting.deleteMany();
  await db.proposal.deleteMany();
  await db.lostInfo.deleteMany();
  await db.postponeInfo.deleteMany(); // ADR-072
  await db.wonInfo.deleteMany();
  await db.client.deleteMany();
  await db.notification.deleteMany();
  await db.pushSubscription.deleteMany(); // ADR-065 — references User, before it
  await db.negotiationNote.deleteMany();
  await db.leadComment.deleteMany();
  await db.lead.deleteMany();
  await db.partner.deleteMany();
  await db.partnerProspect.deleteMany();
  await db.portalRep.deleteMany();
  await db.salesRep.deleteMany();
  await db.calendarEvent.deleteMany(); // ADR-071 — references User, before it
  await db.userRole.deleteMany();
  await db.user.deleteMany();
}
