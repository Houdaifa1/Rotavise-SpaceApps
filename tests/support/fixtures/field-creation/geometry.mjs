// Synthetic geometry fixtures for verification only. No agronomic claims.
export const grid = { zone: 29, south: false };
export const rectangleCells = (width, height, x = 23334, y = 120000) =>
  Array.from(
    { length: width * height },
    (_, i) => `${x + (i % width)},${y + Math.floor(i / width)}`,
  );
export const outline = {
  type: "Polygon",
  coordinates: [
    [
      [-6.55, 32.4],
      [-6.548, 32.4],
      [-6.548, 32.402],
      [-6.55, 32.402],
      [-6.55, 32.4],
    ],
  ],
};
export const concave = {
  type: "Polygon",
  coordinates: [
    [
      [-6.55, 32.4],
      [-6.547, 32.4],
      [-6.547, 32.401],
      [-6.549, 32.401],
      [-6.549, 32.403],
      [-6.55, 32.403],
      [-6.55, 32.4],
    ],
  ],
};
export const bowtie = {
  type: "Polygon",
  coordinates: [
    [
      [-6.55, 32.4],
      [-6.548, 32.402],
      [-6.55, 32.402],
      [-6.548, 32.4],
      [-6.55, 32.4],
    ],
  ],
};
