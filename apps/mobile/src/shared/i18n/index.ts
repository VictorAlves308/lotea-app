import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import ptBRAuth from './locales/pt-BR/auth.json';
import ptBRCommon from './locales/pt-BR/common.json';
import ptBRCustomers from './locales/pt-BR/customers.json';
import ptBRDashboard from './locales/pt-BR/dashboard.json';
import ptBRFinance from './locales/pt-BR/finance.json';
import ptBRInventory from './locales/pt-BR/inventory.json';
import ptBRLots from './locales/pt-BR/lots.json';
import ptBRPayments from './locales/pt-BR/payments.json';
import ptBRProducts from './locales/pt-BR/products.json';
import ptBRSales from './locales/pt-BR/sales.json';
import ptBRTopSellers from './locales/pt-BR/topSellers.json';

// pt-BR is the only language written and shipped right now (see CLAUDE.md).
// Every feature adds its own `pt-BR.json` resource file here, namespaced by
// feature — never a hardcoded string in a component. See ARCHITECTURE.md §7.
const resources = {
  'pt-BR': {
    common: ptBRCommon,
    auth: ptBRAuth,
    dashboard: ptBRDashboard,
    customers: ptBRCustomers,
    products: ptBRProducts,
    sales: ptBRSales,
    inventory: ptBRInventory,
    lots: ptBRLots,
    payments: ptBRPayments,
    finance: ptBRFinance,
    topSellers: ptBRTopSellers,
  },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: 'pt-BR',
  fallbackLng: 'pt-BR',
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

export default i18n;
