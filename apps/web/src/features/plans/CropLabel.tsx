import { useBoot } from "../../app/providers/Runtime.js";
import { CropName } from "../../design/primitives/crops.js";
import { useCropNameMode } from "../../shared/cropNamePreference.js";
export function CropLabel({ id }: { id: string }) {
  const { catalog } = useBoot();
  const [mode] = useCropNameMode();
  const crop = catalog.data?.crops.find((crop) => crop.id === id);
  return <CropName cropId={id} {...(crop ? { crop } : {})} nameMode={mode} />;
}
