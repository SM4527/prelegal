/** A full page load, so the signed-in user is read afresh. Kept in its own module so tests can mock it. */
export function navigate(url: string) {
  window.location.assign(url);
}
