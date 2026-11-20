import { useId, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { ApiError, problemMessage } from '../../shared/api/client';
import { Button, buttonClass, Dialog } from '../../shared/ui';
import { masterUrl, renditionUrl, type PhotoInfo } from './api';
import { NotIdleError } from './autosave';
import { controlsFromCrop, cropFromControls, MAX_ZOOM, type CropControls } from './crop';
import type { EditorSession } from './session';

/** DD-P07-06: 5 MB at 1 048 576 bytes per MB. The server stays the authority. */
const MAX_PHOTO_BYTES = 5 * 1_048_576;
const STAGE_PX = 280;

function photoMessage(error: unknown): string {
  if (error instanceof NotIdleError) return 'This needs a connection and saved changes. Try again when the resume shows Saved.';
  if (error instanceof ApiError) {
    if (error.status === 413) return 'This photo is larger than 5 MB.';
    if (error.status === 415) return 'Use a JPEG, PNG or WebP image.';
    switch (error.problem?.code) {
      case 'photo_invalid': return 'This image could not be read. It must be at most 8000 px per side and 40 megapixels.';
      case 'crop_not_square': case 'crop_out_of_bounds': return 'This crop could not be saved. Adjust it and try again.';
      case 'version_mismatch': return 'This resume changed elsewhere and was reloaded. Try again.';
    }
  }
  return problemMessage(error);
}

function CropDialog({ session, photo, onClose }: { session: EditorSession; photo: PhotoInfo; onClose: () => void }) {
  const [controls, setControls] = useState<CropControls>(() => controlsFromCrop(photo.width, photo.height, photo.crop));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const baseId = useId();
  const crop = cropFromControls(photo.width, photo.height, controls);
  const scale = STAGE_PX / crop.width;
  const drag = useRef<{ x: number; y: number; start: CropControls } | null>(null);

  const pointerMove = (event: ReactPointerEvent) => {
    if (!drag.current) return;
    const { x, y, start } = drag.current;
    const side = Math.min(photo.width, photo.height) / start.zoom;
    const roomX = photo.width - side;
    const roomY = photo.height - side;
    const clamp = (value: number) => Math.min(1, Math.max(0, value));
    setControls({
      zoom: start.zoom,
      horizontal: roomX > 0 ? clamp(start.horizontal - (event.clientX - x) / scale / roomX) : start.horizontal,
      vertical: roomY > 0 ? clamp(start.vertical - (event.clientY - y) / scale / roomY) : start.vertical,
    });
  };
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await session.cropPhoto(crop);
      onClose();
    } catch (failure) {
      setError(photoMessage(failure));
      setBusy(false);
    }
  };
  const slider = (name: string, key: keyof CropControls, min: number, max: number, step: number) => <div className="field">
    <label htmlFor={`${baseId}-${key}`}>{name}</label>
    <input id={`${baseId}-${key}`} type="range" min={min} max={max} step={step} value={controls[key]} onChange={event => setControls({ ...controls, [key]: Number(event.target.value) })} />
  </div>;
  return <Dialog title="Crop photo" onClose={onClose} busy={busy}>
    <div className="crop-stage" style={{ width: STAGE_PX, height: STAGE_PX }}
      onPointerDown={event => { drag.current = { x: event.clientX, y: event.clientY, start: controls }; event.currentTarget.setPointerCapture?.(event.pointerId); }}
      onPointerMove={pointerMove} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <img src={masterUrl(session.resumeId, photo)} alt="" draggable={false}
        style={{ width: photo.width * scale, height: photo.height * scale, transform: `translate(${-crop.x * scale}px, ${-crop.y * scale}px)` }} />
    </div>
    {slider('Zoom', 'zoom', 1, MAX_ZOOM, 0.01)}
    {slider('Horizontal position', 'horizontal', 0, 1, 0.01)}
    {slider('Vertical position', 'vertical', 0, 1, 0.01)}
    {error && <p className="field-error" role="alert">{error}</p>}
    <div className="dialog-actions">
      <Button variant="secondary" data-initial-focus onClick={onClose} disabled={busy}>Cancel</Button>
      <Button onClick={() => void save()} disabled={busy}>Save crop</Button>
    </div>
  </Dialog>;
}

export function PhotoPanel({ session, photo, showPhoto }: { session: EditorSession; photo: PhotoInfo | null; showPhoto: boolean }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cropping, setCropping] = useState(false);
  const [removing, setRemoving] = useState(false);
  const baseId = useId();

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_PHOTO_BYTES) { setError('This photo is larger than 5 MB. Choose a smaller one.'); return; }
    setError('');
    setBusy(true);
    try {
      await session.uploadPhoto(file);
      setCropping(true);
    } catch (failure) {
      setError(photoMessage(failure));
    } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      await session.removePhoto();
    } catch (failure) {
      setError(photoMessage(failure));
    } finally { setBusy(false); setRemoving(false); }
  };
  const label = photo ? 'Replace photo' : 'Upload photo';
  return <section className="form-group photo-panel" aria-label="Photo">
    <h3>Photo</h3>
    <div className="photo-row">
      {photo
        ? <img className="photo-thumb" src={renditionUrl(session.resumeId, photo)} alt="Your photo" width={96} height={96} />
        : <div className="photo-thumb empty" aria-hidden="true" />}
      <div className="row-actions">
        <label className={buttonClass('secondary', `file-button ${busy ? 'is-busy' : ''}`)}>
          <span>{label}</span>
          <input type="file" className="sr-only" aria-label={label} accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => void upload(event)} />
        </label>
        {photo && <>
          <Button variant="secondary" disabled={busy} onClick={() => setCropping(true)}>Adjust crop</Button>
          <Button variant="secondary" disabled={busy} onClick={() => setRemoving(true)}>Remove photo</Button>
        </>}
      </div>
    </div>
    <p className="help">JPEG, PNG or WebP, up to 5 MB.</p>
    {photo && <label className="check-field" htmlFor={`${baseId}-show`}>
      <input id={`${baseId}-show`} type="checkbox" className="accent-(--color-brand)" checked={showPhoto} onChange={event => { const shown = event.target.checked; session.apply(document => ({ ...document, header: { ...document.header, showPhoto: shown } }), { label: 'photo visibility' }); }} />
      Show photo
    </label>}
    {error && <p className="field-error" role="alert">{error}</p>}
    {cropping && photo && <CropDialog session={session} photo={photo} onClose={() => setCropping(false)} />}
    {removing && <Dialog title="Remove photo?" onClose={() => setRemoving(false)} busy={busy}>
      <p>The photo is removed from this resume. This cannot be undone.</p>
      <div className="dialog-actions">
        <Button variant="secondary" data-initial-focus disabled={busy} onClick={() => setRemoving(false)}>Cancel</Button>
        <Button variant="danger" disabled={busy} onClick={() => void remove()}>Remove</Button>
      </div>
    </Dialog>}
  </section>;
}
