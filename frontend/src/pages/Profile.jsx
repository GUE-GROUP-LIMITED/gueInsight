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
	const [message, setMessage] = useState('');
	const [error, setError] = useState('');
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
			</section>
		</main>
	);
};

export default Profile;
