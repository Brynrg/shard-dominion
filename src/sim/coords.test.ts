import {
  TILE_SUBUNITS,
  worldToTile,
  tileToWorldCenter,
  worldToScreen,
  screenToWorld,
  world,
  tile,
  type Camera,
} from './coords.js';

describe('coords contract', () => {
  it('WORLD→TILE floor-divides by TILE_SUBUNITS', () => {
    expect(worldToTile(world(0, 0))).toEqual({ tx: 0, ty: 0 });
    expect(worldToTile(world(255, 255))).toEqual({ tx: 0, ty: 0 });
    expect(worldToTile(world(256, 256))).toEqual({ tx: 1, ty: 1 });
    expect(worldToTile(world(40 * TILE_SUBUNITS + 10, 7 * TILE_SUBUNITS))).toEqual({ tx: 40, ty: 7 });
  });

  it('tileToWorldCenter lands at the tile centre and round-trips to the same tile', () => {
    const c = tileToWorldCenter(tile(3, 5));
    expect(c).toEqual({ wx: 3 * 256 + 128, wy: 5 * 256 + 128 });
    expect(worldToTile(c)).toEqual({ tx: 3, ty: 5 });
  });

  it('WORLD↔SCREEN is invertible under a camera', () => {
    const cam: Camera = { x: 1000, y: 2000, zoom: 2 };
    const w = world(40 * 256 + 128, 12 * 256 + 64);
    const s = worldToScreen(w, cam);
    expect(screenToWorld(s, cam)).toEqual({ wx: w.wx, wy: w.wy });
  });
});
