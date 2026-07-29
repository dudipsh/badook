import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { observer } from 'mobx-react-lite';
import { StoreProvider, useStores } from './lib/store-context';
import { SagurLayout } from './components/layout/SagurLayout';
import { SuperAdminLayout } from './components/layout/SuperAdminLayout';
import { AuthGuard } from './components/layout/AuthGuard';
import { SuperAdminGuard } from './components/layout/SuperAdminGuard';
import { CompanyAdminGuard } from './components/layout/CompanyAdminGuard';
import { LoginPage } from './pages/LoginPage/LoginPage';
import { OverviewPage } from './pages/OverviewPage/OverviewPage';
import { ProjectDashboardPage } from './pages/ProjectDashboardPage/ProjectDashboardPage';
import { ProjectDocumentsPage } from './pages/ProjectDocumentsPage/ProjectDocumentsPage';
import { OrphanedDocsPage } from './pages/OrphanedDocsPage/OrphanedDocsPage';
import { DiscrepancyReviewPage } from './pages/DiscrepancyReviewPage/DiscrepancyReviewPage';
import { SettingsLayout } from './pages/Settings/SettingsLayout';
import { CompanyTab } from './pages/Settings/tabs/CompanyTab';
import { TeamTab } from './pages/Settings/tabs/TeamTab';
import { IntegrationsTab } from './pages/Settings/tabs/IntegrationsTab';
import { EmailIntegrationTab } from './pages/Settings/tabs/integrations/EmailIntegrationTab';
import { WhatsAppIntegrationTab } from './pages/Settings/tabs/integrations/WhatsAppIntegrationTab';
import { ErpIntegrationTab } from './pages/Settings/tabs/integrations/ErpIntegrationTab';
import { BillingTab } from './pages/Settings/tabs/BillingTab';
import { OperationsTab } from './pages/SuperAdminPage/components/OperationsTab/OperationsTab';
import { TrainingLabPage } from './pages/TrainingLabPage/TrainingLabPage';
import { RefDataPage } from './pages/RefDataPage/RefDataPage';
import { ReportsPage } from './pages/ReportsPage/ReportsPage';
import { VendorReport } from './pages/ReportsPage/components/VendorReport';
import { PoSummaryReport } from './pages/ReportsPage/components/PoSummaryReport';
import { DeliveryCertsReport } from './pages/ReportsPage/components/DeliveryCertsReport';
import { BudgetControlReport } from './pages/ReportsPage/components/BudgetControlReport';
import { ProductsTab } from './pages/RefDataPage/components/ProductsTab';
import { SuppliersTab } from './pages/RefDataPage/components/SuppliersTab';
import { CitiesTab } from './pages/RefDataPage/components/CitiesTab';
import { CompaniesTab } from './pages/SuperAdminPage/components/CompaniesTab/CompaniesTab';
import { UsersTab } from './pages/SuperAdminPage/components/UsersTab/UsersTab';
import { SuperAdminsTab } from './pages/SuperAdminPage/components/SuperAdminsTab/SuperAdminsTab';
import { LoginMonitoringTab } from './pages/SuperAdminPage/components/LoginMonitoringTab/LoginMonitoringTab';
import { UserSearchTab } from './pages/SuperAdminPage/components/UserSearchTab/UserSearchTab';
import { SystemMessagesTab } from './pages/SuperAdminPage/components/SystemMessagesTab/SystemMessagesTab';
import { PromptsTab } from './pages/SuperAdminPage/components/PromptsTab';
import { StatsTab } from './pages/SuperAdminPage/components/StatsTab';
import { FeedbackTab } from './pages/SuperAdminPage/components/FeedbackTab';
import { TestingTab } from './pages/SuperAdminPage/components/TestingTab/TestingTab';
import { JobsTab } from './pages/SuperAdminPage/components/JobsTab';
import { DiagnosticsTab } from './pages/SuperAdminPage/components/DiagnosticsTab';
import { TrainingTab } from './pages/SuperAdminPage/components/TrainingTab/TrainingTab';
import { ChatAgentsTab } from './pages/SuperAdminPage/components/ChatAgentsTab/ChatAgentsTab';
import { CompanyDetailPage } from './pages/SuperAdminPage/components/CompanyDetailPage/CompanyDetailPage';
import { CompanyOverviewTab } from './pages/SuperAdminPage/components/CompanyDetailPage/CompanyOverviewTab';
import { CompanyUsersTab } from './pages/SuperAdminPage/components/CompanyDetailPage/CompanyUsersTab';
import { CompanyAITab } from './pages/SuperAdminPage/components/CompanyDetailPage/CompanyAITab';
import { CompanyJobsTab } from './pages/SuperAdminPage/components/CompanyDetailPage/CompanyJobsTab';
import 'react-tooltip/dist/react-tooltip.css';

