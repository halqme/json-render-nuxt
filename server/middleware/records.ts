import { createError, defineEventHandler, getHeader, getRequestURL } from "h3";

export default defineEventHandler((event) => {
  const localApi =
    event.path.startsWith("/api/workspaces/") ||
    event.path.startsWith("/api/demo/") ||
    event.path.startsWith("/api/views/");
  if (!localApi) return;
  // Check the actual Host, not forwarded headers or Origin: both can match a rebinding domain.
  const host = getHeader(event, "host");
  if (!host || !/^(localhost|127\.0\.0\.1|\[::1\])(?::[0-9]+)?$/i.test(host)) {
    throw createError({ statusCode: 403, statusMessage: "Only loopback hosts are allowed" });
  }
  if (event.method !== "POST" && event.method !== "PATCH") return;
  // No authentication: reject cross-origin browser writes and simple HTML form posts.
  const origin = getHeader(event, "origin");
  if (origin && origin !== getRequestURL(event).origin) {
    throw createError({ statusCode: 403, statusMessage: "Cross-origin writes are not allowed" });
  }
  if (getHeader(event, "content-type")?.split(";")[0]?.trim() !== "application/json") {
    throw createError({ statusCode: 415, statusMessage: "Use application/json" });
  }
});
