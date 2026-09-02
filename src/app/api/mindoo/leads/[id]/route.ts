import { internalCrmHandlers } from "@/lib/api/internal-crm";

const handlers = internalCrmHandlers("mindoo");
export const PATCH = handlers.updateLead;
