import { defineEventHandler, readBody, setHeader } from "h3";
import { z } from "zod";
import { demoPersonaIds } from "../../../shared/types";
import { setDemoPersona, demoPersonas, personaInfo } from "../../utils/personas";
import { validate } from "../../utils/records";

export default defineEventHandler(async (event) => {
  const persona = validate(z.enum(demoPersonaIds), (await readBody(event))?.persona);
  setDemoPersona(event, persona);
  setHeader(event, "Cache-Control", "no-store");
  return { persona, personaInfo: personaInfo(persona), personas: demoPersonas };
});
