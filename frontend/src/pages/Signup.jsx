import { useContext, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { LogoGueInsight, IconCheckCircle, IconShieldCheck, IconGlobe, IconClipboard } from '../components/Icons';
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
	{ icon: <IconShieldCheck size={16} />, text: 'NIS2 & GDPR compliance built-in' },
	{ icon: <IconGlobe size={16} />, text: 'EU-only data residency on Elite' },
	{ icon: <IconClipboard size={16} />, text: 'vCISO portal on Enterprise Elite' },
	{ icon: <IconCheckCircle size={16} />, text: '14-day trial, cancel any time' },
];

const Signup = () => {
	const { setUser } = useContext(AuthContext);
	const { t } = useTranslation();
	const location = useLocation();
	const [firstName, setFirstName] = useState('');
	const [lastName, setLastName] = useState('');
	const [email, setEmail] = useState('');
	const [phoneNumber, setPhoneNumber] = useState('');
	const [company, setCompany] = useState('');
	const [jobTitle, setJobTitle] = useState('');
	const [countryOfResidence, setCountryOfResidence] = useState('');
	const [address, setAddress] = useState('');
	const [city, setCity] = useState('');
	const [postalCode, setPostalCode] = useState('');
	const [teamSize, setTeamSize] = useState(teamSizeOptions[0]);
	const [primaryUseCase, setPrimaryUseCase] = useState(useCaseOptions[0].value);
	const [agreedToTerms, setAgreedToTerms] = useState(false);
	const [gdprConsent, setGdprConsent] = useState(false);
	const [newsletter, setNewsletter] = useState(true);
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e) => {
		e.preventDefault();
		setLoading(true);
		setError('');
		setSuccess('');

		if (!agreedToTerms || !gdprConsent) {
			setError(t('signup.accept_terms_error'));
			setLoading(false);
			return;
		}

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
			setSuccess(response.data?.message || t('signup.verification_sent'));
		} catch (err) {
			setError(err?.response?.data?.error || 'Signup failed.');
		}
		setLoading(false);
	};

	return (
		<div className="auth-split">
			{/* ── LEFT PANEL ── */}
			<div className="auth-split__left">
				<div className="auth-split__left-deco" aria-hidden="true" />
				<div className="auth-split__left-deco2" aria-hidden="true" />

				{/* Brand */}
				<Link to="/" className="auth-split__left-brand">
					<div className="auth-split__left-logo">
						<LogoGueInsight size={28} />
					</div>
					<span className="auth-split__left-name">GueInsight<span className="auth-split__left-name-dot">.</span></span>
				</Link>

				{/* Content */}
				<div className="auth-split__left-content">
					<h1 className="auth-split__left-heading">
						Find your<br />security <em>home.</em>
					</h1>
					<p className="auth-split__left-sub">
						Join Belgian and European organisations using GueInsight to stay secure and compliant.
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
				</div>
			</div>

			{/* ── RIGHT PANEL ── */}
			<div className="auth-split__right">
				{/* Top bar */}
				<div className="auth-split__right-topbar">
					<Link to="/" className="auth-split__right-back">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
							<path d="m15 18-6-6 6-6"/>
						</svg>
						Back to home
					</Link>
					<span className="auth-split__right-join">
						Already have an account? <Link to={`/login${location.search || ''}`}>Log in ↗</Link>
					</span>
				</div>

				{/* Form area */}
				<div className="auth-split__right-body auth-split__right-body--signup">
					<div className="auth-split__form-wrap auth-split__form-wrap--wide">
						<h1 className="auth-split__form-heading">Create your account</h1>
						<p className="auth-split__form-sub">{t('signup.intro')}</p>

						<form className="auth-split__form" onSubmit={handleSubmit}>

							{/* Name row */}
							<div className="auth-split__form-row">
								<div className="auth-split__form-field">
									<label className="auth-split__label" htmlFor="signup-first-name">{t('signup.first_name')}</label>
									<input
										id="signup-first-name"
										type="text"
										placeholder={t('signup.placeholder_first')}
										value={firstName}
										onChange={(e) => setFirstName(e.target.value)}
										className="auth-split__input"
										required
									/>
								</div>
								<div className="auth-split__form-field">
									<label className="auth-split__label" htmlFor="signup-last-name">{t('signup.last_name')}</label>
									<input
										id="signup-last-name"
										type="text"
										placeholder={t('signup.placeholder_last')}
										value={lastName}
										onChange={(e) => setLastName(e.target.value)}
										className="auth-split__input"
										required
									/>
								</div>
							</div>

							{/* Email */}
							<div className="auth-split__form-field">
								<label className="auth-split__label" htmlFor="signup-email">{t('signup.work_email')}</label>
								<input
									id="signup-email"
									type="email"
									placeholder="you@company.com"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									className="auth-split__input"
									required
								/>
							</div>

							{/* Company + Job title */}
							<div className="auth-split__form-row">
								<div className="auth-split__form-field">
									<label className="auth-split__label" htmlFor="signup-company">{t('signup.company')}</label>
									<input
										id="signup-company"
										type="text"
										placeholder={t('signup.placeholder_company')}
										value={company}
										onChange={(e) => setCompany(e.target.value)}
										className="auth-split__input"
										required
									/>
								</div>
								<div className="auth-split__form-field">
									<label className="auth-split__label" htmlFor="signup-job-title">{t('signup.job_title')}</label>
									<input
										id="signup-job-title"
										type="text"
										placeholder={t('signup.placeholder_job')}
										value={jobTitle}
										onChange={(e) => setJobTitle(e.target.value)}
										className="auth-split__input"
										required
									/>
								</div>
							</div>

							{/* Country + City */}
							<div className="auth-split__form-row">
								<div className="auth-split__form-field">
									<label className="auth-split__label" htmlFor="signup-country">{t('signup.country_of_residence')}</label>
									<input
										id="signup-country"
										type="text"
										placeholder={t('signup.placeholder_country')}
										value={countryOfResidence}
										onChange={(e) => setCountryOfResidence(e.target.value)}
										className="auth-split__input"
										required
									/>
								</div>
								<div className="auth-split__form-field">
									<label className="auth-split__label" htmlFor="signup-city">{t('signup.city')}</label>
									<input
										id="signup-city"
										type="text"
										placeholder={t('signup.placeholder_city')}
										value={city}
										onChange={(e) => setCity(e.target.value)}
										className="auth-split__input"
										required
									/>
								</div>
							</div>

							{/* Address */}
							<div className="auth-split__form-field">
								<label className="auth-split__label" htmlFor="signup-address">{t('signup.address')}</label>
								<input
									id="signup-address"
									type="text"
									placeholder={t('signup.placeholder_address')}
									value={address}
									onChange={(e) => setAddress(e.target.value)}
									className="auth-split__input"
									required
								/>
							</div>

							{/* Postal + Phone */}
							<div className="auth-split__form-row">
								<div className="auth-split__form-field">
									<label className="auth-split__label" htmlFor="signup-postal-code">{t('signup.postal_code')}</label>
									<input
										id="signup-postal-code"
										type="text"
										placeholder={t('signup.placeholder_postal_code')}
										value={postalCode}
										onChange={(e) => setPostalCode(e.target.value)}
										className="auth-split__input"
										required
									/>
								</div>
								<div className="auth-split__form-field">
									<label className="auth-split__label" htmlFor="signup-phone">{t('signup.phone_number')}</label>
									<input
										id="signup-phone"
										type="tel"
										placeholder={t('signup.placeholder_phone')}
										value={phoneNumber}
										onChange={(e) => setPhoneNumber(e.target.value)}
										className="auth-split__input"
										required
									/>
								</div>
							</div>

							{/* Team size + Use case */}
							<div className="auth-split__form-row">
								<div className="auth-split__form-field">
									<label className="auth-split__label" htmlFor="signup-team-size">{t('signup.team_size')}</label>
									<select
										id="signup-team-size"
										value={teamSize}
										onChange={(e) => setTeamSize(e.target.value)}
										className="auth-split__input"
									>
										{teamSizeOptions.map((size) => (
											<option key={size} value={size}>{size}</option>
										))}
									</select>
								</div>
								<div className="auth-split__form-field">
									<label className="auth-split__label" htmlFor="signup-primary-use-case">{t('signup.primary_use_case')}</label>
									<select
										id="signup-primary-use-case"
										value={primaryUseCase}
										onChange={(e) => setPrimaryUseCase(e.target.value)}
										className="auth-split__input"
									>
										{useCaseOptions.map((useCase) => (
											<option key={useCase.value} value={useCase.value}>{t(`signup.${useCase.key}`)}</option>
										))}
									</select>
								</div>
							</div>

							{/* Password */}
							<div className="auth-split__form-field">
								<label className="auth-split__label" htmlFor="signup-password">{t('signup.password')}</label>
								<input
									id="signup-password"
									type="password"
									placeholder={t('signup.placeholder_password')}
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									className="auth-split__input"
									required
								/>
								<span style={{ fontSize: '0.75rem', color: '#9A9490', marginTop: 4 }}>{t('signup.verification_note')}</span>
							</div>

							{/* Checkboxes */}
							<div className="auth-split__checkboxes">
								<label className="auth-split__checkbox-row">
									<input
										type="checkbox"
										checked={newsletter}
										onChange={(e) => setNewsletter(e.target.checked)}
									/>
									<span>{t('signup.newsletter')}</span>
								</label>
								<label className="auth-split__checkbox-row auth-split__checkbox-row--required">
									<input
										type="checkbox"
										checked={agreedToTerms}
										onChange={(e) => setAgreedToTerms(e.target.checked)}
										required
									/>
									<span>{t('signup.terms')}</span>
								</label>
								<label className="auth-split__checkbox-row auth-split__checkbox-row--required">
									<input
										type="checkbox"
										checked={gdprConsent}
										onChange={(e) => setGdprConsent(e.target.checked)}
										required
									/>
									<span>{t('signup.consent')}</span>
								</label>
							</div>

							{/* Submit */}
							<button type="submit" className="auth-split__submit" disabled={loading}>
								<span>{loading ? t('signup.creating') : t('signup.create_account')}</span>
								<span className="auth-split__submit-arrow">›</span>
							</button>

							{error && <p className="auth-split__message auth-split__message--error">{error}</p>}
							{success && <p className="auth-split__message auth-split__message--success">{success}</p>}
						</form>

						<div className="auth-split__form-footer">
							<p>
								{t('signup.note')} <Link to={`/login${location.search || ''}`}>{t('login.log_in')}</Link>
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default Signup;
