export function mapField(index) {
  const latitude = 32.3373 + index * 0.004;
  const longitude = -6.3498;
  const radius = 0.0004 + index * 0.00001;
  return {
    schema_version: "1",
    name: `Parcelle ${String(index + 1).padStart(2, "0")}`,
    location: { latitude, longitude },
    soil: { status: "unknown" },
    water: { status: "unknown" },
    crop_health: { status: "unknown" },
    ...(index === 0
      ? {}
      : {
          boundary: {
            type: "Polygon",
            coordinates: [
              [
                [longitude - radius, latitude - radius],
                [longitude + radius, latitude - radius],
                [longitude + radius, latitude + radius],
                [longitude - radius, latitude + radius],
                [longitude - radius, latitude - radius],
              ],
            ],
          },
        }),
  };
}
