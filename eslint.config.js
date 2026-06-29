// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Flat config. The load-bearing piece is the SIM-PURITY GUARDRAIL scoped to
 * `src/sim/**`: it makes the deterministic-core boundary a *red build*, not a
 * polite request. `src/sim` may contain NO DOM, NO wall-clock, and NO
 * `Math.random` — those reach the sim only through the seeded PRNG (`rng.ts`)
 * and the renderer/loop in `src/view`.
 */
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // ── SIM PURITY GUARDRAIL ──────────────────────────────────────────────────
  {
    files: ['src/sim/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'sim purity: no DOM in src/sim (renderer lives in src/view).' },
        { name: 'document', message: 'sim purity: no DOM in src/sim.' },
        { name: 'navigator', message: 'sim purity: no DOM in src/sim.' },
        { name: 'localStorage', message: 'sim purity: no storage in src/sim.' },
        { name: 'requestAnimationFrame', message: 'sim purity: the rAF loop lives in src/view.' },
        { name: 'fetch', message: 'sim purity: no IO in src/sim (data is injected via loaders).' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'sim purity: use the seeded PRNG in src/sim/rng.ts, never Math.random.' },
        { object: 'Date', property: 'now', message: 'sim purity: no wall-clock in the sim.' },
        { object: 'performance', property: 'now', message: 'sim purity: no wall-clock in the sim.' },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: "NewExpression[callee.name='Date']", message: 'sim purity: no Date in the sim (no wall-clock; positions are integers, time is ticks).' },
        { selector: "CallExpression[callee.object.name='Date']", message: 'sim purity: no Date.* in the sim.' },
        { selector: "CallExpression[callee.name='setTimeout']", message: 'sim purity: no timers in the sim; advance state in tick().' },
        { selector: "CallExpression[callee.name='setInterval']", message: 'sim purity: no timers in the sim; advance state in tick().' },
      ],
    },
  },

  // ── NO-SECOND-SPATIAL-INDEX / NO-CORE-RECONSTRUCTION GUARDRAIL ────────────
  // Systems receive SimState and read state.grid / state.store. They must NEVER
  // construct the grid, the store, the map, or a SimState — that is the "two
  // brains driving one car" failure. Trying to is a red build.
  {
    files: ['src/sim/systems/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/grid', '**/grid.js'], importNames: ['makeGridManager', 'makeTerrainGrid'], message: 'no-second-spatial-index: systems read state.grid; never construct a grid.' },
            { group: ['**/map', '**/map.js'], importNames: ['generateMap'], message: 'systems never generate the map (one map path lives in makeSimState).' },
            { group: ['**/store', '**/store.js'], importNames: ['makeEntityStore'], message: 'systems use state.store; never construct a store.' },
            { group: ['**/state', '**/state.js'], importNames: ['makeSimState'], message: 'systems receive SimState; never construct it.' },
          ],
        },
      ],
    },
  },

  // Tests may use loose typing for fixtures.
  {
    files: ['tests/**/*.ts', 'src/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
