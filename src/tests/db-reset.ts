import { db } from "@/lib/db";

/* Deletes all operational rows in FK-safe order. Used by integration tests. */

export async function resetDb(): Promise<void> {
  await db.activityLog.deleteMany();
  await db.attachment.deleteMany(); // references Statement/WonDeal/PortalRep — first
  await db.statement.deleteMany(); // references Milestone (restrict)
  await db.milestone.deleteMany();
  await db.wonDeal.deleteMany();
  await db.followUp.deleteMany();
  await db.meeting.deleteMany();
  await db.proposal.deleteMany();
  await db.lostInfo.deleteMany();
  await db.wonInfo.deleteMany();
  await db.client.deleteMany();
  await db.notification.deleteMany();
  await db.negotiationNote.deleteMany();
  await db.leadComment.deleteMany();
  await db.lead.deleteMany();
  await db.partner.deleteMany();
  await db.partnerProspect.deleteMany();
  await db.portalRep.deleteMany();
  await db.salesRep.deleteMany();
  await db.userRole.deleteMany();
  await db.user.deleteMany();
}