const AppContent = observer(() => {
  const { languageStore } = useStores();
  return (
    <BrowserRouter>
      <Toaster position={languageStore.isRtl ? 'top-left' : 'top-right'} />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AuthGuard />}>
            <Route element={<SagurLayout />}>
              <Route path="/" element={<OverviewPage />} />
              <Route path="/projects/:id" element={<ProjectDashboardPage />} />
              <Route path="/projects/:id/vendors/:vendorId" element={<ProjectDashboardPage />} />
              <Route path="/projects/:id/vendors/:vendorId/:groupBy" element={<ProjectDashboardPage />} />
              <Route path="/projects/:id/review/:lineItemId" element={<DiscrepancyReviewPage />} />
              <Route path="/projects/:id/documents" element={<ProjectDocumentsPage />} />
              <Route element={<CompanyAdminGuard />}>
                <Route path="/settings" element={<SettingsLayout />}>
                  <Route index element={<Navigate to="/settings/company" replace />} />
                  <Route path="company" element={<CompanyTab />} />
                  <Route path="team" element={<TeamTab />} />
                  <Route path="integrations" element={<IntegrationsTab />}>
                    <Route index element={<Navigate to="/settings/integrations/email" replace />} />
                    <Route path="email" element={<EmailIntegrationTab />} />
                    <Route path="whatsapp" element={<WhatsAppIntegrationTab />} />
                    <Route path="erp" element={<ErpIntegrationTab />} />
                  </Route>
                  <Route path="billing" element={<BillingTab />} />
                </Route>
              </Route>
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/reports/vendor" element={<VendorReport />} />
              <Route path="/reports/po-summary" element={<PoSummaryReport />} />
              <Route path="/reports/delivery-certs" element={<DeliveryCertsReport />} />
              <Route path="/reports/budget-control" element={<BudgetControlReport />} />
              <Route path="/orphaned-docs" element={<Navigate to="/orphaned-docs/pending" replace />} />
              <Route path="/orphaned-docs/:tab" element={<OrphanedDocsPage />} />
            </Route>
            {/* Dedicated super-admin console — its own shell, decoupled from any company */}
            <Route element={<SuperAdminGuard />}>
              <Route element={<SuperAdminLayout />}>
                <Route path="/super-admin" element={<Navigate to="/super-admin/companies" replace />} />
                <Route path="/super-admin/companies" element={<CompaniesTab />} />
                <Route path="/super-admin/companies/:companyId" element={<CompanyDetailPage />}>
                  <Route index element={<Navigate to="overview" replace />} />
                  <Route path="overview" element={<CompanyOverviewTab />} />
                  <Route path="users" element={<CompanyUsersTab />} />
                  <Route path="ai" element={<CompanyAITab />} />
                  <Route path="jobs" element={<CompanyJobsTab />} />
                </Route>
                <Route path="/super-admin/super-admins" element={<SuperAdminsTab />} />
                <Route path="/super-admin/login-monitoring" element={<LoginMonitoringTab />} />
                <Route path="/super-admin/system-messages" element={<SystemMessagesTab />} />
                <Route path="/super-admin/user-search" element={<UserSearchTab />} />
                <Route path="/super-admin/users" element={<UsersTab />} />
                <Route path="/super-admin/prompts" element={<PromptsTab />} />
                <Route path="/super-admin/stats" element={<StatsTab />} />
                <Route path="/super-admin/feedback" element={<FeedbackTab />} />
                <Route path="/super-admin/testing" element={<TestingTab />} />
                <Route path="/super-admin/jobs" element={<JobsTab />} />
                <Route path="/super-admin/diagnostics" element={<DiagnosticsTab />} />
                <Route path="/super-admin/operations" element={<OperationsTab />} />
                <Route path="/super-admin/training" element={<TrainingTab />} />
                <Route path="/super-admin/chat-agents" element={<ChatAgentsTab />} />
                <Route path="/training-lab" element={<TrainingLabPage />} />
                <Route path="/training-lab/sample/:sampleId" element={<TrainingLabPage />} />
                <Route path="/ref-data" element={<RefDataPage />}>
                  <Route index element={<Navigate to="/ref-data/products" />} />
                  <Route path="products" element={<ProductsTab />} />
                  <Route path="suppliers" element={<SuppliersTab />} />
                  <Route path="cities" element={<CitiesTab />} />
                </Route>
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
    </BrowserRouter>
  );
});

export const App = () => {
  return (
    <StoreProvider>
      <AppContent />
    </StoreProvider>
  );
}
