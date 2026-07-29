interface DocTab {
  key: string;
  label: string;
  icon: React.ComponentType<{ size: number }>;
  count: number;
}

interface DocTabBarProps {
  tabs: DocTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

export const DocTabBar = ({ tabs, activeTab, onTabChange }: DocTabBarProps) => (
  <div className="flex gap-1 mb-4 bg-base-200 rounded-lg p-1 w-fit">
    {tabs.map((tab) => (
      <button
        key={tab.key}
        onClick={() => onTabChange(tab.key)}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          activeTab === tab.key
            ? 'bg-base-100 text-base-content shadow-sm'
            : 'text-base-content/50 hover:text-base-content'
        }`}
      >
        <tab.icon size={14} />
        {tab.label}
        <span className="bg-base-300 text-base-content/60 text-xs px-1.5 py-0.5 rounded-full">
          {tab.count}
        </span>
      </button>
    ))}
  </div>
);
