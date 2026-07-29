import { useState, useRef, useEffect } from 'react';

interface BadgeOrDropdownProps {
  items: { id: string; num: string }[];
  icon: React.ReactNode;
  title: string;
  dropdownTitle: string;
  label: string;
  onSelect: (id: string) => void;
}

export const BadgeOrDropdown = ({ items, icon, title, dropdownTitle, label, onSelect }: BadgeOrDropdownProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (items.length === 1) {
    return (
      <button
        onClick={() => onSelect(items[0].id)}
        title={title}
        className="badge badge-sm border-base-300 font-mono transition-colors cursor-pointer hover:bg-base-200 text-base-content/80 badge-ghost gap-1"
      >
        {icon}
        <span>{items[0].num}</span>
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="badge badge-sm border-base-300 font-mono transition-colors cursor-pointer hover:bg-base-200 text-base-content/80 badge-ghost gap-1"
      >
        {icon}
        <span>+{items.length} {label}</span>
      </button>
      {open && (
        <div className="absolute top-full mt-1 right-0 bg-base-100 border border-base-300 rounded-lg shadow-lg z-[25] w-48 py-1">
          <p className="px-3 py-1.5 text-xs uppercase font-semibold text-base-content/40 tracking-wider">{dropdownTitle}</p>
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => { onSelect(item.id); setOpen(false); }}
              className="w-full text-right px-3 py-2 text-sm text-base-content hover:bg-base-200 transition-colors"
            >
              {item.num}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
