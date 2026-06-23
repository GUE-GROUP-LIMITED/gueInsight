import { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import BrandingSettings from './BrandingSettings';
import { api } from '../services/api';
import './Profile.css';
import { useTranslation } from '../i18n/index';

const useCaseOptions = [
	'Threat monitoring',
	'Incident response',
	'Client security operations',
	'Compliance reporting',
	'General security analytics',
];

const Profile = () => {
	const { user, setUser, loading } = useContext(AuthContext);
	const { t } = useTranslation();
	const location = useLocation();
	const [submitting, setSubmitting] = useState(false);
	const [savingPreferences, setSavingPreferences] = useState(false);
	const [message, setMessage] = useState('');
	const [error, setError] = useState('');
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
	
	// Team management state
	const [teamMembers, setTeamMembers] = useState([]);
	const [teamLoading, setTeamLoading] = useState(false);
	const [teamError, setTeamError] = useState('');
	const [teamMessage, setTeamMessage] = useState('');
	const [newMemberEmail, setNewMemberEmail] = useState('');
	const [newMemberRole, setNewMemberRole] = useState('analyst');
	const [addingMember, setAddingMember] = useState(false);
	const [removingMemberId, setRemovingMemberId] = useState(null);
	
	const isAdminProfile = location.pathname.startsWith('/admin');
	const backLinkHref = isAdminProfile ? '/admin' : '/dashboard';
	const isEnterpriseUser = user && ['enterprise_risk', 'enterprise_elite', 'premium_small_business', 'premium_large_business'].includes(user.plan);

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
				const prefResponse = await api.get('/auth/preferences');
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
			} catch {
				// Handle error silently
			}
		};

		loadProfileExtras();

		return () => {
			active = false;
		};
	}, [user]);

	// Load team members for enterprise users
	useEffect(() => {
		if (!isEnterpriseUser) return;

		let active = true;

		const loadTeamMembers = async () => {
			setTeamLoading(true);
			setTeamError('');
			try {
				const response = await api.get('/auth/sub-users');
				if (active) {
					setTeamMembers(Array.isArray(response.data?.sub_users) ? response.data.sub_users : []);
				}
			} catch (err) {
				if (active) {
					setTeamError('Failed to load team members');
				}
			} finally {
				if (active) {
					setTeamLoading(false);
				}
			}
		};

		loadTeamMembers();

		return () => {
			active = false;
		};
	}, [isEnterpriseUser]);

	const readOnlyMeta = useMemo(() => {
		if (!user) return [];
		return [
			{ label: t('profile.email'), value: user.email || 'N/A' },
			{ label: t('profile.role'), value: user.role || 'user' },
			{ label: t('profile.team_size'), value: user.team_size || 'N/A' },
			{ label: t('profile.user_id'), value: user.id || 'N/A' },
		];
	}, [t, user]);

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
			setMessage(t('profile.profile_updated'));
		} catch (requestError) {
			setError(requestError?.response?.data?.error || t('profile.update_failed'));
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
			setPreferenceMessage(t('profile.preferences_saved'));
		} catch (requestError) {
			setError(requestError?.response?.data?.error || t('profile.save_preferences_failed'));
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
			setPrivacyMessage(t('profile.consent_refreshed'));
		} catch (requestError) {
			setPrivacyError(requestError?.response?.data?.error || t('profile.refresh_consent_failed'));
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
			setPrivacyMessage(t('profile.data_exported'));
		} catch (requestError) {
			setPrivacyError(requestError?.response?.data?.error || t('profile.export_failed'));
		} finally {
			setPrivacyBusy(false);
		}
	};

	const requestAccountDeletion = async () => {
		const confirmed = window.confirm(t('profile.delete_confirm'));
		if (!confirmed) return;

		setPrivacyBusy(true);
		setPrivacyError('');
		setPrivacyMessage('');
		try {
			await api.post('/auth/privacy/delete-request', { reason: 'Requested via profile privacy controls.' });
			setUser(null);
			setPrivacyMessage(t('profile.deletion_submitted'));
		} catch (requestError) {
			setPrivacyError(requestError?.response?.data?.error || t('profile.delete_failed'));
		} finally {
			setPrivacyBusy(false);
		}
	};

	// Team management functions
	const addTeamMember = async (e) => {
		e.preventDefault();
		if (!newMemberEmail.trim()) {
			setTeamError('Email is required');
			return;
		}

		setAddingMember(true);
		setTeamError('');
		setTeamMessage('');

		try {
			const response = await api.post('/auth/sub-users', {
				email: newMemberEmail.trim(),
				role: newMemberRole,
				permissions: '',
			});

			setTeamMembers([...teamMembers, response.data]);
			setNewMemberEmail('');
			setNewMemberRole('analyst');
			setTeamMessage('Team member added successfully');
		} catch (requestError) {
			const errorMsg = requestError?.response?.data?.error || 'Failed to add team member';
			setTeamError(errorMsg);
		} finally {
			setAddingMember(false);
		}
	};

	const removeTeamMember = async (memberId) => {
		const confirmed = window.confirm('Remove this team member from your organization?');
		if (!confirmed) return;

		setRemovingMemberId(memberId);
		setTeamError('');
		setTeamMessage('');

		try {
			await api.delete(`/auth/sub-users/${memberId}`);
			setTeamMembers(teamMembers.filter((m) => m.id !== memberId));
			setTeamMessage('Team member removed successfully');
		} catch (requestError) {
			const errorMsg = requestError?.response?.data?.error || 'Failed to remove team member';
			setTeamError(errorMsg);
		} finally {
			setRemovingMemberId(null);
		}
	};

	const currentPlanLabel = String(user?.current_plan || 'free').replaceAll('_', ' ');

	if (loading) {
		return <main className="profile-page"><p>{t('profile.loading')}</p></main>;
	}

	return (
		<main className="profile-page">
			<section className="profile-page__header">
				<div className="profile-page__header-row">
					<div>
						<p className="profile-page__eyebrow">{t('profile.eyebrow')}</p>
						<h1>{t('profile.title')}</h1>
						<p>{t('profile.lead')}</p>
					</div>
					{user ? (
						<Link to={backLinkHref} className="profile-page__back-link">
							{t('profile.back_to_dashboard')}
						</Link>
					) : null}
				</div>
			</section>

			<section className="profile-page__layout">
				<article className="profile-page__card">
					<h2>{t('profile.read_only')}</h2>
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
							<span>{t('profile.current_plan')}</span>
							<strong>{currentPlanLabel}</strong>
						</div>
						<div className="profile-page__meta-item">
							<span>{t('profile.plan_expires')}</span>
							<strong>{user?.plan_expires_at ? new Date(user.plan_expires_at).toLocaleString() : 'N/A'}</strong>
						</div>
					</div>

					<div className="profile-page__grid" style={{ marginTop: '12px' }}>
						<Link to="/subscription" className="profile-page__back-link">{t('profile.manage_plan')}</Link>
						<Link to="/support" className="profile-page__back-link">{t('profile.open_support')}</Link>
					</div>
				</article>

				<article className="profile-page__card">
					<h2>{t('profile.editable_details')}</h2>
					<form className="profile-page__form" onSubmit={handleSubmit}>
						<div className="profile-page__grid">
							<label>
								<span>{t('profile.first_name')}</span>
								<input type="text" value={form.first_name} onChange={updateField('first_name')} required />
							</label>
							<label>
								<span>{t('profile.last_name')}</span>
								<input type="text" value={form.last_name} onChange={updateField('last_name')} required />
							</label>
						</div>

						<div className="profile-page__grid">
							<label>
								<span>{t('profile.phone_number')}</span>
								<input type="tel" value={form.phone_number} onChange={updateField('phone_number')} required />
							</label>
							<label>
								<span>{t('profile.company')}</span>
								<input type="text" value={form.company} onChange={updateField('company')} />
							</label>
						</div>

						<div className="profile-page__grid">
							<label>
								<span>{t('profile.job_title')}</span>
								<input type="text" value={form.job_title} onChange={updateField('job_title')} />
							</label>
							<label>
								<span>{t('profile.primary_use_case')}</span>
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
							<span>{t('profile.newsletter')}</span>
						</label>

						{error ? <p className="profile-page__message profile-page__message--error">{error}</p> : null}
						{message ? <p className="profile-page__message profile-page__message--success">{message}</p> : null}

						<button type="submit" disabled={submitting}>
							{submitting ? t('profile.saving') : t('profile.save_profile')}
						</button>
					</form>
				</article>

				<article className="profile-page__card">
								<h2>{t('profile.preferences')}</h2>
					<form className="profile-page__form" onSubmit={handleSavePreferences}>
						<div className="profile-page__grid">
							<label>
											<span>{t('profile.avatar_url')}</span>
											<input type="url" value={preferences.avatar_url} onChange={updatePreferenceField('avatar_url')} placeholder="https://..." />
							</label>
							<label>
											<span>{t('profile.theme')}</span>
								<select value={preferences.theme} onChange={updatePreferenceField('theme')}>
												<option value="system">{t('profile.system')}</option>
												<option value="light">{t('profile.light')}</option>
												<option value="dark">{t('profile.dark')}</option>
								</select>
							</label>
						</div>

						<div className="profile-page__grid">
							<label>
											<span>{t('profile.timezone')}</span>
								<input type="text" value={preferences.timezone} onChange={updatePreferenceField('timezone')} />
							</label>
							<label>
											<span>{t('profile.language')}</span>
								<input type="text" value={preferences.language} onChange={updatePreferenceField('language')} />
							</label>
						</div>

						<label className="profile-page__checkbox">
							<input type="checkbox" checked={preferences.notification_inapp_enabled} onChange={updatePreferenceField('notification_inapp_enabled')} />
										<span>{t('profile.enable_inapp')}</span>
						</label>

						<label className="profile-page__checkbox">
							<input type="checkbox" checked={preferences.notification_email_enabled} onChange={updatePreferenceField('notification_email_enabled')} />
										<span>{t('profile.enable_email')}</span>
						</label>

						{preferenceMessage ? <p className="profile-page__message profile-page__message--success">{preferenceMessage}</p> : null}
						<button type="submit" disabled={savingPreferences}>
							{savingPreferences ? t('profile.saving') : t('profile.save_preferences')}
						</button>
					</form>
				</article>

				<BrandingSettings />

				{isEnterpriseUser && (
					<article className="profile-page__card" style={{ marginBottom: '30px' }}>
						<h2 style={{ background: 'linear-gradient(135deg, rgb(110, 236, 229) 0%, rgb(103, 180, 255) 100%)', backgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: '1.5rem', fontWeight: 700, margin: '0 0 10px 0' }}>👥 Team Members</h2>
						<p className="subtitle" style={{ color: 'rgb(156, 163, 175)', fontSize: '0.95rem', margin: '0 0 20px 0' }}>Invite and manage team members in your organization. Team members can use GueInsight with your shared configuration.</p>

						<div className="branding-section">
							<h3 style={{ marginBottom: '15px' }}>Add Team Member</h3>
							<form onSubmit={addTeamMember} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '10px', alignItems: 'flex-start' }}>
								<div className="form-group" style={{ margin: 0 }}>
									<label htmlFor="team-email">Email Address</label>
									<input
										type="email"
										id="team-email"
										name="email"
										placeholder="colleague@company.com"
										value={newMemberEmail}
										onChange={(e) => setNewMemberEmail(e.target.value)}
										required
										disabled={addingMember}
									/>
								</div>
								<div className="form-group" style={{ margin: 0 }}>
									<label htmlFor="team-role">Role</label>
									<select
										id="team-role"
										value={newMemberRole}
										onChange={(e) => setNewMemberRole(e.target.value)}
										disabled={addingMember}
									>
										<option value="analyst">Analyst</option>
										<option value="manager">Manager</option>
										<option value="admin">Admin</option>
									</select>
								</div>
								<button type="submit" disabled={addingMember} style={{ marginTop: '25px' }} className="btn btn-success">
									{addingMember ? 'Adding...' : '➕ Add Member'}
								</button>
							</form>
							{teamError && <p style={{ color: '#ef4444', marginTop: '10px', fontSize: '0.9rem' }}>⚠️ {teamError}</p>}
							{teamMessage && <p style={{ color: '#10b981', marginTop: '10px', fontSize: '0.9rem' }}>✅ {teamMessage}</p>}
						</div>

						<div className="branding-section" style={{ marginTop: '20px' }}>
							<h3 style={{ marginBottom: '15px' }}>Current Team</h3>
							{teamLoading ? (
								<p>Loading team members...</p>
							) : teamMembers.length === 0 ? (
								<p style={{ color: 'rgb(156, 163, 175)' }}>No team members added yet.</p>
							) : (
								<div style={{ display: 'grid', gap: '10px' }}>
									{teamMembers.map((member) => (
										<div key={member.id} style={{
											display: 'flex',
											justifyContent: 'space-between',
											alignItems: 'center',
											padding: '12px',
											backgroundColor: 'rgba(110, 236, 229, 0.08)',
											border: '1px solid rgba(110, 236, 229, 0.2)',
											borderRadius: '6px'
										}}>
											<div>
												<p style={{ margin: '0 0 4px 0', fontWeight: '500' }}>{member.sub_user_email}</p>
												<p style={{ margin: 0, fontSize: '0.9rem', color: 'rgb(156, 163, 175)' }}>Role: <strong>{member.role || 'analyst'}</strong></p>
											</div>
											<button
												type="button"
												onClick={() => removeTeamMember(member.id)}
												disabled={removingMemberId === member.id}
												style={{
													padding: '6px 12px',
													backgroundColor: '#ef4444',
													color: 'white',
													border: 'none',
													borderRadius: '4px',
													cursor: 'pointer',
													fontSize: '0.9rem'
												}}
											>
												{removingMemberId === member.id ? 'Removing...' : '🗑️ Remove'}
											</button>
										</div>
									))}
								</div>
							)}
						</div>

						<div className="info-box">
							<h3>ℹ️ About Team Members</h3>
							<ul>
								<li><strong>Analyst:</strong> Can perform threat analysis and view reports</li>
								<li><strong>Manager:</strong> Can manage team members and access analytics</li>
								<li><strong>Admin:</strong> Full access including billing and settings</li>
								<li>Team members share your company branding and subscription configuration</li>
								<li>Each team member maintains their own analysis history and data</li>
							</ul>
						</div>
					</article>
				)}

				<article className="profile-page__card">
					<h2>{t('profile.privacy_and_compliance')}</h2>
					<p>{t('profile.privacy_subtitle')}</p>
					<div className="profile-page__grid" style={{ marginTop: '12px' }}>
						<button type="button" onClick={refreshLegalConsent} disabled={privacyBusy}>
							{t('profile.refresh_legal_consent')}
						</button>
						<button type="button" onClick={exportPersonalData} disabled={privacyBusy}>
							{t('profile.export_my_data')}
						</button>
					</div>
					<div className="profile-page__grid" style={{ marginTop: '12px' }}>
						<button type="button" onClick={requestAccountDeletion} disabled={privacyBusy}>
							{t('profile.request_account_deletion')}
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
