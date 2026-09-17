import { useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { api } from '../services/api';
import { useTranslation } from '../i18n/index';
import './Billing.css';
import CockpitHeader from '../components/CockpitHeader';
import {
  IconCreditCard,
  IconShield,
  IconEye,
  IconDownload,
  IconArrowLeft,
  IconCheckCircle,
  IconAlertTriangle,
  IconCopy,
  IconSearch,
  IconExternalLink,
  IconCalendar,
  IconLock,
  IconGlobe,
  IconFile,
} from '../components/Icons';

const PLAN_LABELS = {
  free: 'Free Forever',
  starter: 'Starter',
  compliance_pro: 'Compliance Pro',
  enterprise_professional: 'Enterprise Professional',
  enterprise_risk: 'Enterprise Risk',
  enterprise_elite: 'Enterprise Elite',
  premium_small_business: 'Premium Small Business',
  premium_large_business: 'Premium Large Business',
};

const Billing = () => {
  const { user, loading } = useContext(AuthContext);
  const { t } = useTranslation();
  const [billingTransactions, setBillingTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let active = true;

    const loadBillingData = async () => {
      if (!user) return;
      setTransactionsLoading(true);
      setError('');

      try {
        const response = await api.get('/auth/transactions?limit=100');
        if (active) {
          setBillingTransactions(
            Array.isArray(response.data?.billing_transactions) ? response.data.billing_transactions : []
          );
        }
      } catch (err) {
        if (active) {
          setError(err?.response?.data?.error || 'Failed to load billing transactions');
        }
      } finally {
        if (active) {
          setTransactionsLoading(false);
        }
      }
    };

    loadBillingData();

    return () => {
      active = false;
    };
  }, [user]);

  const viewReceipt = async (txnId) => {
    setError('');
    try {
      const response = await api.get(`/auth/billing/${txnId}/receipt`, { responseType: 'text' });
      const blob = new Blob([response.data], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to open receipt document');
    }
  };

  const downloadReceipt = async (txnId, txnDate) => {
    setDownloadingId(txnId);
    setError('');

    try {
      const response = await api.get(`/auth/billing/${txnId}/receipt`, { responseType: 'text' });
      const html = response.data;
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      const dateStr = txnDate ? new Date(txnDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
      anchor.download = `GueInsight-Invoice-${dateStr}-${String(txnId).slice(0, 8)}.html`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to download receipt');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCopyId = (id) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(String(id));
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const userPlanRaw = user?.current_plan || user?.plan || 'free';
  const userPlanLabel = PLAN_LABELS[userPlanRaw] || String(userPlanRaw).replaceAll('_', ' ').toUpperCase();
  const isPaidUser = userPlanRaw !== 'free';

  const filteredTransactions = useMemo(() => {
    return billingTransactions.filter((tx) => {
      const matchesStatus =
        statusFilter === 'all' ||
        String(tx.status).toLowerCase() === statusFilter.toLowerCase();

      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        String(tx.id).toLowerCase().includes(searchLower) ||
        String(tx.currency || '').toLowerCase().includes(searchLower) ||
        String(tx.status || '').toLowerCase().includes(searchLower);

      return matchesStatus && matchesSearch;
    });
  }, [billingTransactions, statusFilter, searchTerm]);

  const totalSpent = useMemo(() => {
    const totalMinor = billingTransactions
      .filter((tx) => ['completed', 'paid', 'active'].includes(String(tx.status).toLowerCase()))
      .reduce((acc, tx) => acc + (Number(tx.amount_minor) || 0), 0);
    return (totalMinor / 100).toFixed(2);
  }, [billingTransactions]);

  if (loading) {
    return (
      <div className="cg-cockpit-shell">
        <CockpitHeader />
        <main className="billing-page">
          <div className="billing-page__loading-wrap">
            <div className="billing-page__spinner" />
            <p>{t('profile.loading') || 'Loading financial telemetry...'}</p>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="cg-cockpit-shell">
        <CockpitHeader />
        <main className="billing-page">
          <div className="billing-page__empty-card">
            <IconLock size={36} />
            <h2>Authentication Required</h2>
            <p>Please log in to inspect enterprise invoices and billing history.</p>
            <Link to="/login" className="billing-page__btn-primary">
              <span>Log In to Account</span>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="cg-cockpit-shell">
      <CockpitHeader />
      <main className="billing-page">
      {/* Top Cockpit Header */}
      <section className="billing-page__header">
        <div className="billing-page__header-row">
          <div className="billing-page__header-meta">
            <div className="billing-page__eyebrow">
              <span className="billing-page__pulse-dot" />
              <span>FINANCIAL CONTROLS & INVOICES</span>
            </div>
            <h1 className="billing-page__title">Billing & Subscription</h1>
            <p className="billing-page__lead">
              Manage your active subscription plan, download VAT tax receipts, and audit transaction settlements.
            </p>
          </div>

          <div className="billing-page__header-actions">
            <Link to="/dashboard" className="billing-page__btn-back">
              <IconArrowLeft size={16} />
              <span>Back to Cockpit</span>
            </Link>
            <Link to="/subscription" className="billing-page__btn-primary">
              <IconCreditCard size={16} />
              <span>Manage Plans</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Top Bento Metric Cards */}
      <section className="billing-page__bento-grid">
        {/* Bento 1: Active Subscription Plan */}
        <div className="billing-page__bento-card billing-page__bento-card--active-plan">
          <div className="billing-page__bento-top">
            <span className="billing-page__bento-badge">ACTIVE SUBSCRIPTION</span>
            <span className={`billing-page__status-pill ${isPaidUser ? 'billing-page__status-pill--active' : ''}`}>
              {isPaidUser ? 'ACTIVE' : 'FREE TIER'}
            </span>
          </div>
          <div className="billing-page__bento-center">
            <h2 className="billing-page__bento-plan-name">{userPlanLabel}</h2>
            <p className="billing-page__bento-plan-info">
              {user?.plan_expires_at
                ? `Next renewal: ${new Date(user.plan_expires_at).toLocaleDateString()}`
                : 'Continuous recurring billing · Automated renewal'}
            </p>
          </div>
          <div className="billing-page__bento-footer">
            <Link to="/subscription" className="billing-page__bento-link">
              <span>Upgrade or modify plan tier</span>
              <IconExternalLink size={14} />
            </Link>
          </div>
        </div>

        {/* Bento 2: Regulatory & Settlement Security */}
        <div className="billing-page__bento-card">
          <div className="billing-page__bento-top">
            <span className="billing-page__bento-badge">PAYMENT SECURITY</span>
            <div className="billing-page__shield-icon">
              <IconShield size={16} />
            </div>
          </div>
          <div className="billing-page__bento-center">
            <strong className="billing-page__security-title">PCI-DSS Level 1 & EU GDPR</strong>
            <p className="billing-page__security-text">
              Payments are securely encrypted and processed via compliant gateways (Stripe & Mollie). All transaction receipts comply with EU Directive 2006/112/EC for reverse-charge VAT.
            </p>
          </div>
          <div className="billing-page__bento-footer">
            <span className="billing-page__security-chip">
              <IconCheckCircle size={13} />
              <span>EU Data Residency Protected</span>
            </span>
          </div>
        </div>

        {/* Bento 3: Financial Summary */}
        <div className="billing-page__bento-card">
          <div className="billing-page__bento-top">
            <span className="billing-page__bento-badge">INVOICE VOLUME</span>
            <div className="billing-page__shield-icon">
              <IconFile size={16} />
            </div>
          </div>
          <div className="billing-page__bento-center">
            <div className="billing-page__metric-amount">
              <span className="billing-page__metric-currency">€</span>
              <span className="billing-page__metric-number">{totalSpent}</span>
            </div>
            <p className="billing-page__metric-sub">
              Total lifetime settled across {billingTransactions.length} issued invoices
            </p>
          </div>
          <div className="billing-page__bento-footer">
            <span className="billing-page__bento-muted">Currency: EUR (Euro)</span>
          </div>
        </div>
      </section>

      {/* Invoices & Transactions Section */}
      <section className="billing-page__table-card">
        <div className="billing-page__table-head">
          <div className="billing-page__table-title-group">
            <div className="billing-page__table-icon">
              <IconFile size={20} />
            </div>
            <div>
              <h2 className="billing-page__table-title">Transaction & Invoice History</h2>
              <p className="billing-page__table-subtitle">
                Official statements and download links for accounting and compliance evidence.
              </p>
            </div>
          </div>

          {/* Controls: Search & Filter */}
          <div className="billing-page__table-controls">
            <div className="billing-page__search-wrap">
              <IconSearch size={16} className="billing-page__search-icon" />
              <input
                type="text"
                placeholder="Filter by ID or status..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="billing-page__search-input"
              />
            </div>

            <div className="billing-page__filter-pills">
              {['all', 'completed', 'pending', 'failed'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`billing-filter-pill ${statusFilter === st ? 'billing-filter-pill--active' : ''}`}
                >
                  {st.charAt(0).toUpperCase() + st.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="billing-page__alert billing-page__alert--error">
            <IconAlertTriangle size={17} />
            <span>{error}</span>
          </div>
        )}

        {transactionsLoading ? (
          <div className="billing-page__loading-table">
            <div className="billing-page__spinner" />
            <p>Fetching ledger transactions...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="billing-page__empty">
            <div className="billing-page__empty-icon">
              <IconCreditCard size={38} />
            </div>
            <h3>No Billing Invoices Found</h3>
            <p>
              {searchTerm || statusFilter !== 'all'
                ? 'No transactions match your current search or status filters.'
                : 'When your organization subscribes to a paid tier, official VAT tax receipts will be generated here automatically.'}
            </p>
            {!isPaidUser && (
              <Link to="/subscription" className="billing-page__btn-primary" style={{ marginTop: '14px' }}>
                <span>Explore Premium Plans</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="billing-page__table-wrap">
            <table className="billing-page__table">
              <thead>
                <tr>
                  <th>Invoice Reference</th>
                  <th>Service Period</th>
                  <th>Issue Date</th>
                  <th>Total Settlement</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx) => {
                  const statusKey = String(tx.status || 'completed').toLowerCase();
                  const amountFormatted = `${(Number(tx.amount_minor || 0) / 100).toFixed(2)} ${String(tx.currency || 'EUR').toUpperCase()}`;
                  const shortId = tx.id ? `#INV-${String(tx.id).slice(0, 10).toUpperCase()}` : '#INV-N/A';

                  return (
                    <tr key={tx.id} className="billing-page__row">
                      <td className="billing-page__cell-id">
                        <span className="billing-page__ref-text">{shortId}</span>
                        <button
                          type="button"
                          className="billing-page__copy-btn"
                          title="Copy Invoice ID"
                          onClick={() => handleCopyId(tx.id)}
                        >
                          <IconCopy size={13} />
                          {copiedId === tx.id && <span className="billing-page__copy-feedback">Copied</span>}
                        </button>
                      </td>

                      <td className="billing-page__cell-period">
                        <div className="billing-page__period-wrap">
                          <IconCalendar size={14} className="billing-page__period-icon" />
                          <span>
                            {tx.period_start ? new Date(tx.period_start).toLocaleDateString() : '—'}
                            {' → '}
                            {tx.period_end ? new Date(tx.period_end).toLocaleDateString() : '—'}
                          </span>
                        </div>
                      </td>

                      <td className="billing-page__cell-date">
                        {tx.created_at ? new Date(tx.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                      </td>

                      <td className="billing-page__cell-amount">
                        <strong>{amountFormatted}</strong>
                      </td>

                      <td className="billing-page__cell-status">
                        <span className={`billing-page__status-badge billing-page__status-badge--${statusKey}`}>
                          <span className="billing-page__badge-dot" />
                          {statusKey.toUpperCase()}
                        </span>
                      </td>

                      <td className="billing-page__cell-actions">
                        <div className="billing-page__action-btns">
                          <button
                            type="button"
                            onClick={() => viewReceipt(tx.id)}
                            className="billing-page__action-btn"
                            title="Preview receipt in browser"
                          >
                            <IconEye size={15} />
                            <span>View</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => downloadReceipt(tx.id, tx.created_at)}
                            disabled={downloadingId === tx.id}
                            className="billing-page__action-btn billing-page__action-btn--download"
                            title="Download official HTML receipt"
                          >
                            {downloadingId === tx.id ? (
                              <>
                                <span className="billing-page__btn-spinner" />
                                <span>Saving...</span>
                              </>
                            ) : (
                              <>
                                <IconDownload size={15} />
                                <span>Download</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer info note */}
        <div className="billing-page__footer-banner">
          <div className="billing-page__footer-info">
            <IconShield size={18} />
            <div>
              <strong>Need a customized enterprise tax invoice or reverse-charge VAT receipt?</strong>
              <p>
                Our billing desk can incorporate custom purchase order (PO) numbers, corporate VAT IDs, and corporate legal entities.
              </p>
            </div>
          </div>
          <Link to="/support" className="billing-page__btn-secondary">
            <span>Contact Billing Desk</span>
          </Link>
        </div>
      </section>
    </main>
  </div>
  );
};

export default Billing;
