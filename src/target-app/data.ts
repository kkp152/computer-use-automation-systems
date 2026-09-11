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

export interface BatchTransaction {
  id: string;
  type: 'ACH_PAYROLL' | 'CHECK_CLEARING' | 'DIVIDEND_DISTRIBUTION' | 'DEBIT_SETTLEMENT';
  description: string;
  recordCount: number;
  totalAmount: number;
  status: 'PENDING_REVIEW' | 'PROCESSING' | 'POSTED';
  submittedBy: string;
  effectiveDate: string;
}

export interface WireTransfer {
  id: string;
  senderName: string;
  senderAccount: string;
  recipientName: string;
  recipientBank: string;
  routingTransit: string;
  amount: number;
  riskTier: 'STANDARD' | 'HIGH_VALUE_MUTATION';
  status: 'PENDING_SUPERVISOR_APPROVAL' | 'RELEASED' | 'FLAGGED_HOLD';
  initiatedAt: string;
}

export interface RegulatoryReport {
  id: string;
  title: string;
  jurisdiction: 'FinCEN' | 'NCUA' | 'Federal Reserve' | 'OFAC';
  period: string;
  recordCount: number;
  filingDeadline: string;
  complianceStatus: 'READY_FOR_FILING' | 'SUBMITTED' | 'UNDER_AUDIT';
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

export const BATCH_TRANSACTIONS: BatchTransaction[] = [
  {
    id: 'BATCH-2026-0901',
    type: 'ACH_PAYROLL',
    description: 'Corporate Bi-Weekly Payroll Batch #14 (Federal & State)',
    recordCount: 1420,
    totalAmount: 3840250.00,
    status: 'PENDING_REVIEW',
    submittedBy: 'ACH Operations (Station #4)',
    effectiveDate: '2026-09-12'
  },
  {
    id: 'BATCH-2026-0902',
    type: 'CHECK_CLEARING',
    description: 'Overnight Transit Check Clearing & Settlement',
    recordCount: 890,
    totalAmount: 412500.50,
    status: 'PROCESSING',
    submittedBy: 'Federal Reserve FedLine Direct',
    effectiveDate: '2026-09-11'
  },
  {
    id: 'BATCH-2026-0903',
    type: 'DIVIDEND_DISTRIBUTION',
    description: 'Monthly Share Certificate & Savings Interest Accruals',
    recordCount: 4210,
    totalAmount: 182450.75,
    status: 'POSTED',
    submittedBy: 'Automated Settlement Daemon',
    effectiveDate: '2026-09-01'
  }
];

export const WIRE_TRANSFERS: WireTransfer[] = [
  {
    id: 'WIRE-99214',
    senderName: 'Sarah Connor',
    senderAccount: 'CHK-8801',
    recipientName: 'Cyberdyne Systems Escrow Corp',
    recipientBank: 'JPMorgan Chase NY (Fedwire 021000021)',
    routingTransit: '021000021',
    amount: 250000.00,
    riskTier: 'HIGH_VALUE_MUTATION',
    status: 'PENDING_SUPERVISOR_APPROVAL',
    initiatedAt: '2026-09-10 14:22:10'
  },
  {
    id: 'WIRE-88102',
    senderName: 'John Matrix',
    senderAccount: 'SAV-9910',
    recipientName: 'Highland Aviation Services LLC',
    recipientBank: 'Bank of America CA (Fedwire 121000358)',
    routingTransit: '121000358',
    amount: 14500.00,
    riskTier: 'HIGH_VALUE_MUTATION',
    status: 'RELEASED',
    initiatedAt: '2026-09-09 09:15:30'
  }
];

export const REGULATORY_REPORTS: RegulatoryReport[] = [
  {
    id: 'CTR-2026-Q3',
    title: 'FinCEN Form 112: Currency Transaction Report (BSA / AML)',
    jurisdiction: 'FinCEN',
    period: 'Q3 2026',
    recordCount: 84,
    filingDeadline: '2026-10-15',
    complianceStatus: 'READY_FOR_FILING'
  },
  {
    id: 'SAR-2026-004',
    title: 'Suspicious Activity Monitoring: Rapid Wire Inflow & Immediate Cash Out',
    jurisdiction: 'FinCEN',
    period: 'September 2026',
    recordCount: 3,
    filingDeadline: '2026-09-30',
    complianceStatus: 'UNDER_AUDIT'
  },
  {
    id: 'NCUA-5300-CALL',
    title: 'NCUA Quarterly Call Report 5300 (Liquidity & Capital Adequacy)',
    jurisdiction: 'NCUA',
    period: 'Q3 2026',
    recordCount: 1,
    filingDeadline: '2026-10-24',
    complianceStatus: 'READY_FOR_FILING'
  },
  {
    id: 'OFAC-SCAN-AUDIT',
    title: 'Daily OFAC Specially Designated Nationals (SDN) Batch Scrub',
    jurisdiction: 'OFAC',
    period: '2026-09-10',
    recordCount: 18450,
    filingDeadline: '2026-09-11',
    complianceStatus: 'SUBMITTED'
  }
];
