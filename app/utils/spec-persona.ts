export function specPersonaMismatch(requestedPersona: string, activePersona: string) {
  return requestedPersona === activePersona
    ? null
    : `Cannot fetch the ${requestedPersona} Spec while ${activePersona} is active. Switch personas first.`;
}

export function guardSpecPersona(
  requestedPersona: string,
  activePersona: string,
  onMismatch: (message: string) => void,
) {
  const mismatch = specPersonaMismatch(requestedPersona, activePersona);
  if (mismatch) onMismatch(mismatch);
  return mismatch !== null;
}
