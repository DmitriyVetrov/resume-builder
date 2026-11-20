/** Geometry is quantised before it is compared or stored, so the model is identical in every runtime (ADR-010 §7). */
export const q = (value: number) => Math.round(value * 1000) / 1000;
