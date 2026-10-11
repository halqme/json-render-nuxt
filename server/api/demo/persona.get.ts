import { defineEventHandler, setHeader } from "h3";
import { getDemoPersona, demoPersonas, personaInfo } from "../../utils/personas";

export default defineEventHandler((event) => {
  setHeader(event, "Cache-Control", "no-store");
  const persona = getDemoPersona(event);
  return { persona, personaInfo: personaInfo(persona), personas: demoPersonas };
});
