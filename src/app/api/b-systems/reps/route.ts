import { internalCrmHandlers } from "@/lib/api/internal-crm";

const handlers = internalCrmHandlers("bsystems");
export const POST = handlers.createRep;
