import React from 'react';
import './ComplianceTierMatrix.css';

/**
 * Compliance Tier Matrix Component
 * Displays pricing tiers with feature comparison for GDPR/NIS2/M365/GWS
 * Integrates with Stripe for subscription upgrades
 */

const ComplianceTierMatrix = ({ currentTier, onUpgrade }) => {
  const tiers = [
    {
      id: 'starter',
      name: 'Starter',
      price: '€0',
      priceDisplay: 'Free',
      description: 'Basic threat detection for individuals',
      features: [
        { name: 'Manual file/text analysis', included: true },
        { name: 'Max file size', value: '2 MB', included: true },
        { name: 'Max text chars', value: '10k', included: true },
        { name: 'Basic threat scoring', included: true },
        { name: 'Email alerts', included: true },
      ],
      compliance: {
        gdpr: false,
        nis2: false,
        m365: false,
        gws: false,
        euOnly: false,
      },
      cta: 'Current Plan',
      ctaDisabled: currentTier === 'starter',
    },
    {
      id: 'compliance_pro',
      name: 'Compliance Pro',
      price: '€29.90',
      priceDisplay: '/month',
      description: 'GDPR-focused threat detection with audit trails',
      features: [
        { name: 'All Starter features', included: true },
        { name: 'GDPR data export/deletion', included: true },
        { name: 'Audit logging (90 days)', included: true },
        { name: 'Email + Slack alerts', included: true },
        { name: 'Max file size', value: '8 MB', included: true },
        { name: 'Max text chars', value: '50k', included: true },
        { name: 'M365 basic integration', included: true },
        { name: 'Threat history (30 days)', included: true },
      ],
      compliance: {
        gdpr: true,
        nis2: false,
        m365: true,
        gws: false,
        euOnly: false,
      },
      cta: 'Upgrade',
      highlighted: false,
    },
    {
      id: 'enterprise_risk',
      name: 'Enterprise Risk',
      price: '€499',
      priceDisplay: '/month',
      description: 'NIS2 + ISO27001 critical infrastructure risk management',
      features: [
        { name: 'All Compliance Pro features', included: true },
        { name: 'NIS2 incident reporting', included: true },
        { name: 'M365 + Google Workspace connectors', included: true },
        { name: 'Advanced DLP policy assessment', included: true },
        { name: 'Privilege escalation detection', included: true },
        { name: 'Device compliance monitoring', included: true },
        { name: 'Audit logging (1 year)', included: true },
        { name: 'Max file size', value: '16 MB', included: true },
        { name: 'Custom alert rules', included: true },
      ],
      compliance: {
        gdpr: true,
        nis2: true,
        m365: true,
        gws: true,
        euOnly: false,
      },
      cta: 'Upgrade',
      highlighted: true,
    },
    {
      id: 'enterprise_elite',
      name: 'Enterprise Elite',
      price: '€999',
      priceDisplay: '/month',
      description: 'White-glove SOC2/ISO27001 compliance + EU-only data residency',
      features: [
        { name: 'All Enterprise Risk features', included: true },
        { name: 'EU-only data residency enforcement', included: true },
        { name: 'SOC2 Type II readiness assessment', included: true },
        { name: 'Custom compliance dashboards', included: true },
        { name: 'Dedicated compliance officer support', included: true },
        { name: 'Incident response playbooks', included: true },
        { name: 'Unlimited file/text analysis', included: true },
        { name: 'Real-time security alerting', included: true },
        { name: 'Compliance training materials', included: true },
      ],
      compliance: {
        gdpr: true,
        nis2: true,
        m365: true,
        gws: true,
        euOnly: true,
      },
      cta: 'Upgrade',
      highlighted: false,
    },
  ];

  const handleUpgrade = (tierId) => {
    if (onUpgrade) {
      onUpgrade(tierId);
    }
  };

  return (
    <div className="compliance-tier-matrix">
      <div className="tier-header">
        <h2>Compliance Tiers</h2>
        <p className="tier-subtitle">Choose the right tier for your compliance needs</p>
      </div>

      <div className="tier-container">
        {tiers.map((tier) => (
          <div
            key={tier.id}
            className={`tier-card ${tier.highlighted ? 'highlighted' : ''} ${
              currentTier === tier.id ? 'active' : ''
            }`}
          >
            {tier.highlighted && <div className="recommended-badge">Recommended</div>}

            <div className="tier-info">
              <h3>{tier.name}</h3>
              <p className="tier-description">{tier.description}</p>

              <div className="tier-price">
                <span className="price-amount">{tier.price}</span>
                <span className="price-period">{tier.priceDisplay}</span>
              </div>

              <div className="compliance-badges">
                {tier.compliance.gdpr && (
                  <span className="badge gdpr-badge" title="GDPR Article 5 compliant">
                    GDPR ✓
                  </span>
                )}
                {tier.compliance.nis2 && (
                  <span className="badge nis2-badge" title="NIS2 Directive ready">
                    NIS2 ✓
                  </span>
                )}
                {tier.compliance.m365 && (
                  <span className="badge m365-badge" title="Microsoft 365 integration">
                    M365
                  </span>
                )}
                {tier.compliance.gws && (
                  <span className="badge gws-badge" title="Google Workspace integration">
                    GWS
                  </span>
                )}
                {tier.compliance.euOnly && (
                  <span className="badge eu-badge" title="EU-only data residency">
                    EU-Only
                  </span>
                )}
              </div>
            </div>

            <div className="tier-features">
              <ul>
                {tier.features.map((feature, idx) => (
                  <li key={idx} className={feature.included ? 'included' : 'excluded'}>
                    <span className="check">✓</span>
                    <span className="feature-name">{feature.name}</span>
                    {feature.value && <span className="feature-value">{feature.value}</span>}
                  </li>
                ))}
              </ul>
            </div>

            <button
              className={`tier-cta ${tier.ctaDisabled ? 'disabled' : ''}`}
              onClick={() => handleUpgrade(tier.id)}
              disabled={tier.ctaDisabled}
            >
              {tier.cta}
            </button>
          </div>
        ))}
      </div>

      <div className="tier-comparison-table">
        <h3>Feature Comparison</h3>
        <table>
          <thead>
            <tr>
              <th>Feature</th>
              <th>Starter</th>
              <th>Compliance Pro</th>
              <th>Enterprise Risk</th>
              <th>Enterprise Elite</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Max File Size</strong></td>
              <td>2 MB</td>
              <td>8 MB</td>
              <td>16 MB</td>
              <td>Unlimited</td>
            </tr>
            <tr>
              <td><strong>Max Text Characters</strong></td>
              <td>10k</td>
              <td>50k</td>
              <td>150k</td>
              <td>5M</td>
            </tr>
            <tr>
              <td><strong>GDPR Export/Delete</strong></td>
              <td>✗</td>
              <td>✓</td>
              <td>✓</td>
              <td>✓</td>
            </tr>
            <tr>
              <td><strong>Audit Logging</strong></td>
              <td>✗</td>
              <td>90 days</td>
              <td>1 year</td>
              <td>Unlimited</td>
            </tr>
            <tr>
              <td><strong>M365 Integration</strong></td>
              <td>✗</td>
              <td>Basic</td>
              <td>Full</td>
              <td>Full</td>
            </tr>
            <tr>
              <td><strong>Google Workspace</strong></td>
              <td>✗</td>
              <td>✗</td>
              <td>✓</td>
              <td>✓</td>
            </tr>
            <tr>
              <td><strong>NIS2 Incident Reporting</strong></td>
              <td>✗</td>
              <td>✗</td>
              <td>✓</td>
              <td>✓</td>
            </tr>
            <tr>
              <td><strong>EU-Only Data Residency</strong></td>
              <td>✗</td>
              <td>✗</td>
              <td>✗</td>
              <td>✓</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ComplianceTierMatrix;
