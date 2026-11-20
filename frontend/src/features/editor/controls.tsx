import { useLayoutEffect, useRef, useState, type ChangeEvent, type InputHTMLAttributes, type Ref } from 'react';
import { clampCodePoints } from '../../entities/resume/operations';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Button, TextField } from '../../shared/ui';

/** A compact row action: the theme's small button, 44 px below the desktop layout (NFR-06, DD-UI-16). */
export const ROW_ACTION = 'max-lg:h-[44px] max-lg:min-w-[44px]';
/** An action inside a notice strip. */
export const NOTICE_ACTION = 'h-9 border-current bg-transparent px-2.5 font-semibold text-inherit';

type LimitedProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'id'> & { id: string; label: string; value: string; limit: number; onValue: (value: string) => void; help?: string | undefined; ref?: Ref<HTMLInputElement> | undefined };

/** A text input limited by code points, not UTF-16 units (DD-P08-16), with spell check on (FR-RTE-08). */
export function LimitedField({ id, label, value, limit, onValue, ref, ...props }: LimitedProps) {
  const [clamped, setClamped] = useState(false);
  const change = (event: ChangeEvent<HTMLInputElement>) => {
    const next = clampCodePoints(event.target.value, limit);
    setClamped(next.clamped);
    onValue(next.value);
  };
  return <TextField {...props} {...(ref ? { ref } : {})} id={id} label={label} value={value} onChange={change} spellCheck error={clamped ? `Limited to ${limit} characters; the rest was not added.` : undefined} />;
}

type MoveProps = { index: number; count: number; name: string; onMove: (to: number) => void };

/** Up and down buttons. After a move focus stays on a usable button, even when the row moved in the DOM. */
export function MoveButtons({ index, count, name, onMove }: MoveProps) {
  const up = useRef<HTMLButtonElement>(null);
  const down = useRef<HTMLButtonElement>(null);
  const pending = useRef<'up' | 'down' | null>(null);
  useLayoutEffect(() => {
    if (!pending.current) return;
    const wanted = pending.current === 'up' ? up.current : down.current;
    const other = pending.current === 'up' ? down.current : up.current;
    pending.current = null;
    (wanted?.disabled ? other : wanted)?.focus();
  }, [index]);
  const move = (direction: 'up' | 'down') => {
    pending.current = direction;
    onMove(index + (direction === 'up' ? -1 : 1));
  };
  return <>
    <Button ref={up} type="button" variant="secondary" size="icon-sm" className={ROW_ACTION} aria-label={`Move up ${name}`} title="Move up" disabled={index === 0} onClick={() => move('up')}><ArrowUp aria-hidden="true" /></Button>
    <Button ref={down} type="button" variant="secondary" size="icon-sm" className={ROW_ACTION} aria-label={`Move down ${name}`} title="Move down" disabled={index === count - 1} onClick={() => move('down')}><ArrowDown aria-hidden="true" /></Button>
  </>;
}
