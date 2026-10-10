import { validateSpec, type Spec } from "@json-render/core";
import { catalog } from "./catalog";

/** Validate without replacing the input: the 0.21 Vue schema omits event fields. */
export function validateViewSpec(input: unknown): Spec {
  catalog.zodSchema().parse(input);
  const spec = input as Spec;
  const result = validateSpec(spec);
  if (!result.valid) throw new Error(`Invalid view structure: ${JSON.stringify(result.issues)}`);
  for (const element of Object.values(spec.elements)) {
    for (const binding of Object.values(element.on ?? {})) {
      for (const action of Array.isArray(binding) ? binding : [binding]) {
        if (!Object.hasOwn(catalog.data.actions, action.action)) {
          throw new Error(`Unknown view action: ${action.action}`);
        }
      }
    }
  }
  return spec;
}
