import { useSyncExternalStore } from 'react';
import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
import { getThemePreference, setThemePreference, subscribeTheme, type ThemePreference } from '../shared/lib/theme';
import { Button } from '../shared/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '../shared/ui/dropdown-menu';

const CHOICES = [['light', 'Light', SunIcon], ['dark', 'Dark', MoonIcon], ['system', 'System', MonitorIcon]] as const;

/** The color scheme switch in the app header (ADR-053 §6). */
export function ThemeSwitch() {
  const preference = useSyncExternalStore(subscribeTheme, getThemePreference);
  const Icon = CHOICES.find(([value]) => value === preference)![2];
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon-lg" className="ml-auto size-11" aria-label="Theme" title="Theme"><Icon aria-hidden="true" /></Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-40">
      <DropdownMenuLabel>Theme</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={preference} onValueChange={value => setThemePreference(value as ThemePreference)}>
        {CHOICES.map(([value, label, ItemIcon]) => <DropdownMenuRadioItem key={value} value={value} className="min-h-9 max-lg:min-h-[44px]"><ItemIcon aria-hidden="true" />{label}</DropdownMenuRadioItem>)}
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}
