import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * FE1-S5 (openship#23): the dev banner must exist under development builds and
 * ship nothing under production. The production half is re-verified mechanically
 * by scripts/check-production-bundle.mjs against the built output.
 */
describe("DevBanner", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("renders the dev-mode marker under a development build", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { DevBanner, DEV_BANNER_MARKER } = await import("./dev-banner");
    const html = renderToStaticMarkup(<DevBanner />);
    expect(html).toContain(DEV_BANNER_MARKER);
  });

  it("renders nothing under a production build", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { DevBanner, DEV_BANNER_MARKER } = await import("./dev-banner");
    const html = renderToStaticMarkup(<DevBanner />);
    expect(html).not.toContain(DEV_BANNER_MARKER);
    expect(html).toBe("");
  });
});
