import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

export interface ComboOption {
  id: string;
  name: string;
}

interface Props {
  options: ComboOption[];
  value: string | null;
  placeholder: string;
  onChange: (id: string | null) => void;
}

export const ScopeCombobox = ({ options, value, placeholder, onChange }: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.id === value) ?? null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
    return list.slice(0, 50);
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else setQuery('');
  }, [open]);

  const pick = (id: string | null) => {
    onChange(id);
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') setActive((i) => Math.min(i + 1, filtered.length - 1));
    else if (e.key === 'ArrowUp') setActive((i) => Math.max(i - 1, 0));
    else if (e.key === 'Enter' && filtered[active]) pick(filtered[active].id);
    else if (e.key === 'Escape') setOpen(false);
  };

  const pill =
    'flex items-center gap-1.5 h-7 ps-3 pe-2 rounded-full border text-[12px] font-medium max-w-[190px] transition-colors';

  if (!open) {
    return (
      <div ref={rootRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`${pill} ${selected ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-base-100/80 border-base-300 text-base-content/70 hover:bg-base-200/60'}`}
        >
          <span className="truncate" dir="auto">{selected?.name ?? placeholder}</span>
          {selected ? (
            <X
              className="w-3.5 h-3.5 shrink-0 opacity-60 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
            />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-50" />
          )}
        </button>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="relative w-[190px]">
        <Search className="absolute end-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-40 z-10" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKey}
          placeholder={placeholder}
          dir="auto"
          className="input input-bordered input-xs h-7 w-full rounded-full text-[12px] font-medium pe-7 rtl:text-right ltr:text-left"
        />
      </div>
      <ul className="absolute z-50 w-[230px] mt-1 bg-base-100 border border-base-300 shadow-xl rounded-box max-h-60 overflow-y-auto menu menu-sm p-1">
        {filtered.length === 0 && (
          <li className="px-3 py-2 text-[12px] text-base-content/40 pointer-events-none">—</li>
        )}
        {filtered.map((o, i) => (
          <li key={o.id}>
            <button
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(o.id)}
              className={`text-start py-2 px-3 text-[12.5px] ${o.id === value ? 'font-bold text-primary' : ''} ${i === active ? 'bg-base-200/70' : ''}`}
            >
              <span className="truncate" dir="auto">{o.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
