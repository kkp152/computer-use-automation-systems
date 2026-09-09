export interface Account {
  id: string;
  type: 'CHECKING' | 'SAVINGS' | 'MONEY_MARKET' | 'AUTO_LOAN';
  name: string;
  currentBalance: number;
  availableBalance: number;
  routingNumber: string;
  status: 'ACTIVE' | 'DORMANT' | 'FROZEN' | 'CLOSED';
  openedDate: string;
  interestRate: string;
  recentTransactions: {
    id: string;
    date: string;
    description: string;
    amount: number;
    balance: number;
  }[];
}

export interface Member {
  id: string;
  fullName: string;
  ssnMasked: string;
  email: string;
  phone: string;
  tier: 'GOLD' | 'PLATINUM' | 'STANDARD';
  address: string;
  status: 'ACTIVE' | 'RESTRICTED' | 'DECEASED';
  accounts: Account[];
}

export const BANK_MEMBERS: Record<string, Member> = {
  '10042': {
    id: '10042',
    fullName: 'Sarah Connor',
    ssnMasked: '***-**-4921',
    email: 'sconnor@cyberdyne-res.org',
    phone: '(555) 234-8901',
    tier: 'PLATINUM',
    address: '742 Evergreen Terrace, Springfield, IL 62704',
    status: 'ACTIVE',
    accounts: [
      {
        id: 'CHK-8801',
        type: 'CHECKING',
        name: 'Premier Business Checking',
        currentBalance: 4120.50,
        availableBalance: 4120.50,
        routingNumber: '121000358',
        status: 'ACTIVE',
        openedDate: '2019-04-15',
        interestRate: '0.05%',
        recentTransactions: [
          { id: 'TXN-901', date: '2026-09-05', description: 'Direct Deposit Cyberdyne', amount: 3200.00, balance: 4120.50 },
          { id: 'TXN-902', date: '2026-09-04', description: 'Point of Sale Shell Gas', amount: -45.00, balance: 920.50 }
        ]
      },
      {
        id: 'SAV-3021',
        type: 'SAVINGS',
        name: 'High-Yield Member Savings',
        currentBalance: 18450.25,
        availableBalance: 18250.25,
        routingNumber: '121000358',
        status: 'ACTIVE',
        openedDate: '2021-08-10',
        interestRate: '4.25%',
        recentTransactions: [
          { id: 'TXN-701', date: '2026-09-01', description: 'Monthly Dividend / Interest Credit', amount: 62.30, balance: 18450.25 },
          { id: 'TXN-702', date: '2026-08-15', description: 'Mobile Deposit Check #1042', amount: 1500.00, balance: 18387.95 },
          { id: 'TXN-703', date: '2026-08-01', description: 'Transfer from Checking CHK-8801', amount: 500.00, balance: 16887.95 }
        ]
      },
      {
        id: 'LOAN-1190',
        type: 'AUTO_LOAN',
        name: 'Fixed Auto Loan (2024 Ford F-150)',
        currentBalance: 12300.00,
        availableBalance: 0.00,
        routingNumber: '121000358',
        status: 'ACTIVE',
        openedDate: '2024-01-20',
        interestRate: '5.49%',
        recentTransactions: [
          { id: 'TXN-401', date: '2026-08-28', description: 'Auto-Pay Loan Payment', amount: -450.00, balance: 12300.00 }
        ]
      }
    ]
  },
  '20481': {
    id: '20481',
    fullName: 'John Matrix',
    ssnMasked: '***-**-1109',
    email: 'jmatrix@commando-ops.mil',
    phone: '(555) 881-0021',
    tier: 'GOLD',
    address: '1440 Highland Ridge, Val Verde, CA 90210',
    status: 'ACTIVE',
    accounts: [
      {
        id: 'SAV-9910',
        type: 'SAVINGS',
        name: 'Standard Share Savings',
        currentBalance: 5210.00,
        availableBalance: 5210.00,
        routingNumber: '121000358',
        status: 'ACTIVE',
        openedDate: '2023-11-01',
        interestRate: '2.10%',
        recentTransactions: []
      }
    ]
  }
};
