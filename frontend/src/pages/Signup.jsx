import { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import './AuthPricing.css';
import { useTranslation } from '../i18n/index';

const teamSizeOptions = [
	'1-5',
	'6-20',
	'21-50',
	'51-200',
	'200+',
];

const useCaseOptions = [
	{ value: 'Threat monitoring', key: 'use_case_threat' },
	{ value: 'Incident response', key: 'use_case_incident' },
	{ value: 'Client security operations', key: 'use_case_client' },
	{ value: 'Compliance reporting', key: 'use_case_compliance' },
	{ value: 'General security analytics', key: 'use_case_general' },
];

const Signup = () => {
	const navigate = useNavigate();
	const { setUser } = useContext(AuthContext);
	const { t } = useTranslation();
	const [firstName, setFirstName] = useState('');
	const [lastName, setLastName] = useState('');
	const [email, setEmail] = useState('');
	const [phoneNumber, setPhoneNumber] = useState('');
	const [company, setCompany] = useState('');
	const [jobTitle, setJobTitle] = useState('');
	const [teamSize, setTeamSize] = useState(teamSizeOptions[0]);
	const [primaryUseCase, setPrimaryUseCase] = useState(useCaseOptions[0]);
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
				team_size: teamSize,
				primary_use_case: primaryUseCase,
				newsletter,
				agree_to_terms: agreedToTerms,
				gdpr_consent: gdprConsent,
			});
			setUser(response.data?.user || null);
			setSuccess(t('signup.create_account'));
			navigate('/dashboard');
		} catch (err) {
			setError(err?.response?.data?.error || 'Signup failed.');
		}
		setLoading(false);
	};

	return (
		<main className="auth-pricing-page auth-pricing-page--auth">
			<section className="auth-pricing-card auth-pricing-card--signup">
				<div className="auth-pricing-card__head">
					<p className="auth-pricing-card__eyebrow">{t('signup.eyebrow')}</p>
					<h1>{t('signup.heading')}</h1>
					<p>{t('signup.intro')}</p>
					<p className="auth-pricing-card__note">
						{t('signup.note')} <Link to="/login">{t('login.log_in')}</Link>.
					</p>
				</div>

				<form className="auth-pricing-form" onSubmit={handleSubmit}>
					<div className="auth-pricing-grid">
						<div>
							<label htmlFor="signup-first-name">{t('signup.first_name')}</label>
							<input
								id="signup-first-name"
								type="text"
								placeholder={t('signup.placeholder_first')}
								value={firstName}
								onChange={(e) => setFirstName(e.target.value)}
								required
							/>
						</div>

						<div>
							<label htmlFor="signup-last-name">{t('signup.last_name')}</label>
							<input
								id="signup-last-name"
								type="text"
								placeholder={t('signup.placeholder_last')}
								value={lastName}
								onChange={(e) => setLastName(e.target.value)}
								required
							/>
						</div>
					</div>

					<label htmlFor="signup-email">{t('signup.work_email')}</label>
					<input
						id="signup-email"
						type="email"
						placeholder="you@company.com"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						required
					/>

					<div className="auth-pricing-grid">
						<div>
							<label htmlFor="signup-company">{t('signup.company')}</label>
							<input
								id="signup-company"
								type="text"
								placeholder={t('signup.placeholder_company')}
								value={company}
								onChange={(e) => setCompany(e.target.value)}
								required
							/>
						</div>

						<div>
							<label htmlFor="signup-job-title">{t('signup.job_title')}</label>
							<input
								id="signup-job-title"
								type="text"
								placeholder={t('signup.placeholder_job')}
								value={jobTitle}
								onChange={(e) => setJobTitle(e.target.value)}
								required
							/>
						</div>
					</div>

					<div className="auth-pricing-grid">
						<div>
							<label htmlFor="signup-phone">{t('signup.phone_number')}</label>
							<input
								id="signup-phone"
								type="tel"
								placeholder={t('signup.placeholder_phone')}
								value={phoneNumber}
								onChange={(e) => setPhoneNumber(e.target.value)}
								required
							/>
						</div>

						<div>
							<label htmlFor="signup-team-size">{t('signup.team_size')}</label>
							<select
								id="signup-team-size"
								value={teamSize}
								onChange={(e) => setTeamSize(e.target.value)}
							>
								{teamSizeOptions.map((size) => (
									<option key={size} value={size}>{size}</option>
								))}
							</select>
						</div>
					</div>

					<label htmlFor="signup-primary-use-case">{t('signup.primary_use_case')}</label>
					<select
						id="signup-primary-use-case"
						value={primaryUseCase}
						onChange={(e) => setPrimaryUseCase(e.target.value)}
					>
						{useCaseOptions.map((useCase) => (
							<option key={useCase.value} value={useCase.value}>{t(`signup.${useCase.key}`)}</option>
						))}
					</select>

					<label htmlFor="signup-password">{t('signup.password')}</label>
					<input
						id="signup-password"
						type="password"
						placeholder={t('signup.placeholder_password')}
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
					/>

					<label className="auth-pricing-checkbox">
						<input
							type="checkbox"
							checked={newsletter}
							onChange={(e) => setNewsletter(e.target.checked)}
						/>
						<span>{t('signup.newsletter')}</span>
					</label>

					<label className="auth-pricing-checkbox auth-pricing-checkbox--required">
						<input
							type="checkbox"
							checked={agreedToTerms}
							onChange={(e) => setAgreedToTerms(e.target.checked)}
							required
						/>
						<span>{t('signup.terms')}</span>
					</label>

					<label className="auth-pricing-checkbox auth-pricing-checkbox--required">
						<input
							type="checkbox"
							checked={gdprConsent}
							onChange={(e) => setGdprConsent(e.target.checked)}
							required
						/>
						<span>{t('signup.consent')}</span>
					</label>

					<button type="submit" disabled={loading}>
						{loading ? t('signup.creating') : t('signup.create_account')}
					</button>

					{error && <p className="auth-pricing-message auth-pricing-message--error">{error}</p>}
					{success && <p className="auth-pricing-message auth-pricing-message--success">{success}</p>}
				</form>

			</section>
		</main>
	);
};

export default Signup;
