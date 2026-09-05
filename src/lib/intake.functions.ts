import { createServerFn } from "@tanstack/react-start";

import {
  handleGetDemoPersona,
  handleSubmitIntake,
  payloadInputValidator,
} from "@/lib/intake.server";

export type { PublicMatch } from "@/lib/intake.server";

export const getDemoPersona = createServerFn({ method: "GET" }).handler(async () =>
  handleGetDemoPersona(),
);

export const submitIntake = createServerFn({ method: "POST" })
  .inputValidator(payloadInputValidator)
  .handler(async ({ data }) => handleSubmitIntake(data));