import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { api } from '../services/api';
import { useTranslation } from '../i18n/index';
import './Billing.css';

const Billing = () => {
	const { user, loading } = useContext(AuthContext);
	const { t } = useTranslation();
	const [billingTransactions, setBillingTransactions] = useState([]);
	const [transactionsLoading, setTransactionsLoading] = useState(false);
	const [error, setError] = useState('');
	const [downloadingId, setDownloadingId] = useState(null);

	useEffect(() => {
		let active = true;

		const loadBillingData = async () => {
			if (!user) return;
			setTransactionsLoading(true);
			setError('');

			try {
				const response = await api.get('/auth/transactions?limit=100');
				if (active) {
					setBillingTransactions(Array.isArray(response.data?.billing_transactions) ? response.data.billing_transactions : []);
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
			// Convert HTML to blob and open in new window (same approach as Download)
			const blob = new Blob([response.data], {type: 'text/html'});
			const url = URL.createObjectURL(blob);
			window.open(url, '_blank');
		} catch (e) {
			setError(e?.response?.data?.error || 'Failed to load receipt');
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
			const dateStr = new Date(txnDate).toISOString().slice(0, 10);
			anchor.download = `GueInsight-Receipt-${dateStr}.html`;
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

	if (loading) {
		return (
			<main className="billing-page">
				<p>{t('profile.loading')}</p>
			</main>
		);
	}

	if (!user) {
		return (
			<main className="billing-page">
				<p>Please log in to view billing information.</p>
			</main>
		);
	}

	return (
		<main className="billing-page">
			<section className="billing-page__layout">
				<article className="billing-page__card">
					<div className="billing-page__header">
						<h1>💳 Billing & Invoices</h1>
						<p className="billing-page__subtitle">Manage your invoices and download receipts</p>
					</div>

					{error && (
						<div className="billing-page__message billing-page__message--error">
							<span>⚠️ {error}</span>
						</div>
					)}

					{transactionsLoading ? (
						<div className="billing-page__loading">
							<p>Loading billing transactions...</p>
						</div>
					) : billingTransactions.length === 0 ? (
						<div className="billing-page__empty">
							<p>No billing transactions yet.</p>
							<p className="billing-page__empty-subtitle">When you subscribe, your invoices will appear here.</p>
						</div>
					) : (
						<div className="billing-page__transactions">
							{billingTransactions.map((tx) => (
								<article className="billing-page__transaction" key={tx.id}>
									<div className="billing-page__transaction-header">
										<div className="billing-page__transaction-info">
											<div className="billing-page__status-badge" data-status={tx.status}>
												{String(tx.status || 'unknown').toUpperCase()}
											</div>
											<div>
												<p className="billing-page__transaction-date">
													{tx.period_start ? new Date(tx.period_start).toLocaleDateString() : 'N/A'}
													{' — '}
													{tx.period_end ? new Date(tx.period_end).toLocaleDateString() : 'N/A'}
												</p>
												<p className="billing-page__transaction-created">
													Issued: {tx.created_at ? new Date(tx.created_at).toLocaleString() : 'N/A'}
												</p>
											</div>
										</div>
										<div className="billing-page__transaction-amount">
											<strong className="billing-page__amount">
												{(tx.amount_minor / 100).toFixed(2)} {String(tx.currency || 'EUR').toUpperCase()}
											</strong>
										</div>
									</div>

									<div className="billing-page__transaction-actions">
										<button
											type="button"
											onClick={() => viewReceipt(tx.id)}
											disabled={downloadingId === tx.id}
											className="billing-page__btn billing-page__btn--primary"
										>
											{downloadingId === tx.id ? '⏳ Loading...' : '👁️ View Receipt'}
										</button>
										<button
											type="button"
											onClick={() => downloadReceipt(tx.id, tx.created_at)}
											disabled={downloadingId === tx.id}
											className="billing-page__btn billing-page__btn--secondary"
										>
											{downloadingId === tx.id ? '⏳ Downloading...' : '⬇️ Download'}
										</button>
									</div>
								</article>
							))}
						</div>
					)}

					<div className="billing-page__footer">
						<Link to="/subscription" className="billing-page__link">
							← Back to Subscription Plans
						</Link>
						<p className="billing-page__footer-note">
							Need help with billing? <Link to="/support" className="billing-page__link">Contact Support</Link>
						</p>
					</div>
				</article>
			</section>
		</main>
	);
};

export default Billing;
