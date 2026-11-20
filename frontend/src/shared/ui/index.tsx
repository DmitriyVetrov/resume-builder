import { useEffect, useLayoutEffect, useRef, useState, type ComponentProps, type RefObject, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';
import { cn } from 'cn';
import { Badge as BadgeBase } from './badge';
import { Button as ButtonBase, buttonVariants } from './button';
import { Card } from './card';
import { Dialog as DialogRoot, DialogContent, DialogTitle } from './dialog';
import { Input } from './input';
import { Label } from './label';
import { Select as SelectRoot, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from './select';
import { Skeleton } from './skeleton';
export { Progress } from './progress';

/**
 * The project's primitives, built on the shadcn components in this folder (ADR-053 §3). The exported
 * API is the one the features already use; only the rendering changed.
 */
type Variant = 'primary' | 'secondary' | 'danger';
// Danger is the theme's outline button with dark red text: white on the theme's solid
// `--destructive` is below 4.5:1 (DD-UI-18).
const VARIANTS = { primary: 'default', secondary: 'outline', danger: 'outline' } as const;
// The theme's sizes on the desktop layout (DD-UI-16); 44 px targets below it, as the editor's compact controls.
const TOUCH = 'max-lg:h-[44px]';
// Colors only: an opacity fade after `disabled` clears leaves the label below 4.5:1 for 150 ms.
const DISABLED = 'transition-colors aria-disabled:cursor-not-allowed aria-disabled:opacity-60';
/** `--destructive` itself is below 4.5:1 as text on the light scheme. */
export const DANGER_TEXT = 'text-(--color-danger)';
const DANGER_BUTTON = 'text-(--color-danger) hover:text-(--color-danger)';

/** The classes of a button, for a link that looks like one. */
export function buttonClass(variant: Variant = 'primary', className?: string) {
  return cn(buttonVariants({ variant: VARIANTS[variant] }), TOUCH, variant === 'danger' && DANGER_BUTTON, className);
}

export function Button({ variant = 'primary', size, className, ...props }: Omit<ComponentProps<typeof ButtonBase>, 'variant'> & { variant?: Variant }) {
  return <ButtonBase {...props} variant={VARIANTS[variant]} size={size ?? 'default'} className={cn(size ? undefined : TOUCH, DISABLED, variant === 'danger' && DANGER_BUTTON, className)} />;
}

export function AppFrame({ children }: { children: ReactNode }) {
  return <div className="app-frame">{children}</div>;
}

export function Surface({ children, className }: { children: ReactNode; className?: string }) {
  return <Card className={cn('surface min-w-0 items-start gap-3 p-6 shadow-sm', className)}>{children}</Card>;
}

export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return <p className="field-error mt-2 text-sm text-(--color-danger)" id={id}>{children}</p>;
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; id: string; error?: string | undefined; help?: string | undefined };
function describedBy(id: string, error?: string, help?: string, existing?: string) {
  return [existing, help && `${id}-help`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
}
/**
 * Fields have the theme's look (DD-UI-16, DD-UI-17); 44 px below the desktop layout. The focus ring appears
 * at once: the theme fades `box-shadow` in over 150 ms (DD-UI-14 for buttons).
 */
export const CONTROL = cn(TOUCH, 'transition-colors');
export { Input } from './input';

export type Choice = { value: string; label: string; disabled?: boolean | undefined };
/** Radix keeps the empty value for "nothing selected", so an option whose value is '' is stored as this. */
const EMPTY = '\u2205';
type SelectProps = { id: string; value: string; options: readonly Choice[]; onValue: (value: string) => void; disabled?: boolean | undefined; className?: string | undefined; 'aria-invalid'?: boolean | undefined; 'aria-describedby'?: string | undefined };

/**
 * The theme's Select (DD-UI-16): a button with role `combobox` and a listbox popover; a `<label htmlFor={id}>`
 * names it. The trigger and each option carry `data-value`, the value a native `<select>` exposed.
 */
export function Select({ id, value, options, onValue, disabled, className, ...aria }: SelectProps) {
  return <SelectRoot value={value === '' ? EMPTY : value} onValueChange={next => onValue(next === EMPTY ? '' : next)} disabled={disabled}>
    <SelectTrigger id={id} data-value={value} className={cn('w-full transition-colors max-lg:data-[size=default]:h-[44px]', className)} {...aria}><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectGroup>
        {options.map(option => <SelectItem key={option.value} data-value={option.value} value={option.value === '' ? EMPTY : option.value} disabled={option.disabled}>{option.label}</SelectItem>)}
      </SelectGroup>
    </SelectContent>
  </SelectRoot>;
}

function FieldFoot({ id, error, help }: { id: string; error?: string | undefined; help?: string | undefined }) {
  return <>
    {help && <p className="help mt-1 text-sm text-muted-foreground" id={`${id}-help`}>{help}</p>}
    {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
  </>;
}

export function TextField({ label, id, error, help, ref, className, ...props }: FieldProps & { ref?: Ref<HTMLInputElement> }) {
  return <div className="field">
    <Label htmlFor={id} className="mb-2">{label}</Label>
    <Input {...props} ref={ref} id={id} className={cn(CONTROL, className)} aria-invalid={!!error} aria-describedby={describedBy(id, error, help, props['aria-describedby'])} />
    <FieldFoot id={id} error={error} help={help} />
  </div>;
}

export function PasswordField({ label = 'Password', id, error, help, ...props }: Omit<FieldProps, 'label'> & { label?: string }) {
  const [shown, setShown] = useState(false);
  return <div className="field">
    <Label htmlFor={id} className="mb-2">{label}</Label>
    <div className="relative">
      <Input {...props} id={id} type={shown ? 'text' : 'password'} className={cn(CONTROL, 'pr-20')} aria-invalid={!!error} aria-describedby={describedBy(id, error, help, props['aria-describedby'])} />
      <ButtonBase type="button" variant="ghost" size="sm" className="absolute top-1/2 right-1 h-7 -translate-y-1/2 px-2 text-accent-foreground max-lg:h-9"
        aria-label={shown ? 'Hide characters' : 'Show characters'} aria-controls={id} aria-pressed={shown} onClick={() => setShown(!shown)}>{shown ? 'Hide' : 'Show'}</ButtonBase>
    </div>
    <FieldFoot id={id} error={error} help={help} />
  </div>;
}

export function StatusNotice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  // An error notice is focusable so a rejected submit can put the keyboard user on the message
  // itself when no single field is at fault. It stays out of the tab sequence.
  return <p className={cn('notice rounded-lg px-4 py-3 text-sm', error ? 'error bg-(--color-danger-soft) font-medium text-(--color-danger)' : 'bg-accent text-accent-foreground')}
    role={error ? 'alert' : 'status'} aria-atomic="true" tabIndex={error ? -1 : undefined}>{children}</p>;
}

export function Badge({ children }: { children: ReactNode }) {
  return <BadgeBase variant="secondary" className="badge h-6 px-2.5 text-sm">{children}</BadgeBase>;
}

export function LoadingSkeleton({ label = 'Loading account…' }: { label?: string }) {
  return <Skeleton className="loading-skeleton rounded-2xl p-6 text-foreground" role="status">{label}</Skeleton>;
}

/**
 * Gives focus back to the opener when the dialog unmounts. It sits inside the content, so its cleanup
 * runs after Radix's focus trap has been removed, and before the effects of what replaced the dialog,
 * which may move focus on purpose (a notice's Undo, a status line).
 */
function ReturnFocus({ opener }: { opener: RefObject<HTMLElement | null> }) {
  useEffect(() => () => { if (opener.current?.isConnected) opener.current.focus(); }, [opener]);
  return null;
}

/**
 * A modal dialog on the shadcn (Radix) Dialog, with the behavior of the native one it replaced
 * (ADR-053 §4): initial focus on `[data-initial-focus]`, Escape closes unless busy, an outside click
 * never closes, and focus returns to the opener unless something else already took it.
 */
export function Dialog({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  // The opener, read before the dialog takes focus. A modal Radix dialog returns focus to its trigger,
  // later and asynchronously; these dialogs have none, so ReturnFocus does it.
  const opener = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }, []);
  return <DialogRoot open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent showCloseButton={false} aria-describedby={undefined}
      className="max-h-[calc(100dvh-2rem)] gap-0 duration-0 overflow-y-auto text-base sm:max-w-lg"
      onOpenAutoFocus={event => {
        const target = (event.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>('[data-initial-focus]');
        if (!target) return;
        event.preventDefault();
        target.focus();
      }}
      onEscapeKeyDown={event => { if (busy) event.preventDefault(); }}
      onInteractOutside={event => event.preventDefault()}
      onCloseAutoFocus={event => event.preventDefault()}>
      <ReturnFocus opener={opener} />
      <DialogTitle tabIndex={-1} className="mb-3">{title}</DialogTitle>
      {children}
    </DialogContent>
  </DialogRoot>;
}
