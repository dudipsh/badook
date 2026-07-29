import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Package, Truck, MapPin } from 'lucide-react';
import { refDataApi, type RefDataStats as Stats } from '../api';

export const RefDataStats = () => {
  const { t } = useTranslation('ref-data');
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    refDataApi.stats().then(setStats).catch(() => {});
  }, []);

  if (!stats) return null;

  const cards = [
    { label: t('stats.products'), value: stats.products, icon: Package, color: 'text-blue-600 bg-blue-50' },
    { label: t('stats.suppliers'), value: stats.suppliers, icon: Truck, color: 'text-green-600 bg-green-50' },
    { label: t('stats.cities'), value: stats.cities, icon: MapPin, color: 'text-purple-600 bg-purple-50' },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color}`}>
            <card.icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{card.value.toLocaleString()}</p>
            <p className="text-sm text-gray-500">{card.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
};
