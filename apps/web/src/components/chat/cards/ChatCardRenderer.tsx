import { ChatCard } from '../../../services/chat.service';
import { CompanyOverviewCard } from './CompanyOverviewCard';
import { ProjectSummaryCard } from './ProjectSummaryCard';
import { ProjectListCard } from './ProjectListCard';
import { SupplierListCard } from './SupplierListCard';
import { DiscrepancyListCard } from './DiscrepancyListCard';
import { ItemSupplySummaryCard } from './ItemSupplySummaryCard';
import { ItemDocumentsCard } from './ItemDocumentsCard';

interface Props {
  card: ChatCard;
  onDismiss: () => void;
}

export const ChatCardRenderer = ({ card, onDismiss }: Props) => {
  switch (card.kind) {
    case 'company_overview':
      return <CompanyOverviewCard data={card.data} onDismiss={onDismiss} />;
    case 'project_summary':
      return <ProjectSummaryCard data={card.data} onDismiss={onDismiss} />;
    case 'project_list':
      return <ProjectListCard data={card.data} onDismiss={onDismiss} />;
    case 'supplier_list':
      return <SupplierListCard data={card.data} onDismiss={onDismiss} />;
    case 'discrepancy_list':
      return <DiscrepancyListCard data={card.data} onDismiss={onDismiss} />;
    case 'item_supply_summary':
      return <ItemSupplySummaryCard data={card.data} onDismiss={onDismiss} />;
    case 'item_documents':
      return <ItemDocumentsCard data={card.data} onDismiss={onDismiss} />;
    default:
      return null;
  }
};
