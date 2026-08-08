import { internalCrmHandlers } from "@/lib/api/internal-crm";

const handlers = internalCrmHandlers("byteforce");
export const POST = handlers.applyLeadEvent;
