import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { FlaskConical, List, FileDown } from 'lucide-react';
import { SamplesTab } from './components/SamplesTab';
import { SampleEditor } from './components/SampleEditor';
import { ExportsTab } from './components/ExportsTab';
import { samplesApi } from './api';
import type { Sample, Stats } from './types';

type Tab = 'samples' | 'editor' | 'exports';

export const TrainingLabPage = () => {
  const { t } = useTranslation('training-lab');
  const { sampleId } = useParams<{ sampleId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>(sampleId ? 'editor' : 'samples');
  const [samples, setSamples] = useState<Sample[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [editingSample, setEditingSample] = useState<Sample | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadSamples = async (p = page) => {
    setIsLoading(true);
    try {
      const data = await samplesApi.list({ page: p, limit: 20 });
      setSamples(data.samples);
      setTotal(data.total);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    const data = await samplesApi.stats();
    setStats(data);
  };

  useEffect(() => {
    loadSamples();
    loadStats();
  }, []);

  useEffect(() => {
    if (sampleId && !editingSample) {
      samplesApi.get(sampleId).then((sample) => {
        setEditingSample(sample);
        setActiveTab('editor');
      }).catch(() => {
        navigate('/training-lab', { replace: true });
      });
    }
  }, [sampleId]);

  const handleEdit = async (sample: Sample) => {
    const fresh = await samplesApi.get(sample.id);
    setEditingSample(fresh);
    setActiveTab('editor');
    navigate(`/training-lab/sample/${sample.id}`);
  };

  const handleEditorBack = () => {
    setEditingSample(null);
    setActiveTab('samples');
    navigate('/training-lab');
    loadSamples();
    loadStats();
  };

  const handleSampleUpdated = (updated: Sample) => {
    setEditingSample(updated);
    setSamples((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'samples', label: t('tabs.samples'), icon: <List size={16} /> },
    { key: 'exports', label: t('tabs.exports'), icon: <FileDown size={16} /> },
  ];

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="flex items-center gap-3 mb-6">
        <FlaskConical size={24} className="text-primary" />
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </div>

      {activeTab !== 'editor' && (
        <div className="tabs tabs-bordered mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`tab gap-2 ${activeTab === tab.key ? 'tab-active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'samples' && (
        <SamplesTab
          samples={samples}
          stats={stats}
          total={total}
          page={page}
          isLoading={isLoading}
          onPageChange={(p) => { setPage(p); loadSamples(p); }}
          onEdit={handleEdit}
          onRefresh={() => { loadSamples(); loadStats(); }}
        />
      )}

      {activeTab === 'editor' && (
        <SampleEditor
          sample={editingSample}
          onBack={handleEditorBack}
          onSampleUpdated={handleSampleUpdated}
        />
      )}

      {activeTab === 'exports' && <ExportsTab />}
    </div>
  );
};
