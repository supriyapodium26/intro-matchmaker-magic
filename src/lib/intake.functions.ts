import { createServerFn } from "@tanstack/react-start";

import {
  contactInputValidator,
  handleLookupMember,
  handleSubmitIntake,
  payloadInputValidator,
} from "@/lib/intake.server";

export type { PublicMatch } from "@/lib/intake.server";

export const lookupMember = createServerFn({ method: "POST" })
  .inputValidator(contactInputValidator)
  .handler(async ({ data }) => handleLookupMember(data));

export const submitIntake = createServerFn({ method: "POST" })
  .inputValidator(payloadInputValidator)
  .handler(async ({ data }) => handleSubmitIntake(data));