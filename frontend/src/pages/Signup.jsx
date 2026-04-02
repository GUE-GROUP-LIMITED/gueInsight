import { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import './AuthPricing.css';

const teamSizeOptions = [
	'1-5',
	'6-20',
	'21-50',
	'51-200',
	'200+',
];

const useCaseOptions = [
	'Threat monitoring',
	'Incident response',
	'Client security operations',
	'Compliance reporting',
	'General security analytics',
];

const Signup = () => {
	const navigate = useNavigate();
	const { setUser } = useContext(AuthContext);
	const [firstName, setFirstName] = useState('');
	const [lastName, setLastName] = useState('');
	const [email, setEmail] = useState('');
	const [phoneNumber, setPhoneNumber] = useState('');
	const [company, setCompany] = useState('');
	const [jobTitle, setJobTitle] = useState('');
	const [teamSize, setTeamSize] = useState(teamSizeOptions[0]);
	const [primaryUseCase, setPrimaryUseCase] = useState(useCaseOptions[0]);
	const [agreedToTerms, setAgreedToTerms] = useState(false);
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

		if (!agreedToTerms) {
			setError('Please accept the Terms and Privacy Policy to continue.');
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
			});
			setUser(response.data?.user || null);
			setSuccess('Account created successfully.');
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
					<p className="auth-pricing-card__eyebrow">Get started</p>
					<h1>Create your GueInsight account</h1>
					<p>Tell us about your team so we can tailor your onboarding and recommended setup.</p>
				</div>

				<form className="auth-pricing-form" onSubmit={handleSubmit}>
					<div className="auth-pricing-grid">
						<div>
							<label htmlFor="signup-first-name">First name</label>
							<input
								id="signup-first-name"
								type="text"
								placeholder="Jane"
								value={firstName}
								onChange={(e) => setFirstName(e.target.value)}
								required
							/>
						</div>

						<div>
							<label htmlFor="signup-last-name">Last name</label>
							<input
								id="signup-last-name"
								type="text"
								placeholder="Doe"
								value={lastName}
								onChange={(e) => setLastName(e.target.value)}
								required
							/>
						</div>
					</div>

					<label htmlFor="signup-email">Work email</label>
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
							<label htmlFor="signup-company">Company</label>
							<input
								id="signup-company"
								type="text"
								placeholder="Acme Security"
								value={company}
								onChange={(e) => setCompany(e.target.value)}
								required
							/>
						</div>

						<div>
							<label htmlFor="signup-job-title">Job title</label>
							<input
								id="signup-job-title"
								type="text"
								placeholder="Security Analyst"
								value={jobTitle}
								onChange={(e) => setJobTitle(e.target.value)}
								required
							/>
						</div>
					</div>

					<div className="auth-pricing-grid">
						<div>
							<label htmlFor="signup-phone">Phone number</label>
							<input
								id="signup-phone"
								type="tel"
								placeholder="+1 555 010 9999"
								value={phoneNumber}
								onChange={(e) => setPhoneNumber(e.target.value)}
								required
							/>
						</div>

						<div>
							<label htmlFor="signup-team-size">Team size</label>
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

					<label htmlFor="signup-primary-use-case">Primary use case</label>
					<select
						id="signup-primary-use-case"
						value={primaryUseCase}
						onChange={(e) => setPrimaryUseCase(e.target.value)}
					>
						{useCaseOptions.map((useCase) => (
							<option key={useCase} value={useCase}>{useCase}</option>
						))}
					</select>

					<label htmlFor="signup-password">Password</label>
					<input
						id="signup-password"
						type="password"
						placeholder="Create a strong password"
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
						<span>Send me product updates and security insights.</span>
					</label>

					<label className="auth-pricing-checkbox auth-pricing-checkbox--required">
						<input
							type="checkbox"
							checked={agreedToTerms}
							onChange={(e) => setAgreedToTerms(e.target.checked)}
							required
						/>
						<span>I agree to the Terms of Service and Privacy Policy.</span>
					</label>

					<button type="submit" disabled={loading}>
						{loading ? 'Creating account...' : 'Create account'}
					</button>

					{error && <p className="auth-pricing-message auth-pricing-message--error">{error}</p>}
					{success && <p className="auth-pricing-message auth-pricing-message--success">{success}</p>}
				</form>

			</section>
		</main>
	);
};

export default Signup;
