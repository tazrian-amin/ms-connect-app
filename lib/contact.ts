/*
 * How visitors reach the sales and support team. The app has no backend, so messages are written
 * in the visitor's own email app, filled in for them: they see exactly what goes out, can add to
 * it, and nothing is sent until they press send.
 */

/** Sales and support address. Using Jon's mail for now. */
export const CONTACT_EMAIL = "jon.smith@mining-sentry.com";

/** A `mailto:` link to the team with this subject, and the lines that are given joined as the body. */
export function contactEmailHref(subject?: string, lines: (string | false | null | undefined)[] = []): string {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  const body = lines.filter(Boolean).join("\n");
  if (body) params.set("body", body);
  // URLSearchParams writes spaces as "+", which email apps show literally.
  const query = params.toString().replace(/\+/g, "%20");
  return `mailto:${CONTACT_EMAIL}${query ? `?${query}` : ""}`;
}

/** Opens the visitor's email app with a message to the team. */
export function openContactEmail(subject: string, lines: (string | false | null | undefined)[]): void {
  window.location.href = contactEmailHref(subject, lines);
}
