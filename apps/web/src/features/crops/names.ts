import type { CatalogueCrop } from "../../design/primitives/crops.js";

export function normalizeCropSearch(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}|\u0640/gu, "")
    .replace(/[إأآٱ]/g, "ا")
    .toLowerCase()
    .trim();
}

export function cropMatches(crop: CatalogueCrop, search: string) {
  const query = normalizeCropSearch(search);
  return [
    crop.name,
    crop.scientificName,
    ...crop.localNames
      .filter(({ language }) => language !== "zgh")
      .map(({ name }) => name),
  ].some((name) => normalizeCropSearch(name).includes(query));
}
