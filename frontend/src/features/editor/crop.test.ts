import { describe, expect, it } from 'vitest';
import { controlsFromCrop, cropFromControls, MAX_ZOOM } from './crop';

describe('photo crop arithmetic', () => {
  it('CR01 gives an integer square inside the master for any controls', () => {
    expect(cropFromControls(1000, 600, { zoom: 1, horizontal: 0.5, vertical: 0.5 })).toEqual({ x: 200, y: 0, width: 600, height: 600 });
    expect(cropFromControls(1000, 600, { zoom: 2, horizontal: 0, vertical: 1 })).toEqual({ x: 0, y: 300, width: 300, height: 300 });
    expect(cropFromControls(1000, 600, { zoom: 2, horizontal: 1, vertical: 0 })).toEqual({ x: 700, y: 0, width: 300, height: 300 });
    for (const [width, height] of [[1, 1], [8000, 5000], [333, 777]] as const) {
      for (const zoom of [1, 1.7, MAX_ZOOM]) {
        const crop = cropFromControls(width, height, { zoom, horizontal: 0.37, vertical: 0.91 });
        expect(crop.width).toBe(crop.height);
        expect(Number.isInteger(crop.x) && Number.isInteger(crop.y) && Number.isInteger(crop.width)).toBe(true);
        expect(crop.width).toBeGreaterThanOrEqual(1);
        expect(crop.x + crop.width).toBeLessThanOrEqual(width);
        expect(crop.y + crop.height).toBeLessThanOrEqual(height);
      }
    }
  });

  it('CR02 maps a stored crop back to controls that reproduce it', () => {
    const crop = { x: 120, y: 40, width: 400, height: 400 };
    expect(cropFromControls(1000, 600, controlsFromCrop(1000, 600, crop))).toEqual(crop);
    expect(controlsFromCrop(800, 800, { x: 0, y: 0, width: 800, height: 800 })).toMatchObject({ zoom: 1 });
  });
});
