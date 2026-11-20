import { useId, type ReactNode } from 'react';
import { Select } from '../../../shared/ui';

export function DesignCard({ title, children }: { title?: string; children: ReactNode }) {
  return <div className="design-card">{title && <h3 className="design-card-title">{title}</h3>}{children}</div>;
}

/** A native radio group, so arrow keys and screen-reader behaviour come from the platform. */
export function RadioGroup({ legend, children, className = '' }: { legend: string; children: ReactNode; className?: string }) {
  const id = useId();
  return <div className={`design-group ${className}`}>
    <span id={id} className="design-label">{legend}</span>
    <div role="radiogroup" aria-labelledby={id} className="design-options">{children}</div>
  </div>;
}

type Option<T extends string> = { value: T; label: string };

export function Segmented<T extends string>({ legend, options, value, onChange }: { legend: string; options: readonly Option<T>[]; value: T; onChange: (value: T) => void }) {
  const name = useId();
  return <RadioGroup legend={legend} className="segmented">
    {options.map(option => <label key={option.value} className={`design-option segment ${option.value === value ? 'is-selected' : ''}`}>
      <input type="radio" name={name} value={option.value} checked={option.value === value} onChange={() => onChange(option.value)} />
      <span>{option.label}</span>
    </label>)}
  </RadioGroup>;
}

export function Slider({ label, value, onChange, onReset }: { label: string; value: number; onChange: (value: number) => void; onReset: () => void }) {
  const id = useId();
  return <div className="design-slider">
    <div className="design-slider-head"><label htmlFor={id} className="design-label">{label}</label><span className="design-value" data-testid={`value-${label}`}>{value}</span></div>
    <input id={id} type="range" min={0} max={20} step={1} value={value} aria-valuetext={String(value)} onChange={event => onChange(Number(event.target.value))} onDoubleClick={onReset} />
  </div>;
}

export function SelectField<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly Option<T>[]; onChange: (value: T) => void }) {
  const id = useId();
  return <div className="field design-select">
    <label htmlFor={id} className="design-label">{label}</label>
    <Select id={id} value={value} options={options} onValue={next => onChange(next as T)} />
  </div>;
}
