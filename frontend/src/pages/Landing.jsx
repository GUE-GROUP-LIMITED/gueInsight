import { Link } from 'react-router-dom';
import { useState } from 'react';
import TrialModal from '../components/TrialModal';
import PlanSelector from '../components/PlanSelector';
import './Landing.css';
import { useTranslation } from '../i18n/index';

const Landing = () => {
	const [showTrialModal, setShowTrialModal] = useState(false);
	const [showPlanSelector, setShowPlanSelector] = useState(false);
	const { t } = useTranslation();

	return (
		<div className="landing-page">
			<div className="landing-page__ambient" aria-hidden="true" />

			<div className="landing-page__utility-bar">
				<span>{t('landing.utility')}</span>
				<Link to="/support">{t('landing.urgent_support')}</Link>
			</div>

			<section className="landing-page__hero">
				<div className="landing-page__hero-copy">
					<p className="landing-page__eyebrow">{t('landing.eyebrow')}</p>
					<h1>{t('landing.title')}</h1>
					<p className="landing-page__lead">{t('landing.lead')}</p>

					<div className="landing-page__actions">
						<button onClick={() => setShowPlanSelector(true)} className="landing-page__primary-action">{t('landing.start_trial')}</button>
						<Link to="/subscription" className="landing-page__secondary-action">{t('landing.walkthrough')}</Link>
					</div>

					<div className="landing-page__trust-row" aria-label="Platform trust signals">
						<span>{t('landing.trust_fast')}</span>
						<span>{t('landing.trust_compliance')}</span>
						<span>{t('landing.trust_discovery')}</span>
					</div>
				</div>

				<div className="landing-page__hero-panel">
					<p className="landing-page__panel-title">{t('landing.snapshot')}</p>
					<h2>{t('landing.snapshot_title')}</h2>
					<div className="landing-page__proof-grid">
						<article>
							<p className="landing-page__proof-value">{t('landing.snapshot_files')}</p>
							<p className="landing-page__proof-label">{t('landing.snapshot_files_desc')}</p>
						</article>
						<article>
							<p className="landing-page__proof-value">{t('landing.snapshot_compliance')}</p>
							<p className="landing-page__proof-label">{t('landing.snapshot_compliance_desc')}</p>
						</article>
						<article>
							<p className="landing-page__proof-value">{t('landing.snapshot_cloud')}</p>
							<p className="landing-page__proof-label">{t('landing.snapshot_cloud_desc')}</p>
						</article>
					</div>
				</div>
			</section>

			<section className="landing-page__highlights">
				<article className="landing-page__card">
					<h2>{t('landing.fast_analysis')}</h2>
					<p>{t('landing.fast_analysis_desc')}</p>
				</article>
				<article className="landing-page__card">
					<h2>{t('landing.compliance_ready')}</h2>
					<p>{t('landing.compliance_ready_desc')}</p>
				</article>
				<article className="landing-page__card">
					<h2>{t('landing.tenant_discovery')}</h2>
					<p>{t('landing.tenant_discovery_desc')}</p>
				</article>
			</section>

			<section className="landing-page__workflow" aria-labelledby="capabilities-title">
				<div className="landing-page__workflow-head">
					<p className="landing-page__eyebrow">{t('landing.what_you_can_do')}</p>
					<h2 id="capabilities-title">{t('landing.capabilities')}</h2>
				</div>
				<div className="landing-page__workflow-grid">
					<article className="landing-page__workflow-step">
						<h3>{t('landing.ingest_files')}</h3>
						<p>{t('landing.ingest_files_desc')}</p>
					</article>
					<article className="landing-page__workflow-step">
						<h3>{t('landing.run_intelligence')}</h3>
						<p>{t('landing.run_intelligence_desc')}</p>
					</article>
					<article className="landing-page__workflow-step">
						<h3>{t('landing.manage_incidents')}</h3>
						<p>{t('landing.manage_incidents_desc')}</p>
					</article>
				</div>
			</section>

			<section className="landing-page__insights" aria-labelledby="features-title">
				<div className="landing-page__workflow-head">
					<p className="landing-page__eyebrow">{t('landing.feature_snapshot')}</p>
					<h2 id="features-title">{t('landing.key_features')}</h2>
				</div>
				<div className="landing-page__insight-grid">
					<article className="landing-page__insight-card">
						<p>{t('landing.auto_ioc')}</p>
						<h3>{t('landing.auto_ioc_desc')}</h3>
					</article>
					<article className="landing-page__insight-card">
						<p>{t('landing.alerting')}</p>
						<h3>{t('landing.alerting_desc')}</h3>
					</article>
					<article className="landing-page__insight-card">
						<p>{t('landing.compliance_tiers')}</p>
						<h3>{t('landing.compliance_tiers_desc')}</h3>
					</article>
				</div>
			</section>

			<section className="landing-page__conversion" aria-labelledby="trial-title">
				<h2 id="trial-title">{t('landing.trial_policy')}</h2>
				<p>{t('landing.trial_policy_desc')}</p>
				<div className="landing-page__actions">
					<button onClick={() => setShowPlanSelector(true)} className="landing-page__primary-action">{t('landing.start_trial')}</button>
					<Link to="/subscription" className="landing-page__secondary-action">{t('landing.explore_plans')}</Link>
				</div>
				<div className="landing-page__table-wrap">
					<table className="landing-page__compare">
						<thead>
							<tr><th>{t('landing.feature')}</th><th>{t('landing.starter')}</th><th>{t('landing.compliance_pro')}</th><th>{t('landing.enterprise_risk')}</th></tr>
						</thead>
						<tbody>
							<tr><td>{t('landing.file_types')}</td><td>{t('landing.basic')}</td><td>{t('landing.pdf_pcap_logs')}</td><td>{t('landing.all_dbs')}</td></tr>
							<tr><td>{t('landing.gdpr_tools')}</td><td>—</td><td>{t('landing.export_deletion')}</td><td>{t('landing.export_deletion_audit')}</td></tr>
							<tr><td>{t('landing.retention')}</td><td>{t('landing.days_30')}</td><td>{t('landing.days_90')}</td><td>{t('landing.year_1')}</td></tr>
							<tr><td>{t('landing.connectors')}</td><td>—</td><td>{t('landing.m365_basic')}</td><td>{t('landing.m365_gws')}</td></tr>
						</tbody>
					</table>
				</div>
			</section>

			<section className="landing-page__highlights" aria-labelledby="security-title">
				<div className="landing-page__workflow-head">
					<p className="landing-page__eyebrow">{t('landing.security_privacy')}</p>
					<h2 id="security-title">{t('landing.built_for')}</h2>
				</div>
				<div className="landing-page__workflow-grid">
					<article className="landing-page__workflow-step">
						<h3>{t('landing.audit_first')}</h3>
						<p>{t('landing.audit_first_desc')}</p>
					</article>
					<article className="landing-page__workflow-step">
						<h3>{t('landing.access_control')}</h3>
						<p>{t('landing.access_control_desc')}</p>
					</article>
					<article className="landing-page__workflow-step">
						<h3>{t('landing.data_subject')}</h3>
						<p>{t('landing.data_subject_desc')}</p>
					</article>
				</div>
			</section>

			<section className="landing-page__insights" aria-labelledby="audience-title">
				<div className="landing-page__workflow-head">
					<p className="landing-page__eyebrow">{t('landing.who_should_use')}</p>
					<h2 id="audience-title">{t('landing.use_cases')}</h2>
				</div>
				<div className="landing-page__insight-grid">
					<article className="landing-page__insight-card">
						<p>{t('landing.smb_public')}</p>
						<h3>{t('landing.smb_public_desc')}</h3>
					</article>
					<article className="landing-page__insight-card">
						<p>{t('landing.soc_teams')}</p>
						<h3>{t('landing.soc_teams_desc')}</h3>
					</article>
					<article className="landing-page__insight-card">
						<p>{t('landing.compliance_teams')}</p>
						<h3>{t('landing.compliance_teams_desc')}</h3>
					</article>
				</div>
			</section>

			<section className="landing-page__conversion" aria-labelledby="faq-title">
				<h2 id="faq-title">{t('landing.faq')}</h2>
				<p><strong>{t('landing.faq_card_1_q')}</strong> {t('landing.faq_card_1_a')}</p>
				<p><strong>{t('landing.faq_card_2_q')}</strong> {t('landing.faq_card_2_a')}</p>
				<div className="landing-page__actions">
					<Link to="/subscription" className="landing-page__primary-action">{t('landing.start_trial')}</Link>
					<Link to="/support" className="landing-page__secondary-action">{t('landing.contact_sales')}</Link>
				</div>
			</section>

			{/* Footer navigation moved into global Footer component */}

			{showTrialModal && (
				<TrialModal
					onConfirm={() => { setShowTrialModal(false); window.location.href = '/subscription'; }}
					onCancel={() => setShowTrialModal(false)}
				/>
			)}
			{showPlanSelector && (
				<PlanSelector onClose={() => setShowPlanSelector(false)} />
			)}
		</div>
	);
};

export default Landing;
