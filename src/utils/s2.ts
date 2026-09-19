/**
 * Minimal port of Google S2's lat/lng → cell-id path (S2LatLng →
 * S2Point → face/uv → st → ij → Hilbert curve position), enough to
 * reproduce the `cell_id` values SGPokeMap attaches to raids so the
 * weather cell of a gym can be found from its coordinates alone.
 *
 * Written from scratch instead of pulling in an npm S2 library because
 * the production box is air-gapped and only receives git bundles, so a
 * new dependency would not arrive with the code.
 *
 * Reference: s2geometry/src/s2/s2cell_id.cc (FromFaceIJ, lookup tables)
 * and s2coords.h (face/uv mapping, quadratic ST projection).
 */

const MAX_LEVEL = 30;
const MAX_SIZE = 1 << MAX_LEVEL;
const LOOKUP_BITS = 4;
const SWAP_MASK = 1;
const INVERT_MASK = 2;

// Orientation change applied by each of the four Hilbert sub-cells
const POS_TO_ORIENTATION = [SWAP_MASK, 0, 0, SWAP_MASK | INVERT_MASK];
// Hilbert position → (i, j) sub-cell, indexed by orientation
const POS_TO_IJ = [
  [0, 1, 3, 2],
  [0, 2, 3, 1],
  [3, 2, 0, 1],
  [3, 1, 0, 2],
];

// lookupPos[(ij << 2) | orientation] = (pos << 2) | newOrientation for a
// 4-level (16×16) block of the curve; filled once at module load.
const lookupPos = new Uint16Array(1 << (2 * LOOKUP_BITS + 2));

function initLookupCell(
  level: number,
  i: number,
  j: number,
  origOrientation: number,
  pos: number,
  orientation: number,
): void {
  if (level === LOOKUP_BITS) {
    const ij = (i << LOOKUP_BITS) + j;
    lookupPos[(ij << 2) + origOrientation] = (pos << 2) + orientation;
    return;
  }
  const r = POS_TO_IJ[orientation];
  for (let k = 0; k < 4; k++) {
    initLookupCell(
      level + 1,
      (i << 1) + (r[k] >> 1),
      (j << 1) + (r[k] & 1),
      origOrientation,
      (pos << 2) + k,
      orientation ^ POS_TO_ORIENTATION[k],
    );
  }
}
for (const o of [
  0,
  SWAP_MASK,
  INVERT_MASK,
  SWAP_MASK | INVERT_MASK,
]) {
  initLookupCell(0, 0, 0, o, 0, o);
}

/** Quadratic u/v → s/t projection (S2's default, what the feed uses). */
function uvToSt(u: number): number {
  return u >= 0
    ? 0.5 * Math.sqrt(1 + 3 * u)
    : 1 - 0.5 * Math.sqrt(1 - 3 * u);
}

function stToIj(s: number): number {
  return Math.max(
    0,
    Math.min(MAX_SIZE - 1, Math.floor(s * MAX_SIZE)),
  );
}

/** Cube face (0..5) and (u, v) on that face for a point on the sphere. */
function xyzToFaceUv(
  x: number,
  y: number,
  z: number,
): { face: number; u: number; v: number } {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const az = Math.abs(z);
  let face = ax > ay ? (ax > az ? 0 : 2) : ay > az ? 1 : 2;
  if ((face === 0 ? x : face === 1 ? y : z) < 0) face += 3;
  switch (face) {
    case 0:
      return { face, u: y / x, v: z / x };
    case 1:
      return { face, u: -x / y, v: z / y };
    case 2:
      return { face, u: -x / z, v: -y / z };
    case 3:
      return { face, u: z / x, v: y / x };
    case 4:
      return { face, u: z / y, v: -x / y };
    default:
      return { face, u: -y / z, v: -x / z };
  }
}

/** Leaf (level 30) cell id from a face and its 30-bit i/j coordinates. */
function fromFaceIj(face: number, i: number, j: number): bigint {
  let n = BigInt(face) << 60n;
  let bits = face & SWAP_MASK;
  const mask = (1 << LOOKUP_BITS) - 1;
  // Eight 4-bit slices of i/j, most significant first
  for (let k = 7; k >= 0; k--) {
    bits += ((i >> (k * LOOKUP_BITS)) & mask) << (LOOKUP_BITS + 2);
    bits += ((j >> (k * LOOKUP_BITS)) & mask) << 2;
    bits = lookupPos[bits];
    n |= BigInt(bits >> 2) << BigInt(k * 2 * LOOKUP_BITS);
    bits &= SWAP_MASK | INVERT_MASK;
  }
  return n * 2n + 1n;
}

/**
 * S2 cell id containing `lat`/`lng` at `level`, as the decimal string
 * the SGPokeMap feed uses for `cell_id` (level 10 ≈ 10 km cells, the
 * granularity of in-game weather).
 */
export function latLngToS2CellId(
  lat: number,
  lng: number,
  level = 10,
): string {
  const phi = (lat * Math.PI) / 180;
  const theta = (lng * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const { face, u, v } = xyzToFaceUv(
    Math.cos(theta) * cosPhi,
    Math.sin(theta) * cosPhi,
    Math.sin(phi),
  );
  const leaf = fromFaceIj(face, stToIj(uvToSt(u)), stToIj(uvToSt(v)));
  // Parent at `level`: clear the bits below it and set its trailing 1
  const lsb = 1n << BigInt(2 * (MAX_LEVEL - level));
  return ((leaf & ~(lsb - 1n)) | lsb).toString();
}
