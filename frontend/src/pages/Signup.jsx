import { useContext, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import {
  IconCheckCircle,
  IconShieldCheck,
  IconGlobe,
  IconClipboard,
  IconUser,
  IconBriefcase,
  IconMapPin,
  IconLock,
  IconArrowRight,
  IconChevronLeft,
  IconPhone,
  IconMail,
  IconArrowUpRight,
} from '../components/Icons';
import './AuthPricing.css';
import { useTranslation } from '../i18n/index';

const teamSizeOptions = ['1-5', '6-20', '21-50', '51-200', '200+'];

const useCaseOptions = [
  { value: 'Threat monitoring', key: 'use_case_threat' },
  { value: 'Incident response', key: 'use_case_incident' },
  { value: 'Client security operations', key: 'use_case_client' },
  { value: 'Compliance reporting', key: 'use_case_compliance' },
  { value: 'General security analytics', key: 'use_case_general' },
];

const LEFT_FEATURES = [
  { icon: <IconShieldCheck size={18} />, text: 'NIS2 & GDPR compliance built-in' },
  { icon: <IconGlobe size={18} />, text: 'EU-only data residency on Elite tier' },
  { icon: <IconClipboard size={18} />, text: 'Dedicated vCISO portal on Enterprise Elite' },
  { icon: <IconCheckCircle size={18} />, text: '14-day full platform trial, cancel any time' },
];

const Signup = () => {
  const { setUser } = useContext(AuthContext);
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  // Multi-step form step state: 1 = Personal, 2 = Company, 3 = Location & Terms
  const [step, setStep] = useState(1);

  // Step 1: Personal
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');

  // Step 2: Company
  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [teamSize, setTeamSize] = useState(teamSizeOptions[0]);
  const [primaryUseCase, setPrimaryUseCase] = useState(useCaseOptions[0].value);

  // Step 3: Location & Compliance
  const [countryOfResidence, setCountryOfResidence] = useState('Belgium');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [gdprConsent, setGdprConsent] = useState(false);
  const [newsletter, setNewsletter] = useState(true);

  // UI state
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Navigation & validation
  const validateStep1 = () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please provide your first and last name.');
      return false;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid work email address.');
      return false;
    }
    if (!phoneNumber.trim()) {
      setError('Please enter your contact phone number.');
      return false;
    }
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return false;
    }
    setError('');
    return true;
  };

  const handleNextToStep2 = (e) => {
    e?.preventDefault();
    if (validateStep1()) {
      setStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const validateStep2 = () => {
    if (!company.trim()) {
      setError('Please provide your company or organisation name.');
      return false;
    }
    if (!jobTitle.trim()) {
      setError('Please provide your job title or role.');
      return false;
    }
    setError('');
    return true;
  };

  const handleNextToStep3 = (e) => {
    e?.preventDefault();
    if (validateStep2()) {
      setStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleStepJump = (targetStep) => {
    if (targetStep === 1) {
      setError('');
      setStep(1);
    } else if (targetStep === 2) {
      if (validateStep1()) {
        setStep(2);
      }
    } else if (targetStep === 3) {
      if (validateStep1() && validateStep2()) {
        setStep(3);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!countryOfResidence.trim() || !city.trim() || !address.trim() || !postalCode.trim()) {
      setError('Please complete all location fields.');
      return;
    }

    if (!agreedToTerms || !gdprConsent) {
      setError(t('signup.accept_terms_error') || 'Please accept the Terms of Service and GDPR consent to proceed.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/signup', {
        first_name: firstName,
        last_name: lastName,
        email,
        phone_number: phoneNumber,
        password,
        company,
        job_title: jobTitle,
        country_of_residence: countryOfResidence,
        address,
        city,
        postal_code: postalCode,
        team_size: teamSize,
        primary_use_case: primaryUseCase,
        newsletter,
        agree_to_terms: agreedToTerms,
        gdpr_consent: gdprConsent,
      });
      setUser(response.data?.user || null);
      setSuccess(response.data?.message || t('signup.verification_sent') || 'Account created! Check your inbox for a verification email before logging in.');
    } catch (err) {
      setError(err?.response?.data?.error || 'Signup failed. Please check your information and try again.');
    }
    setLoading(false);
  };

  return (
    <div className="auth-split">
      {/* ── LEFT PANEL (Desktop only, completely removed on smaller screens) ── */}
      <div className="auth-split__left">
        <div className="auth-split__left-deco" aria-hidden="true" />
        <div className="auth-split__left-deco2" aria-hidden="true" />

        {/* Brand */}
        <Link to="/" className="auth-split__left-brand">
          <div className="auth-split__left-logo">
            <img src="/img/logo.png" alt="GueInsight logo" width="28" height="28" style={{ borderRadius: 6, objectFit: 'cover' }} />
          </div>
          <span className="auth-split__left-name">GueInsight<span className="auth-split__left-name-dot">.</span></span>
        </Link>

        {/* Content */}
        <div className="auth-split__left-content">
          <h1 className="auth-split__left-heading">
            Find your<br />security <em>home.</em>
          </h1>
          <p className="auth-split__left-sub">
            Join Belgian and European organisations using GueInsight to stay secure, compliant, and audit-ready.
          </p>

          {/* Feature list */}
          <div className="auth-split__signup-features">
            {LEFT_FEATURES.map((f, i) => (
              <div key={i} className="auth-split__signup-feature">
                <span className="auth-split__signup-feature-icon">{f.icon}</span>
                <span>{f.text}</span>
              </div>
            ))}
          </div>

          {/* Trust badge */}
          <div className="auth-split__trust-pill">
            <IconShieldCheck size={16} color="#ffffff" />
            <span>Bank-grade 256-bit encryption · Hosted in EU</span>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL (Full width and centered on mobile & smaller screens) ── */}
      <div className="auth-split__right">
        {/* Top bar */}
        <div className="auth-split__right-topbar">
          <div className="auth-split__topbar-left">
            <Link to="/" className="auth-split__right-back" title="Back to home">
              <IconChevronLeft size={16} />
              <span className="auth-split__back-label">Back to home</span>
              <span className="auth-split__back-label-mobile">Back</span>
            </Link>
          </div>

          {/* Mobile brand (shown only on mobile/tablet when left panel is hidden) */}
          <div className="auth-split__topbar-center">
            <Link to="/" className="auth-split__mobile-brand" aria-label="GueInsight Home">
              <img src="/img/logo.png" alt="GueInsight" width="24" height="24" style={{ borderRadius: 6, objectFit: 'cover' }} />
              <span>GueInsight<span className="auth-split__left-name-dot">.</span></span>
            </Link>
          </div>

          <div className="auth-split__topbar-right">
            <span className="auth-split__right-join">
              <span className="auth-split__join-prompt">{t('signup.note') || 'Already have an account?'}</span>
              <Link to={`/login${location.search || ''}`} className="auth-split__join-link">
                <span>Log in</span>
                <IconArrowUpRight size={13} />
              </Link>
            </span>
          </div>
        </div>

        {/* Form area */}
        <div className="auth-split__right-body auth-split__right-body--signup">
          <div className="auth-split__form-wrap auth-split__form-wrap--wide">

            {/* Header */}
            <div className="auth-signup-header">
              <h1 className="auth-split__form-heading">Create your account</h1>
              <p className="auth-split__form-sub">
                Setup your GueInsight workspace in three quick steps.
              </p>
            </div>

            {/* If successful, show celebratory confirmation */}
            {success ? (
              <div className="auth-success-card">
                <div className="auth-success-card__icon">
                  <IconCheckCircle size={38} color="#16a34a" />
                </div>
                <h2>Account Created Successfully!</h2>
                <p className="auth-success-card__text">
                  We've sent a verification link to <strong>{email}</strong>. Please check your inbox and click the verification link to activate your account.
                </p>
                <div className="auth-success-card__actions">
                  <Link to={`/login?verified=0`} className="auth-split__submit" style={{ textDecoration: 'none', justifyContent: 'center' }}>
                    <span>Proceed to Login</span>
                    <IconArrowRight size={16} />
                  </Link>
                  <Link to="/" className="auth-success-card__home-link">
                    Return to home
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {/* ══ STEP PROGRESS WIZARD ══ */}
                <div className="auth-stepper" role="tablist" aria-label="Signup Progress">
                  <button
                    type="button"
                    className={`auth-stepper__tab ${step === 1 ? 'auth-stepper__tab--active' : ''} ${step > 1 ? 'auth-stepper__tab--done' : ''}`}
                    onClick={() => handleStepJump(1)}
                  >
                    <span className="auth-stepper__tab-num">
                      {step > 1 ? <IconCheckCircle size={14} color="#ffffff" /> : '1'}
                    </span>
                    <span className="auth-stepper__tab-label">
                      <IconUser size={13} className="auth-stepper__tab-icon" />
                      Personal
                    </span>
                  </button>

                  <div className={`auth-stepper__divider ${step >= 2 ? 'auth-stepper__divider--active' : ''}`} />

                  <button
                    type="button"
                    className={`auth-stepper__tab ${step === 2 ? 'auth-stepper__tab--active' : ''} ${step > 2 ? 'auth-stepper__tab--done' : ''}`}
                    onClick={() => handleStepJump(2)}
                  >
                    <span className="auth-stepper__tab-num">
                      {step > 2 ? <IconCheckCircle size={14} color="#ffffff" /> : '2'}
                    </span>
                    <span className="auth-stepper__tab-label">
                      <IconBriefcase size={13} className="auth-stepper__tab-icon" />
                      Company
                    </span>
                  </button>

                  <div className={`auth-stepper__divider ${step >= 3 ? 'auth-stepper__divider--active' : ''}`} />

                  <button
                    type="button"
                    className={`auth-stepper__tab ${step === 3 ? 'auth-stepper__tab--active' : ''}`}
                    onClick={() => handleStepJump(3)}
                  >
                    <span className="auth-stepper__tab-num">3</span>
                    <span className="auth-stepper__tab-label">
                      <IconShieldCheck size={13} className="auth-stepper__tab-icon" />
                      Location &amp; Terms
                    </span>
                  </button>
                </div>

                {/* Progress bar track */}
                <div className="auth-stepper__progress-track" aria-hidden="true">
                  <div
                    className="auth-stepper__progress-fill"
                    style={{ width: step === 1 ? '33.3%' : step === 2 ? '66.6%' : '100%' }}
                  />
                </div>

                {/* Inline Error Message */}
                {error && (
                  <div className="auth-split__message auth-split__message--error" style={{ marginBottom: 18 }}>
                    {error}
                  </div>
                )}

                {/* ══ STEP 1: PERSONAL DETAILS ══ */}
                {step === 1 && (
                  <form className="auth-step-section" onSubmit={handleNextToStep2}>
                    <div className="auth-step-section__head">
                      <div className="auth-step-section__badge">
                        <IconUser size={14} />
                        Step 1 of 3
                      </div>
                      <h2>Personal Details</h2>
                      <p>Enter your contact details to set up your GueInsight user profile.</p>
                    </div>

                    <div className="auth-split__form">
                      {/* Name row */}
                      <div className="auth-split__form-row">
                        <div className="auth-split__form-field">
                          <label className="auth-split__label" htmlFor="signup-first-name">
                            {t('signup.first_name') || 'First name'} <span className="auth-required">*</span>
                          </label>
                          <input
                            id="signup-first-name"
                            type="text"
                            placeholder={t('signup.placeholder_first') || 'e.g. Marie'}
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className="auth-split__input"
                            required
                            autoFocus
                          />
                        </div>
                        <div className="auth-split__form-field">
                          <label className="auth-split__label" htmlFor="signup-last-name">
                            {t('signup.last_name') || 'Last name'} <span className="auth-required">*</span>
                          </label>
                          <input
                            id="signup-last-name"
                            type="text"
                            placeholder={t('signup.placeholder_last') || 'e.g. Dubois'}
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            className="auth-split__input"
                            required
                          />
                        </div>
                      </div>

                      {/* Email */}
                      <div className="auth-split__form-field">
                        <label className="auth-split__label" htmlFor="signup-email">
                          {t('signup.work_email') || 'Work email'} <span className="auth-required">*</span>
                        </label>
                        <input
                          id="signup-email"
                          type="email"
                          placeholder={t('signup.placeholder_email') || 'you@company.com'}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="auth-split__input"
                          required
                        />
                      </div>

                      {/* Phone */}
                      <div className="auth-split__form-field">
                        <label className="auth-split__label" htmlFor="signup-phone">
                          {t('signup.phone_number') || 'Phone number'} <span className="auth-required">*</span>
                        </label>
                        <input
                          id="signup-phone"
                          type="tel"
                          placeholder={t('signup.placeholder_phone') || '+32 470 12 34 56'}
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="auth-split__input"
                          required
                        />
                      </div>

                      {/* Password */}
                      <div className="auth-split__form-field">
                        <label className="auth-split__label" htmlFor="signup-password">
                          {t('signup.password') || 'Password'} <span className="auth-required">*</span>
                        </label>
                        <input
                          id="signup-password"
                          type="password"
                          placeholder={t('signup.placeholder_password') || 'Min. 8 characters'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="auth-split__input"
                          required
                        />
                        <span className="auth-split__field-hint">
                          Must be at least 8 characters. A verification email will be sent upon completion.
                        </span>
                      </div>

                      {/* Step 1 Actions */}
                      <div className="auth-step-actions">
                        <button type="submit" className="auth-split__submit">
                          <span>Continue to Company Details</span>
                          <span className="auth-split__submit-arrow">›</span>
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {/* ══ STEP 2: COMPANY DETAILS ══ */}
                {step === 2 && (
                  <form className="auth-step-section" onSubmit={handleNextToStep3}>
                    <div className="auth-step-section__head">
                      <div className="auth-step-section__badge">
                        <IconBriefcase size={14} />
                        Step 2 of 3
                      </div>
                      <h2>Company &amp; Organization</h2>
                      <p>Tell us about your organization so we can tailor your compliance dashboard.</p>
                    </div>

                    <div className="auth-split__form">
                      {/* Company + Job title */}
                      <div className="auth-split__form-row">
                        <div className="auth-split__form-field">
                          <label className="auth-split__label" htmlFor="signup-company">
                            {t('signup.company') || 'Company name'} <span className="auth-required">*</span>
                          </label>
                          <input
                            id="signup-company"
                            type="text"
                            placeholder={t('signup.placeholder_company') || 'e.g. Acme BV'}
                            value={company}
                            onChange={(e) => setCompany(e.target.value)}
                            className="auth-split__input"
                            required
                            autoFocus
                          />
                        </div>
                        <div className="auth-split__form-field">
                          <label className="auth-split__label" htmlFor="signup-job-title">
                            {t('signup.job_title') || 'Job title'} <span className="auth-required">*</span>
                          </label>
                          <input
                            id="signup-job-title"
                            type="text"
                            placeholder={t('signup.placeholder_job') || 'e.g. CISO or IT Director'}
                            value={jobTitle}
                            onChange={(e) => setJobTitle(e.target.value)}
                            className="auth-split__input"
                            required
                          />
                        </div>
                      </div>

                      {/* Team size + Use case */}
                      <div className="auth-split__form-row">
                        <div className="auth-split__form-field">
                          <label className="auth-split__label" htmlFor="signup-team-size">
                            {t('signup.team_size') || 'Team size'}
                          </label>
                          <select
                            id="signup-team-size"
                            value={teamSize}
                            onChange={(e) => setTeamSize(e.target.value)}
                            className="auth-split__input auth-split__select"
                          >
                            {teamSizeOptions.map((size) => (
                              <option key={size} value={size}>
                                {size} {size === '1-5' ? 'people (Small team)' : 'people'}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="auth-split__form-field">
                          <label className="auth-split__label" htmlFor="signup-primary-use-case">
                            {t('signup.primary_use_case') || 'Primary use case'}
                          </label>
                          <select
                            id="signup-primary-use-case"
                            value={primaryUseCase}
                            onChange={(e) => setPrimaryUseCase(e.target.value)}
                            className="auth-split__input auth-split__select"
                          >
                            {useCaseOptions.map((uc) => (
                              <option key={uc.value} value={uc.value}>
                                {t(`signup.${uc.key}`) || uc.value}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Step 2 Actions */}
                      <div className="auth-step-actions auth-step-actions--two-btn">
                        <button
                          type="button"
                          className="auth-split__back-btn"
                          onClick={() => setStep(1)}
                        >
                          <IconChevronLeft size={16} />
                          <span>Back to Personal</span>
                        </button>
                        <button type="submit" className="auth-split__submit">
                          <span>Continue to Location &amp; Terms</span>
                          <span className="auth-split__submit-arrow">›</span>
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {/* ══ STEP 3: LOCATION & COMPLIANCE ══ */}
                {step === 3 && (
                  <form className="auth-step-section" onSubmit={handleSubmit}>
                    <div className="auth-step-section__head">
                      <div className="auth-step-section__badge">
                        <IconShieldCheck size={14} />
                        Step 3 of 3
                      </div>
                      <h2>Location &amp; Compliance</h2>
                      <p>Configure EU residency, NIS2 regulatory boundaries, and agree to service terms.</p>
                    </div>

                    <div className="auth-split__form">
                      {/* Country + City */}
                      <div className="auth-split__form-row">
                        <div className="auth-split__form-field">
                          <label className="auth-split__label" htmlFor="signup-country">
                            {t('signup.country_of_residence') || 'Country of residence'} <span className="auth-required">*</span>
                          </label>
                          <input
                            id="signup-country"
                            type="text"
                            placeholder={t('signup.placeholder_country') || 'e.g. Belgium'}
                            value={countryOfResidence}
                            onChange={(e) => setCountryOfResidence(e.target.value)}
                            className="auth-split__input"
                            required
                            autoFocus
                          />
                        </div>
                        <div className="auth-split__form-field">
                          <label className="auth-split__label" htmlFor="signup-city">
                            {t('signup.city') || 'City'} <span className="auth-required">*</span>
                          </label>
                          <input
                            id="signup-city"
                            type="text"
                            placeholder={t('signup.placeholder_city') || 'e.g. Brussels'}
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            className="auth-split__input"
                            required
                          />
                        </div>
                      </div>

                      {/* Address + Postal code */}
                      <div className="auth-split__form-row">
                        <div className="auth-split__form-field">
                          <label className="auth-split__label" htmlFor="signup-address">
                            {t('signup.address') || 'Street address'} <span className="auth-required">*</span>
                          </label>
                          <input
                            id="signup-address"
                            type="text"
                            placeholder={t('signup.placeholder_address') || 'e.g. Avenue Louise 120'}
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            className="auth-split__input"
                            required
                          />
                        </div>
                        <div className="auth-split__form-field">
                          <label className="auth-split__label" htmlFor="signup-postal-code">
                            {t('signup.postal_code') || 'Postal code'} <span className="auth-required">*</span>
                          </label>
                          <input
                            id="signup-postal-code"
                            type="text"
                            placeholder={t('signup.placeholder_postal_code') || 'e.g. 1000'}
                            value={postalCode}
                            onChange={(e) => setPostalCode(e.target.value)}
                            className="auth-split__input"
                            required
                          />
                        </div>
                      </div>

                      {/* Checkboxes */}
                      <div className="auth-split__checkboxes">
                        <label className="auth-split__checkbox-row">
                          <input
                            type="checkbox"
                            checked={newsletter}
                            onChange={(e) => setNewsletter(e.target.checked)}
                          />
                          <span>{t('signup.newsletter') || 'Send me product updates and cybersecurity intelligence digests'}</span>
                        </label>

                        <label className="auth-split__checkbox-row auth-split__checkbox-row--required">
                          <input
                            type="checkbox"
                            checked={agreedToTerms}
                            onChange={(e) => setAgreedToTerms(e.target.checked)}
                            required
                          />
                          <span>
                            I agree to the <Link to="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</Link> and{' '}
                            <Link to="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>
                            <span className="auth-required">*</span>
                          </span>
                        </label>

                        <label className="auth-split__checkbox-row auth-split__checkbox-row--required">
                          <input
                            type="checkbox"
                            checked={gdprConsent}
                            onChange={(e) => setGdprConsent(e.target.checked)}
                            required
                          />
                          <span>
                            {t('signup.consent') || 'I consent to GDPR-compliant processing of my business data'}
                            <span className="auth-required">*</span>
                          </span>
                        </label>
                      </div>

                      {/* Step 3 Actions */}
                      <div className="auth-step-actions auth-step-actions--two-btn">
                        <button
                          type="button"
                          className="auth-split__back-btn"
                          onClick={() => setStep(2)}
                        >
                          <IconChevronLeft size={16} />
                          <span>Back to Company</span>
                        </button>

                        <button type="submit" className="auth-split__submit" disabled={loading}>
                          <span>{loading ? (t('signup.creating') || 'Creating account...') : (t('signup.create_account') || 'Create account')}</span>
                          <span className="auth-split__submit-arrow">›</span>
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </>
            )}

            {/* Footer */}
            <div className="auth-split__form-footer">
              <p>
                {t('signup.note') || 'Already have an account?'} <Link to={`/login${location.search || ''}`}>{t('login.log_in') || 'Log in'}</Link>
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
