import { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { api } from '../services/api';
import './Profile.css';

const useCaseOptions = [
	'Threat monitoring',
	'Incident response',
	'Client security operations',
	'Compliance reporting',
	'General security analytics',
];

const Profile = () => {
	const { user, setUser, loading } = useContext(AuthContext);
	const location = useLocation();
	const [submitting, setSubmitting] = useState(false);
	const [savingPreferences, setSavingPreferences] = useState(false);
	const [message, setMessage] = useState('');
	const [error, setError] = useState('');
	const [billingTransactions, setBillingTransactions] = useState([]);
	const [preferenceMessage, setPreferenceMessage] = useState('');
	const [privacyMessage, setPrivacyMessage] = useState('');
	const [privacyError, setPrivacyError] = useState('');
	const [privacyBusy, setPrivacyBusy] = useState(false);
	const [preferences, setPreferences] = useState({
		avatar_url: '',
		theme: 'system',
		timezone: 'UTC',
		language: 'en',
		notification_email_enabled: true,
		notification_inapp_enabled: true,
	});
	const [form, setForm] = useState({
		first_name: '',
		last_name: '',
		phone_number: '',
		company: '',
		job_title: '',
		primary_use_case: useCaseOptions[0],
		newsletter_opt_in: false,
	});
	const isAdminProfile = location.pathname.startsWith('/admin');
	const backLinkHref = isAdminProfile ? '/admin' : '/dashboard';

	useEffect(() => {
		if (!user) return;
		setForm({
			first_name: user.first_name || '',
			last_name: user.last_name || '',
			phone_number: user.phone_number || '',
			company: user.company || '',
			job_title: user.job_title || '',
			primary_use_case: user.primary_use_case || useCaseOptions[0],
			newsletter_opt_in: Boolean(user.newsletter_opt_in),
		});
		setPreferences({
			avatar_url: user.avatar_url || '',
			theme: user.preferences?.theme || 'system',
			timezone: user.preferences?.timezone || 'UTC',
			language: user.preferences?.language || 'en',
			notification_email_enabled: user.preferences?.notification_email_enabled ?? true,
			notification_inapp_enabled: user.preferences?.notification_inapp_enabled ?? true,
		});
	}, [user]);

	useEffect(() => {
		let active = true;

		const loadProfileExtras = async () => {
			if (!user) return;
			try {
				const [prefResponse, txResponse] = await Promise.all([
					api.get('/auth/preferences'),
					api.get('/auth/transactions?limit=12'),
				]);
				if (!active) return;

				const pref = prefResponse.data?.preferences || {};
				setPreferences((current) => ({
					...current,
					avatar_url: pref.avatar_url || current.avatar_url,
					theme: pref.theme || current.theme,
					timezone: pref.timezone || current.timezone,
					language: pref.language || current.language,
					notification_email_enabled: pref.notification_email_enabled ?? current.notification_email_enabled,
					notification_inapp_enabled: pref.notification_inapp_enabled ?? current.notification_inapp_enabled,
				}));

				setBillingTransactions(Array.isArray(txResponse.data?.billing_transactions) ? txResponse.data.billing_transactions : []);
			} catch {
				if (active) {
					setBillingTransactions([]);
				}
			}
		};

		loadProfileExtras();

		return () => {
			active = false;
		};
	}, [user]);

	const readOnlyMeta = useMemo(() => {
		if (!user) return [];
		return [
			{ label: 'Email', value: user.email || 'N/A' },
			{ label: 'Role', value: user.role || 'user' },
			{ label: 'Team size', value: user.team_size || 'N/A' },
			{ label: 'User ID', value: user.id || 'N/A' },
		];
	}, [user]);

	const updateField = (field) => (event) => {
		const value = field === 'newsletter_opt_in' ? event.target.checked : event.target.value;
		setForm((current) => ({ ...current, [field]: value }));
	};

	const updatePreferenceField = (field) => (event) => {
		const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
		setPreferences((current) => ({ ...current, [field]: value }));
	};

	const handleSubmit = async (event) => {
		event.preventDefault();
		setSubmitting(true);
		setError('');
		setMessage('');

		try {
			const response = await api.patch('/auth/profile', form);
			setUser(response.data?.user || user);
			setMessage('Profile updated successfully.');
		} catch (requestError) {
			setError(requestError?.response?.data?.error || 'Unable to update profile right now.');
		} finally {
			setSubmitting(false);
		}
	};

	const handleSavePreferences = async (event) => {
		event.preventDefault();
		setSavingPreferences(true);
		setPreferenceMessage('');
		setError('');

		try {
			const response = await api.patch('/auth/preferences', preferences);
			setUser(response.data?.user || user);
			setPreferenceMessage('Preferences saved successfully.');
		} catch (requestError) {
			setError(requestError?.response?.data?.error || 'Unable to save preferences right now.');
		} finally {
			setSavingPreferences(false);
		}
	};

	const refreshLegalConsent = async () => {
		setPrivacyBusy(true);
		setPrivacyError('');
		setPrivacyMessage('');
		try {
			const response = await api.patch('/auth/privacy/consent', { refresh_legal_consent: true });
			setUser(response.data?.user || user);
			setPrivacyMessage('Legal consent refreshed successfully.');
		} catch (requestError) {
			setPrivacyError(requestError?.response?.data?.error || 'Unable to refresh consent right now.');
		} finally {
			setPrivacyBusy(false);
		}
	};

	const exportPersonalData = async () => {
		setPrivacyBusy(true);
		setPrivacyError('');
		setPrivacyMessage('');
		try {
			const response = await api.post('/auth/privacy/export', {});
			const payload = response.data?.export || {};
			const json = JSON.stringify(payload, null, 2);
			const blob = new Blob([json], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement('a');
			anchor.href = url;
			anchor.download = `gueinsight-data-export-${new Date().toISOString().slice(0, 10)}.json`;
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			URL.revokeObjectURL(url);
			setPrivacyMessage('Data export generated and downloaded.');
		} catch (requestError) {
			setPrivacyError(requestError?.response?.data?.error || 'Unable to export data right now.');
		} finally {
			setPrivacyBusy(false);
		}
	};

	const requestAccountDeletion = async () => {
		const confirmed = window.confirm('Submit account deletion request and deactivate this account now?');
		if (!confirmed) return;

		setPrivacyBusy(true);
		setPrivacyError('');
		setPrivacyMessage('');
		try {
			await api.post('/auth/privacy/delete-request', { reason: 'Requested via profile privacy controls.' });
			setUser(null);
			setPrivacyMessage('Deletion request submitted. Your account has been deactivated.');
		} catch (requestError) {
			setPrivacyError(requestError?.response?.data?.error || 'Unable to submit deletion request right now.');
		} finally {
			setPrivacyBusy(false);
		}
	};

	const currentPlanLabel = String(user?.current_plan || 'free').replaceAll('_', ' ');

	if (loading) {
		return <main className="profile-page"><p>Loading your profile...</p></main>;
	}

	return (
		<main className="profile-page">
			<section className="profile-page__header">
				<div className="profile-page__header-row">
					<div>
						<p className="profile-page__eyebrow">Operator Identity</p>
						<h1>Profile control panel</h1>
						<p>Review immutable account attributes and manage team-editable profile fields.</p>
					</div>
					{user ? (
						<Link to={backLinkHref} className="profile-page__back-link">
							Back to dashboard
						</Link>
					) : null}
				</div>
			</section>

			<section className="profile-page__layout">
				<article className="profile-page__card">
					<h2>Read-only account info</h2>
					<div className="profile-page__meta-grid">
						{readOnlyMeta.map((item) => (
							<div className="profile-page__meta-item" key={item.label}>
								<span>{item.label}</span>
								<strong>{item.value}</strong>
							</div>
						))}
					</div>

					<div className="profile-page__meta-grid" style={{ marginTop: '12px' }}>
						<div className="profile-page__meta-item">
							<span>Current plan</span>
							<strong>{currentPlanLabel}</strong>
						</div>
						<div className="profile-page__meta-item">
							<span>Plan expires</span>
							<strong>{user?.plan_expires_at ? new Date(user.plan_expires_at).toLocaleString() : 'N/A'}</strong>
						</div>
					</div>

					<div className="profile-page__grid" style={{ marginTop: '12px' }}>
						<Link to="/subscription" className="profile-page__back-link">Manage plan</Link>
						<Link to="/support" className="profile-page__back-link">Open support</Link>
					</div>
				</article>

				<article className="profile-page__card">
					<h2>Editable details</h2>
					<form className="profile-page__form" onSubmit={handleSubmit}>
						<div className="profile-page__grid">
							<label>
								<span>First name</span>
								<input type="text" value={form.first_name} onChange={updateField('first_name')} required />
							</label>
							<label>
								<span>Last name</span>
								<input type="text" value={form.last_name} onChange={updateField('last_name')} required />
							</label>
						</div>

						<div className="profile-page__grid">
							<label>
								<span>Phone number</span>
								<input type="tel" value={form.phone_number} onChange={updateField('phone_number')} required />
							</label>
							<label>
								<span>Company</span>
								<input type="text" value={form.company} onChange={updateField('company')} />
							</label>
						</div>

						<div className="profile-page__grid">
							<label>
								<span>Job title</span>
								<input type="text" value={form.job_title} onChange={updateField('job_title')} />
							</label>
							<label>
								<span>Primary use case</span>
								<select value={form.primary_use_case} onChange={updateField('primary_use_case')}>
									{useCaseOptions.map((useCase) => (
										<option key={useCase} value={useCase}>{useCase}</option>
									))}
								</select>
							</label>
						</div>

						<label className="profile-page__checkbox">
							<input
								type="checkbox"
								checked={form.newsletter_opt_in}
								onChange={updateField('newsletter_opt_in')}
							/>
							<span>Receive product updates and security insights.</span>
						</label>

						{error ? <p className="profile-page__message profile-page__message--error">{error}</p> : null}
						{message ? <p className="profile-page__message profile-page__message--success">{message}</p> : null}

						<button type="submit" disabled={submitting}>
							{submitting ? 'Saving...' : 'Save profile'}
						</button>
					</form>
				</article>

				<article className="profile-page__card">
					<h2>Preferences</h2>
					<form className="profile-page__form" onSubmit={handleSavePreferences}>
						<div className="profile-page__grid">
							<label>
								<span>Avatar URL</span>
								<input type="url" value={preferences.avatar_url} onChange={updatePreferenceField('avatar_url')} placeholder="https://..." />
							</label>
							<label>
								<span>Theme</span>
								<select value={preferences.theme} onChange={updatePreferenceField('theme')}>
									<option value="system">System</option>
									<option value="light">Light</option>
									<option value="dark">Dark</option>
								</select>
							</label>
						</div>

						<div className="profile-page__grid">
							<label>
								<span>Timezone</span>
								<input type="text" value={preferences.timezone} onChange={updatePreferenceField('timezone')} />
							</label>
							<label>
								<span>Language</span>
								<input type="text" value={preferences.language} onChange={updatePreferenceField('language')} />
							</label>
						</div>

						<label className="profile-page__checkbox">
							<input type="checkbox" checked={preferences.notification_inapp_enabled} onChange={updatePreferenceField('notification_inapp_enabled')} />
							<span>Enable in-app notifications.</span>
						</label>

						<label className="profile-page__checkbox">
							<input type="checkbox" checked={preferences.notification_email_enabled} onChange={updatePreferenceField('notification_email_enabled')} />
							<span>Enable email notifications.</span>
						</label>

						{preferenceMessage ? <p className="profile-page__message profile-page__message--success">{preferenceMessage}</p> : null}
						<button type="submit" disabled={savingPreferences}>
							{savingPreferences ? 'Saving...' : 'Save preferences'}
						</button>
					</form>
				</article>

				<article className="profile-page__card">
					<h2>Billing transactions</h2>
					<div className="profile-page__meta-grid">
						{billingTransactions.length ? billingTransactions.map((tx) => (
							<div className="profile-page__meta-item" key={tx.id}>
								<span>{tx.status}</span>
								<strong>{tx.amount_minor} {String(tx.currency || '').toUpperCase()}</strong>
								<p>{tx.created_at ? new Date(tx.created_at).toLocaleString() : 'N/A'}</p>
							</div>
						)) : <p>No billing transactions yet.</p>}
					</div>
				</article>

				<article className="profile-page__card">
					<h2>Privacy and compliance</h2>
					<p>Manage GDPR consent records and submit data subject requests.</p>
					<div className="profile-page__grid" style={{ marginTop: '12px' }}>
						<button type="button" onClick={refreshLegalConsent} disabled={privacyBusy}>
							Refresh legal consent
						</button>
						<button type="button" onClick={exportPersonalData} disabled={privacyBusy}>
							Export my data
						</button>
					</div>
					<div className="profile-page__grid" style={{ marginTop: '12px' }}>
						<button type="button" onClick={requestAccountDeletion} disabled={privacyBusy}>
							Request account deletion
						</button>
					</div>
					{privacyError ? <p className="profile-page__message profile-page__message--error">{privacyError}</p> : null}
					{privacyMessage ? <p className="profile-page__message profile-page__message--success">{privacyMessage}</p> : null}
				</article>
			</section>
		</main>
	);
};

export default Profile;
