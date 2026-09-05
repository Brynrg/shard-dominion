# Packet W3c — Act III / Act IV cards for scripts/art-gen/presentation.mjs

> Emit ONLY the snippet file described below (plain ESM JavaScript, same style as actCard1/actCard2 in the context).

## C. `scripts/art-gen/presentation.mjs` — emit ONLY a snippet file `=== FILE: SNIPPET/presentation.actCards34.mjs ===`
Two new functions in the exact style of `actCard1`/`actCard2` (same `W`,`H`,`GLOW`,`rnd`, `crystalSeams` helpers,
1280×720 SVG string):
- `actCard3()` — Act III "The Verdict": Halex's Ash Court on black glass-flats under a storm; cyan (Concord)
  and ember (Emberhand) silhouettes standing on the SAME side of the frame; a lightning-lit bunker; ash motes.
- `actCard4()` — Act IV "Genesis": dawn over the sealed/bound Vein; three tall crystal spore towers glowing
  violet (`#b48bff`) with gold (`#ffd34d`) light seams; tiny figures at their feet; calm sky gradient.
Plus the two `PIECES` entries to add: `{ file: 'act3_card', draw: actCard3 }, { file: 'act4_card', draw: actCard4 }`.


## Output format (STRICT)
```
=== FILE: SNIPPET/presentation.actCards34.mjs ===
…actCard3 + actCard4 functions + the two PIECES entries as a comment…
=== END ===
```
