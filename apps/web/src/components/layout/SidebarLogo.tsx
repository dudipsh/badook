interface SidebarLogoProps {
  onClick: () => void;
}

export const SidebarLogo = ({ onClick }: SidebarLogoProps) => {
  return (
    <div className="p-6 border-b border-base-300 flex justify-center">
      <button onClick={onClick} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
        <img src="/logos/BadookMark.svg" alt="Badook Logo" className="w-10 h-10 object-contain" />
        <h1 className="text-3xl text-base-content tracking-tight font-bold">Badook</h1>
      </button>
    </div>
  );
};
