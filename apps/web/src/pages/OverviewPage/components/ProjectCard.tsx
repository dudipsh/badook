import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Building2, MapPin, AlertTriangle, Users, MoreHorizontal, GitMerge, Archive, Trash2 } from 'lucide-react';
import type { Project } from '../../../services/projects.service';
import type { ProjectStats } from '../../../types/reconciliation';
import { ProjectStatusBadge } from './ProjectStatusBadge';
import { StatCell } from './StatCell';
import { formatCurrency, getLocale } from '../../../lib/currencyUtils';

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString(getLocale(), { year: 'numeric', month: 'short', day: 'numeric' });

const getMatchRateColor = (rate: number) => {
  if (rate >= 90) return { text: 'text-success', bar: 'bg-success', track: 'bg-success/20' };
  if (rate >= 70) return { text: 'text-warning', bar: 'bg-warning', track: 'bg-warning/20' };
  return { text: 'text-error', bar: 'bg-error', track: 'bg-error/20' };
};

export type ProjectActionType = 'MERGE' | 'DELETE' | 'ARCHIVE' | 'RESTORE';

interface ProjectCardProps {
  project: Project;
  stats?: ProjectStats;
  onAction: (type: ProjectActionType) => void;
}

export const ProjectCard = ({ project, stats, onAction }: ProjectCardProps) => {
  const { t } = useTranslation('projects');
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isArchived = project.isArchived;
  const docCount = project.documentCount ?? project._count?.deliveryNotes ?? 0;
  const memberCount = project._count?.purchaseOrders ?? 0;
  const matchRate = Math.round(stats?.reconciliationPercentage ?? 0);
  const matchRateColors = getMatchRateColor(matchRate);
  const hasDocuments = stats ? (stats.purchaseOrderCount + stats.invoiceCount + stats.deliveryCertCount) > 0 : false;
  const isOvercharged = stats != null && stats.purchaseOrderAmount > 0 && stats.invoiceAmount > stats.purchaseOrderAmount * 1.01;
  const needsAttention = hasDocuments && (matchRate < 100 || isOvercharged);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleMenuAction = (e: React.MouseEvent, type: ProjectActionType) => {
    e.stopPropagation();
    setMenuOpen(false);
    onAction(type);
  };

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigate(`/projects/${project.id}`);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/projects/${project.id}`)}
      onKeyDown={handleCardKeyDown}
      className={`bg-base-100 rounded-[.5rem] border shadow-sm overflow-hidden text-right hover:shadow-xl hover:border-primary transition-all duration-200 group cursor-pointer relative outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 ${isArchived ? 'border-base-300 opacity-75 grayscale-[0.3]' : 'border-base-300'
        }`}
    >
      {isArchived && <div className="absolute top-0 left-0 right-0 h-1 bg-base-300/40 z-10" />}

      <div className="p-6">
        {/* Header with icon, member count and status */}
        <div className="flex items-start justify-between mb-1">
          <div className="relative">
            <div className="w-11 h-11 rounded-xl bg-base-200 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Building2 size={20} className={isArchived ? 'text-base-content/40' : 'text-primary'} />
            </div>
            {memberCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5 bg-base-100 border border-base-300 text-base-content/60 text-xs font-semibold px-1.5 py-0.5 rounded-full shadow-sm">
                <Users size={10} />
                {memberCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ProjectStatusBadge isArchived={isArchived} />

            {/* Actions dropdown */}
            <div ref={menuRef} className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
                className="p-1.5 rounded-lg text-base-content/40 opacity-40 hover:opacity-100 hover:bg-base-200 transition-all outline-none focus-visible:opacity-100 focus-visible:bg-base-200 focus-visible:ring-2 focus-visible:ring-primary/30"
                aria-label={project.name}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <MoreHorizontal size={16} />
              </button>
              {menuOpen && (
                <div className="absolute left-0 top-full mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg z-50 w-44 py-1">
                  {!isArchived ? (
                    <>
                      <button onClick={(e) => handleMenuAction(e, 'MERGE')} className="w-full flex items-center justify-between px-3 py-2 text-sm text-base-content hover:bg-base-200">
                        <span>{t('common.merge')}</span>
                        <GitMerge size={14} className="text-base-content/40" />
                      </button>
                      <button onClick={(e) => handleMenuAction(e, 'ARCHIVE')} className="w-full flex items-center justify-between px-3 py-2 text-sm text-base-content hover:bg-base-200">
                        <span>{t('common.archive')}</span>
                        <Archive size={14} className="text-base-content/40" />
                      </button>
                    </>
                  ) : (
                    <button onClick={(e) => handleMenuAction(e, 'RESTORE')} className="w-full flex items-center justify-between px-3 py-2 text-sm text-base-content hover:bg-base-200">
                      <span>{t('common.restore')}</span>
                      <Archive size={14} className="text-base-content/40 rotate-180" />
                    </button>
                  )}
                  <div className="border-t border-base-300 my-1" />
                  <button onClick={(e) => handleMenuAction(e, 'DELETE')} className="w-full flex items-center justify-between px-3 py-2 text-sm text-error hover:bg-error/10">
                    <span>{t('common.delete')}</span>
                    <Trash2 size={14} className="text-error/60" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Project name & address */}
        <h3 className="text-lg font-bold text-base-content mt-1 group-hover:text-primary transition-colors truncate">{project.name}</h3>
        <p className="flex items-center gap-1.5 text-xs text-base-content/50 min-h-[1.25rem] mb-3">
          {project.address && (
            <>
              <MapPin size={12} className="flex-shrink-0" />
              <span className="truncate">{project.address}</span>
            </>
          )}
        </p>

        {/* Stats grid - 2x2 */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-3 border-t border-base-300">
          <StatCell
            label={t('card.ordered')}
            value={stats ? formatCurrency(stats.purchaseOrderAmount, stats.currency) : '—'}
          />
          <StatCell
            label={t('card.invoiced')}
            value={stats ? formatCurrency(stats.invoiceAmount, stats.currency) : '—'}
          />
          <div>
            <p className="text-xs text-base-content/50 uppercase font-bold tracking-wider mb-0.5">
              {t('card.matchRate')}
            </p>
            <div className="flex items-center gap-2">
              <span className={`text-base font-bold font-mono tabular-nums ${stats ? matchRateColors.text : 'text-base-content/30'}`}>
                {stats ? `${matchRate}%` : '—'}
              </span>
              {stats && (
                <div className={`w-12 h-1.5 rounded-full ${matchRateColors.track}`}>
                  <div
                    className={`h-full rounded-full transition-all ${matchRateColors.bar}`}
                    style={{ width: `${Math.min(matchRate, 100)}%` }}
                  />
                </div>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-base-content/50 uppercase font-bold tracking-wider flex items-center gap-1.5 mb-0.5">
              <AlertTriangle size={12} />
              {t('card.attention')}
            </p>
            {isOvercharged ? (
              <p className="text-sm font-bold text-error">{t('card.overcharged')}</p>
            ) : matchRate < 100 && hasDocuments ? (
              <p className="text-base font-bold font-mono tabular-nums text-warning">
                {100 - matchRate}% <span className="text-xs font-normal font-sans text-base-content/50">{t('card.unmatched')}</span>
              </p>
            ) : (
              <p className="text-sm font-semibold text-success">{t('card.allClear')}</p>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-base-200/50 border-t border-base-300 flex items-center justify-between group-hover:bg-primary/5 transition-colors">
        <p className="text-xs text-base-content/60 font-medium">
          {t('card.created')} {formatDate(project.createdAt)} &middot; {docCount} {t('card.documents')}
        </p>
        <ChevronLeft size={16} className="text-base-content/30 ltr:-translate-x-2 rtl:translate-x-2 ltr:group-hover:translate-x-0 rtl:group-hover:translate-x-0 group-hover:text-primary transition-all duration-200" />
      </div>
    </div>
  );
};
