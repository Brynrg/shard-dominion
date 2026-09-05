# Packet W3a — src/view/onboarding.ts (briefing layout) — emit the COMPLETE file

> View layer only. DOM/canvas allowed here. No `any`; no unused vars. Keep every export and every function not mentioned below byte-for-byte.

## A. `src/view/onboarding.ts` — emit the COMPLETE file
1. `BriefingText` gains two optional fields: `howto?: boolean` (default true) and `subtitle?: string`.
   When `howto === false`, do NOT draw the HOW TO PLAY block (title + 6 lines) — replace it with a
   single grey hint line: `'Hover any sidebar button for its cost and requirements · OBJECTIVES tick off up top.'`
2. Bounded layout in `drawBriefing`. Compute `bottomReserve = 26 (CTA) + 18*2 (hint lines) + 16` and
   `textBottom = H - pad - bottomReserve`. Story lines draw at 20px pitch from `pad + 158`; if the
   story + (howto block if shown) would exceed `textBottom`, first drop the line pitch to 17px and the
   font to 12px monospace; if it STILL overflows, clip the story to the lines that fit and draw a final
   `'…'` line. The hint lines and CTA are always drawn at their fixed positions inside the frame.
3. Portrait placement: if `story.length > 6` (long briefing) draw the portrait SMALL (`ps = 96`) at the
   TOP-RIGHT of the frame beside the title (`px = W - pad - ps - 26, py = pad + 46`), so it never overlaps
   body text; otherwise keep today's bottom-right placement. Keep the existing frame, glow, border.
4. Everything else (STEPS tutorial banner, mission objectives banner, comm panel, `portraitFor`,
   `loadPortrait`, exports) unchanged.


## Output format (STRICT)
```
=== FILE: src/view/onboarding.ts ===
…complete file…
=== END ===
```
