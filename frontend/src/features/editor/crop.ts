export type Crop = { x: number; y: number; width: number; height: number };
export type CropControls = { zoom: number; horizontal: number; vertical: number };
export const MAX_ZOOM = 8;

/** Zoom 1 is the largest square; horizontal and vertical are 0…1 across the free room. */
export function cropFromControls(width: number, height: number, controls: CropControls): Crop {
  const side = Math.max(1, Math.round(Math.min(width, height) / controls.zoom));
  return { x: Math.round((width - side) * controls.horizontal), y: Math.round((height - side) * controls.vertical), width: side, height: side };
}

export function controlsFromCrop(width: number, height: number, crop: Crop): CropControls {
  return {
    zoom: Math.min(width, height) / crop.width,
    horizontal: width === crop.width ? 0.5 : crop.x / (width - crop.width),
    vertical: height === crop.width ? 0.5 : crop.y / (height - crop.width),
  };
}
