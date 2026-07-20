import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Default OG share image for every route that doesn't set its own. Built
 * with next/og's ImageResponse (server-rendered JSX/CSS, no external
 * image tool needed) rather than a static file, so it always matches the
 * live brand tokens instead of drifting out of sync with a hand-exported
 * asset.
 */
export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #0E3B2E 0%, #0A2A20 60%, #144D3B 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <svg width={56} height={56} viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="12.5" stroke="#F6F2E9" strokeWidth="1.4" opacity="0.4" />
            <path d="M16 16 L16 5 A11 11 0 0 1 25.9 21.5 Z" fill="#C6F135" opacity="0.95" />
            <circle cx="16" cy="16" r="3" fill="#F6F2E9" />
          </svg>
          <span style={{ fontSize: 32, fontWeight: 700, color: "#F6F2E9" }}>Sixth Sense</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <span style={{ fontSize: 76, fontWeight: 800, color: "#F6F2E9", lineHeight: 1.05, maxWidth: 980 }}>
            Call it before it happens.
          </span>
          <span style={{ fontSize: 30, color: "rgba(246,242,233,0.72)", maxWidth: 760 }}>
            A live football prediction game. Provably fair, invisibly on chain.
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
