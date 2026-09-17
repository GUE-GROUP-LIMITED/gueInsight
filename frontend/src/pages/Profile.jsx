import { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import BrandingSettings from './BrandingSettings';
import { api } from '../services/api';
import './Profile.css';
import { useTranslation } from '../i18n/index';
import CockpitHeader from '../components/CockpitHeader';
import {
  IconUser,
  IconSettings,
  IconShield,
  IconLock,
  IconBell,
  IconCreditCard,
  IconUsers,
  IconPlus,
  IconTrash,
  IconCheckCircle,
  IconDownload,
  IconRefresh,
  IconArrowLeft,
  IconMail,
  IconGlobe,
  IconBriefcase,
  IconBuilding,
  IconPhone,
  IconInfo,
  IconAlertTriangle,
  IconSliders,
  IconExternalLink,
} from '../components/Icons';

const useCaseOptions = [
  'Threat monitoring',
  'Incident response',
  'Client security operations',
  'Compliance reporting',
  'General security analytics',
];

const PLAN_LABELS = {
  free: 'Free Forever',
  starter: 'Starter Plan',
  compliance_pro: 'Compliance Pro',
  enterprise_professional: 'Enterprise Professional',
  enterprise_risk: 'Enterprise Risk',
  enterprise_elite: 'Enterprise Elite',
  premium_small_business: 'Premium Small Business',
  premium_large_business: 'Premium Large Business',
};

const Profile = () => {
  const { user, setUser, loading } = useContext(AuthContext);
  const { t } = useTranslation();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState('account');
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
  const isEnterpriseUser = user && ['enterprise_risk', 'enterprise_elite', 'premium_small_business', 'premium_large_business'].includes(user.plan || user.current_plan);

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
        // Silently handled
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
      } catch {
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
      { label: t('profile.email') || 'Account Email', value: user.email || 'N/A', icon: <IconMail size={15} /> },
      { label: t('profile.role') || 'Role', value: (user.role || 'user').toUpperCase(), icon: <IconShield size={15} /> },
      { label: t('profile.team_size') || 'Team Size', value: user.team_size || '1 member', icon: <IconUsers size={15} /> },
      { label: t('profile.user_id') || 'User ID', value: user.id ? `#${String(user.id).slice(0, 10)}` : 'N/A', icon: <IconLock size={15} /> },
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
      setMessage(t('profile.profile_updated') || 'Profile updated successfully');
      setTimeout(() => setMessage(''), 4000);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || t('profile.update_failed') || 'Failed to update profile');
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
      setPreferenceMessage(t('profile.preferences_saved') || 'Preferences saved successfully');
      setTimeout(() => setPreferenceMessage(''), 4000);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || t('profile.save_preferences_failed') || 'Failed to save preferences');
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
      setPrivacyMessage(t('profile.consent_refreshed') || 'Legal consent timestamps refreshed successfully.');
      setTimeout(() => setPrivacyMessage(''), 4000);
    } catch (requestError) {
      setPrivacyError(requestError?.response?.data?.error || t('profile.refresh_consent_failed') || 'Failed to refresh consent');
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
      setPrivacyMessage(t('profile.data_exported') || 'Personal data archive exported.');
      setTimeout(() => setPrivacyMessage(''), 4000);
    } catch (requestError) {
      setPrivacyError(requestError?.response?.data?.error || t('profile.export_failed') || 'Failed to export data');
    } finally {
      setPrivacyBusy(false);
    }
  };

  const requestAccountDeletion = async () => {
    const confirmed = window.confirm(
      t('profile.delete_confirm') ||
        'Are you sure you want to request account deletion? All analysis history, audit trails, and configuration will be permanently purged in accordance with GDPR Article 17.'
    );
    if (!confirmed) return;

    setPrivacyBusy(true);
    setPrivacyError('');
    setPrivacyMessage('');
    try {
      await api.post('/auth/privacy/delete-request', { reason: 'Requested via profile privacy controls.' });
      setUser(null);
      setPrivacyMessage(t('profile.deletion_submitted') || 'Account deletion request submitted. You have been signed out.');
    } catch (requestError) {
      setPrivacyError(requestError?.response?.data?.error || t('profile.delete_failed') || 'Failed to submit deletion request');
    } finally {
      setPrivacyBusy(false);
    }
  };

  // Team management functions
  const addTeamMember = async (e) => {
    e.preventDefault();
    if (!newMemberEmail.trim()) {
      setTeamError('Email address is required');
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
      setTeamMessage('Team member invited successfully');
      setTimeout(() => setTeamMessage(''), 4000);
    } catch (requestError) {
      const errorMsg = requestError?.response?.data?.error || 'Failed to add team member';
      setTeamError(errorMsg);
    } finally {
      setAddingMember(false);
    }
  };

  const removeTeamMember = async (memberId) => {
    const confirmed = window.confirm('Remove this member from your organization? They will immediately lose access to shared telemetry and workspace settings.');
    if (!confirmed) return;

    setRemovingMemberId(memberId);
    setTeamError('');
    setTeamMessage('');

    try {
      await api.delete(`/auth/sub-users/${memberId}`);
      setTeamMembers(teamMembers.filter((m) => m.id !== memberId));
      setTeamMessage('Team member removed successfully');
      setTimeout(() => setTeamMessage(''), 4000);
    } catch (requestError) {
      const errorMsg = requestError?.response?.data?.error || 'Failed to remove team member';
      setTeamError(errorMsg);
    } finally {
      setRemovingMemberId(null);
    }
  };

  const currentPlanRaw = user?.current_plan || user?.plan || 'free';
  const currentPlanLabel = PLAN_LABELS[currentPlanRaw] || String(currentPlanRaw).replaceAll('_', ' ').toUpperCase();
  const userName = user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.email?.split('@')[0] || 'Security Officer';
  const userInitials = user?.first_name
    ? `${user.first_name[0]}${user.last_name ? user.last_name[0] : ''}`
    : user?.email ? user.email.slice(0, 2).toUpperCase() : 'GI';

  if (loading) {
    return (
      <div className="cg-cockpit-shell">
        <CockpitHeader />
        <main className="profile-page">
          <div className="profile-page__loading">
            <div className="profile-page__spinner" />
            <p>{t('profile.loading') || 'Loading account settings...'}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="cg-cockpit-shell">
      <CockpitHeader />
      <main className="profile-page">
      {/* Top Cockpit Header */}
      <section className="profile-page__header">
        <div className="profile-page__header-row">
          <div className="profile-page__header-meta">
            <div className="profile-page__eyebrow-badge">
              <span className="profile-page__dot" />
              <span>ACCOUNT CONFIGURATION</span>
            </div>
            <h1 className="profile-page__title">{t('profile.title') || 'Settings & Profile'}</h1>
            <p className="profile-page__lead">
              {t('profile.lead') || 'Manage your account credentials, security preferences, team members, and enterprise branding.'}
            </p>
          </div>

          <div className="profile-page__header-actions">
            {user ? (
              <Link to={backLinkHref} className="profile-page__btn-back">
                <IconArrowLeft size={16} />
                <span>{t('profile.back_to_dashboard') || 'Back to Cockpit'}</span>
              </Link>
            ) : null}

            <div className="profile-page__user-chip">
              {preferences.avatar_url ? (
                <img
                  src={preferences.avatar_url}
                  alt={userName}
                  className="profile-page__chip-img"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <div className="profile-page__chip-avatar">{userInitials}</div>
              )}
              <div className="profile-page__chip-text">
                <strong className="profile-page__chip-name">{userName}</strong>
                <span className="profile-page__chip-plan">{currentPlanLabel}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section Quick Jump Tabs */}
        <nav className="profile-page__nav-pills" aria-label="Profile navigation sections">
          <button
            type="button"
            className={`profile-nav-pill ${activeTab === 'account' ? 'profile-nav-pill--active' : ''}`}
            onClick={() => setActiveTab('account')}
          >
            <IconUser size={15} />
            <span>Account & Identity</span>
          </button>
          <button
            type="button"
            className={`profile-nav-pill ${activeTab === 'preferences' ? 'profile-nav-pill--active' : ''}`}
            onClick={() => setActiveTab('preferences')}
          >
            <IconSliders size={15} />
            <span>Preferences</span>
          </button>
          <button
            type="button"
            className={`profile-nav-pill ${activeTab === 'plan' ? 'profile-nav-pill--active' : ''}`}
            onClick={() => setActiveTab('plan')}
          >
            <IconCreditCard size={15} />
            <span>Subscription</span>
          </button>
          {isEnterpriseUser && (
            <button
              type="button"
              className={`profile-nav-pill ${activeTab === 'team' ? 'profile-nav-pill--active' : ''}`}
              onClick={() => setActiveTab('team')}
            >
              <IconUsers size={15} />
              <span>Team Members ({teamMembers.length})</span>
            </button>
          )}
          <button
            type="button"
            className={`profile-nav-pill ${activeTab === 'branding' ? 'profile-nav-pill--active' : ''}`}
            onClick={() => setActiveTab('branding')}
          >
            <IconBuilding size={15} />
            <span>Branding</span>
          </button>
          <button
            type="button"
            className={`profile-nav-pill ${activeTab === 'privacy' ? 'profile-nav-pill--active' : ''}`}
            onClick={() => setActiveTab('privacy')}
          >
            <IconShield size={15} />
            <span>Privacy & GDPR</span>
          </button>
        </nav>
      </section>

      {/* Main Settings Body */}
      <section className="profile-page__body">
        {/* TAB 1: Account Profile */}
        {(activeTab === 'account' || activeTab === 'all') && (
          <article className="profile-page__card" id="account-section">
            <div className="profile-page__card-header">
              <div className="profile-page__card-icon-wrap">
                <IconUser size={20} />
              </div>
              <div>
                <h2>{t('profile.editable_details') || 'Personal Profile Details'}</h2>
                <p>Update your operator credentials, job title, and organization details.</p>
              </div>
            </div>

            <form className="profile-page__form" onSubmit={handleSubmit}>
              <div className="profile-page__form-grid">
                <div className="profile-page__field">
                  <label htmlFor="first_name">
                    <span>{t('profile.first_name') || 'First Name'}</span>
                    <input
                      id="first_name"
                      type="text"
                      value={form.first_name}
                      onChange={updateField('first_name')}
                      placeholder="e.g. Alexander"
                      required
                    />
                  </label>
                </div>

                <div className="profile-page__field">
                  <label htmlFor="last_name">
                    <span>{t('profile.last_name') || 'Last Name'}</span>
                    <input
                      id="last_name"
                      type="text"
                      value={form.last_name}
                      onChange={updateField('last_name')}
                      placeholder="e.g. Vance"
                      required
                    />
                  </label>
                </div>
              </div>

              <div className="profile-page__form-grid">
                <div className="profile-page__field">
                  <label htmlFor="phone_number">
                    <span>{t('profile.phone_number') || 'Phone Number'}</span>
                    <input
                      id="phone_number"
                      type="tel"
                      value={form.phone_number}
                      onChange={updateField('phone_number')}
                      placeholder="+32 400 123 456"
                      required
                    />
                  </label>
                </div>

                <div className="profile-page__field">
                  <label htmlFor="company">
                    <span>{t('profile.company') || 'Company / Organization'}</span>
                    <input
                      id="company"
                      type="text"
                      value={form.company}
                      onChange={updateField('company')}
                      placeholder="e.g. Cyber Security Corp"
                    />
                  </label>
                </div>
              </div>

              <div className="profile-page__form-grid">
                <div className="profile-page__field">
                  <label htmlFor="job_title">
                    <span>{t('profile.job_title') || 'Job Title'}</span>
                    <input
                      id="job_title"
                      type="text"
                      value={form.job_title}
                      onChange={updateField('job_title')}
                      placeholder="e.g. Head of Information Security"
                    />
                  </label>
                </div>

                <div className="profile-page__field">
                  <label htmlFor="primary_use_case">
                    <span>{t('profile.primary_use_case') || 'Primary Security Use Case'}</span>
                    <select
                      id="primary_use_case"
                      value={form.primary_use_case}
                      onChange={updateField('primary_use_case')}
                    >
                      {useCaseOptions.map((useCase) => (
                        <option key={useCase} value={useCase}>
                          {useCase}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <label className="profile-page__checkbox-card">
                <input
                  type="checkbox"
                  checked={form.newsletter_opt_in}
                  onChange={updateField('newsletter_opt_in')}
                />
                <div className="profile-page__checkbox-label">
                  <strong>{t('profile.newsletter') || 'Security Advisory & Threat Digest'}</strong>
                  <span>Receive monthly telemetry insights, zero-day alerts, and EU compliance digests.</span>
                </div>
              </label>

              {error && (
                <div className="profile-page__alert profile-page__alert--error">
                  <IconAlertTriangle size={17} />
                  <span>{error}</span>
                </div>
              )}

              {message && (
                <div className="profile-page__alert profile-page__alert--success">
                  <IconCheckCircle size={17} />
                  <span>{message}</span>
                </div>
              )}

              <div className="profile-page__form-actions">
                <button type="submit" className="profile-page__btn-primary" disabled={submitting}>
                  {submitting ? (
                    <>
                      <span className="profile-page__btn-spinner" />
                      <span>{t('profile.saving') || 'Saving...'}</span>
                    </>
                  ) : (
                    <span>{t('profile.save_profile') || 'Save Profile'}</span>
                  )}
                </button>
              </div>
            </form>
          </article>
        )}

        {/* TAB 2: Preferences */}
        {(activeTab === 'preferences' || activeTab === 'all') && (
          <article className="profile-page__card" id="preferences-section">
            <div className="profile-page__card-header">
              <div className="profile-page__card-icon-wrap">
                <IconSliders size={20} />
              </div>
              <div>
                <h2>{t('profile.preferences') || 'System & Interface Preferences'}</h2>
                <p>Customize your visual workspace, timezone localization, and automated notification alerts.</p>
              </div>
            </div>

            <form className="profile-page__form" onSubmit={handleSavePreferences}>
              <div className="profile-page__form-grid">
                <div className="profile-page__field">
                  <label htmlFor="avatar_url">
                    <span>{t('profile.avatar_url') || 'Avatar Image URL'}</span>
                    <input
                      id="avatar_url"
                      type="url"
                      value={preferences.avatar_url}
                      onChange={updatePreferenceField('avatar_url')}
                      placeholder="https://example.com/avatar.jpg"
                    />
                  </label>
                </div>

                <div className="profile-page__field">
                  <label htmlFor="theme">
                    <span>{t('profile.theme') || 'Theme Interface'}</span>
                    <select
                      id="theme"
                      value={preferences.theme}
                      onChange={updatePreferenceField('theme')}
                    >
                      <option value="system">{t('profile.system') || 'System Standard (Dark Cockpit)'}</option>
                      <option value="dark">{t('profile.dark') || 'Obsidian Dark'}</option>
                      <option value="light">{t('profile.light') || 'Cyber Cream Light'}</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="profile-page__form-grid">
                <div className="profile-page__field">
                  <label htmlFor="timezone">
                    <span>{t('profile.timezone') || 'Timezone Localization'}</span>
                    <input
                      id="timezone"
                      type="text"
                      value={preferences.timezone}
                      onChange={updatePreferenceField('timezone')}
                      placeholder="UTC or Europe/Brussels"
                    />
                  </label>
                </div>

                <div className="profile-page__field">
                  <label htmlFor="language">
                    <span>{t('profile.language') || 'Platform Language'}</span>
                    <select
                      id="language"
                      value={preferences.language}
                      onChange={updatePreferenceField('language')}
                    >
                      <option value="en">English (EN)</option>
                      <option value="fr">Français (FR)</option>
                      <option value="nl">Nederlands (NL)</option>
                      <option value="de">Deutsch (DE)</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="profile-page__toggles-wrap">
                <label className="profile-page__checkbox-card">
                  <input
                    type="checkbox"
                    checked={preferences.notification_inapp_enabled}
                    onChange={updatePreferenceField('notification_inapp_enabled')}
                  />
                  <div className="profile-page__checkbox-label">
                    <strong>{t('profile.enable_inapp') || 'Enable In-App Real-Time Threat Alerts'}</strong>
                    <span>Display real-time cockpit banners when critical indicators of compromise are ingested.</span>
                  </div>
                </label>

                <label className="profile-page__checkbox-card">
                  <input
                    type="checkbox"
                    checked={preferences.notification_email_enabled}
                    onChange={updatePreferenceField('notification_email_enabled')}
                  />
                  <div className="profile-page__checkbox-label">
                    <strong>{t('profile.enable_email') || 'Enable Security Incident Email Notifications'}</strong>
                    <span>Receive urgent automated emails for high and critical triage detections.</span>
                  </div>
                </label>
              </div>

              {preferenceMessage && (
                <div className="profile-page__alert profile-page__alert--success">
                  <IconCheckCircle size={17} />
                  <span>{preferenceMessage}</span>
                </div>
              )}

              <div className="profile-page__form-actions">
                <button type="submit" className="profile-page__btn-primary" disabled={savingPreferences}>
                  {savingPreferences ? (
                    <>
                      <span className="profile-page__btn-spinner" />
                      <span>{t('profile.saving') || 'Saving...'}</span>
                    </>
                  ) : (
                    <span>{t('profile.save_preferences') || 'Save Preferences'}</span>
                  )}
                </button>
              </div>
            </form>
          </article>
        )}

        {/* TAB 3: Plan & Subscription */}
        {(activeTab === 'plan' || activeTab === 'all') && (
          <article className="profile-page__card" id="plan-section">
            <div className="profile-page__card-header">
              <div className="profile-page__card-icon-wrap">
                <IconCreditCard size={20} />
              </div>
              <div>
                <h2>{t('profile.read_only') || 'Subscription & Organization Plan'}</h2>
                <p>Verify your subscription tier, billing status, and platform account limits.</p>
              </div>
            </div>

            {/* Bento cards for plan status */}
            <div className="profile-page__bento-grid">
              <div className="profile-page__bento-card profile-page__bento-card--featured">
                <div className="profile-page__bento-head">
                  <span className="profile-page__bento-label">ACTIVE TIER</span>
                  <span className="profile-page__status-pill">ACTIVE</span>
                </div>
                <h3 className="profile-page__bento-title">{currentPlanLabel}</h3>
                <p className="profile-page__bento-desc">
                  {user?.plan_expires_at
                    ? `Renewal / Expiry: ${new Date(user.plan_expires_at).toLocaleDateString()}`
                    : 'Continuous billing cycle · EU Data Protected'}
                </p>
                <div className="profile-page__bento-actions">
                  <Link to="/subscription" className="profile-page__btn-primary">
                    <span>Manage Tier</span>
                  </Link>
                  <Link to="/billing" className="profile-page__btn-secondary">
                    <span>View Invoices</span>
                  </Link>
                </div>
              </div>

              <div className="profile-page__bento-card">
                <span className="profile-page__bento-label">ACCOUNT CREDENTIALS</span>
                <div className="profile-page__meta-list">
                  {readOnlyMeta.map((item) => (
                    <div className="profile-page__meta-row" key={item.label}>
                      <span className="profile-page__meta-label">
                        {item.icon}
                        <span>{item.label}</span>
                      </span>
                      <strong className="profile-page__meta-val">{item.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </article>
        )}

        {/* TAB 4: Team Members (Enterprise Only) */}
        {isEnterpriseUser && (activeTab === 'team' || activeTab === 'all') && (
          <article className="profile-page__card" id="team-section">
            <div className="profile-page__card-header">
              <div className="profile-page__card-icon-wrap">
                <IconUsers size={20} />
              </div>
              <div>
                <h2>Organization Team Members</h2>
                <p>Invite analysts and security engineers to share telemetry, custom IOCs, and compliance evidence.</p>
              </div>
            </div>

            {/* Add Team Member Card */}
            <div className="profile-page__team-add-box">
              <h3 className="profile-page__subhead">Invite New Member</h3>
              <form onSubmit={addTeamMember} className="profile-page__team-form">
                <div className="profile-page__field">
                  <label htmlFor="team-email">
                    <span>Work Email</span>
                    <input
                      type="email"
                      id="team-email"
                      placeholder="analyst@organization.com"
                      value={newMemberEmail}
                      onChange={(e) => setNewMemberEmail(e.target.value)}
                      required
                      disabled={addingMember}
                    />
                  </label>
                </div>

                <div className="profile-page__field">
                  <label htmlFor="team-role">
                    <span>Permission Role</span>
                    <select
                      id="team-role"
                      value={newMemberRole}
                      onChange={(e) => setNewMemberRole(e.target.value)}
                      disabled={addingMember}
                    >
                      <option value="analyst">Analyst (Triage & Reporting)</option>
                      <option value="manager">Manager (Threats & Team Mgmt)</option>
                      <option value="admin">Administrator (Full Access)</option>
                    </select>
                  </label>
                </div>

                <button type="submit" disabled={addingMember} className="profile-page__btn-primary profile-page__btn-team-add">
                  <IconPlus size={16} />
                  <span>{addingMember ? 'Inviting...' : 'Invite Member'}</span>
                </button>
              </form>

              {teamError && (
                <div className="profile-page__alert profile-page__alert--error">
                  <IconAlertTriangle size={17} />
                  <span>{teamError}</span>
                </div>
              )}
              {teamMessage && (
                <div className="profile-page__alert profile-page__alert--success">
                  <IconCheckCircle size={17} />
                  <span>{teamMessage}</span>
                </div>
              )}
            </div>

            {/* Current Team List */}
            <div className="profile-page__team-list-section">
              <h3 className="profile-page__subhead">Active Members ({teamMembers.length})</h3>

              {teamLoading ? (
                <div className="profile-page__empty-state">
                  <div className="profile-page__spinner" />
                  <p>Loading enterprise members...</p>
                </div>
              ) : teamMembers.length === 0 ? (
                <div className="profile-page__empty-state">
                  <IconUsers size={32} />
                  <p>No additional team members invited yet.</p>
                  <span>Use the form above to grant access to your security team.</span>
                </div>
              ) : (
                <div className="profile-page__team-grid">
                  {teamMembers.map((member) => (
                    <div key={member.id} className="profile-page__team-item">
                      <div className="profile-page__team-item-info">
                        <div className="profile-page__team-avatar">
                          {member.sub_user_email ? member.sub_user_email.slice(0, 2).toUpperCase() : 'TM'}
                        </div>
                        <div>
                          <p className="profile-page__team-email">{member.sub_user_email}</p>
                          <span className="profile-page__team-role-badge">
                            {String(member.role || 'analyst').toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeTeamMember(member.id)}
                        disabled={removingMemberId === member.id}
                        className="profile-page__btn-danger-outline"
                        title="Remove member"
                      >
                        <IconTrash size={15} />
                        <span>{removingMemberId === member.id ? 'Removing...' : 'Remove'}</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </article>
        )}

        {/* TAB 5: Branding Settings */}
        {(activeTab === 'branding' || activeTab === 'all') && (
          <article className="profile-page__card" id="branding-section">
            <BrandingSettings />
          </article>
        )}

        {/* TAB 6: Privacy, Compliance & Legal */}
        {(activeTab === 'privacy' || activeTab === 'all') && (
          <article className="profile-page__card" id="privacy-section">
            <div className="profile-page__card-header">
              <div className="profile-page__card-icon-wrap">
                <IconShield size={20} />
              </div>
              <div>
                <h2>{t('profile.privacy_and_compliance') || 'Data Privacy, GDPR & Governance'}</h2>
                <p>
                  {t('profile.privacy_subtitle') ||
                    'Exercise your EU GDPR rights. Download full telemetry history or submit legal audit consent updates.'}
                </p>
              </div>
            </div>

            <div className="profile-page__privacy-grid">
              <div className="profile-page__privacy-card">
                <div className="profile-page__privacy-icon">
                  <IconDownload size={20} />
                </div>
                <div>
                  <strong>Export Telemetry & Audit Logs</strong>
                  <p>Generate a structured JSON archive containing your incident reports, ingested alerts, and scan logs.</p>
                </div>
                <button
                  type="button"
                  onClick={exportPersonalData}
                  disabled={privacyBusy}
                  className="profile-page__btn-secondary"
                >
                  <IconDownload size={15} />
                  <span>{t('profile.export_my_data') || 'Export Data (.JSON)'}</span>
                </button>
              </div>

              <div className="profile-page__privacy-card">
                <div className="profile-page__privacy-icon">
                  <IconRefresh size={20} />
                </div>
                <div>
                  <strong>Refresh Legal Terms Consent</strong>
                  <p>Re-validate agreement with current EU NIS2 compliance policies, DPA amendments, and security SLA terms.</p>
                </div>
                <button
                  type="button"
                  onClick={refreshLegalConsent}
                  disabled={privacyBusy}
                  className="profile-page__btn-secondary"
                >
                  <IconRefresh size={15} />
                  <span>{t('profile.refresh_legal_consent') || 'Refresh Consent'}</span>
                </button>
              </div>
            </div>

            {/* Danger Zone: Account Deletion */}
            <div className="profile-page__danger-zone">
              <div className="profile-page__danger-info">
                <IconAlertTriangle size={22} className="profile-page__danger-icon" />
                <div>
                  <strong>GDPR Article 17 Right to Erasure (Purge Account)</strong>
                  <p>
                    Permanently delete your user credentials, uploaded samples, and encryption keys. This action is irreversible.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={requestAccountDeletion}
                disabled={privacyBusy}
                className="profile-page__btn-danger"
              >
                <IconTrash size={15} />
                <span>{t('profile.request_account_deletion') || 'Request Deletion'}</span>
              </button>
            </div>

            {privacyError && (
              <div className="profile-page__alert profile-page__alert--error">
                <IconAlertTriangle size={17} />
                <span>{privacyError}</span>
              </div>
            )}
            {privacyMessage && (
              <div className="profile-page__alert profile-page__alert--success">
                <IconCheckCircle size={17} />
                <span>{privacyMessage}</span>
              </div>
            )}
          </article>
        )}
      </section>
    </main>
  </div>
  );
};

export default Profile;
