/**
 * Whether a state-changing request (the billing forms' POSTs) came from one
 * of our own pages. Browsers always send `Origin` on a POST, and a page on
 * another site can't forge it.
 *
 * The session cookie's `SameSite=Lax` already keeps another site from
 * making a *signed-in* POST here; this check means that protection doesn't
 * hinge on one cookie attribute alone (cross-site request forgery — see
 * docs/SECURITY.md §5).
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(request.url).origin;
}
