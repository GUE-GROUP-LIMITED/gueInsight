import React, { useState, useEffect } from 'react';
import './BrandingSettings.css';
import { api } from '../services/api';

export default function BrandingSettings() {
  const [branding, setBranding] = useState({
    company_name: '',
    company_address: '',
    company_contact: '',
    company_logo_url: '',
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [hasPaidSubscription, setHasPaidSubscription] = useState(false);
  const [upgradeRequired, setUpgradeRequired] = useState(false);

  useEffect(() => {
    fetchBranding();
  }, []);

  const fetchBranding = async () => {
    try {
      setLoading(true);
      const response = await api.get('/auth/company-branding');
      if (response.data?.branding) {
        setBranding(response.data.branding);
        if (response.data.branding.company_logo_url) {
          setLogoPreview(response.data.branding.company_logo_url);
        }
      }
      if (response.data?.has_paid_subscription !== undefined) {
        setHasPaidSubscription(response.data.has_paid_subscription);
      }
      if (response.data?.upgrade_required !== undefined) {
        setUpgradeRequired(response.data.upgrade_required);
      }
    } catch (err) {
      console.error('Failed to fetch branding:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setLogoPreview(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadLogo = async () => {
    if (!logoFile) {
      setError('No logo selected');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const formData = new FormData();
      formData.append('logo', logoFile);
      
      const response = await api.post('/auth/company-branding/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      if (response.data?.logo_url) {
        setBranding(prev => ({
          ...prev,
          company_logo_url: response.data.logo_url,
        }));
        setMessage('Logo uploaded successfully!');
        setLogoFile(null);
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to upload logo');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setBranding(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const saveBranding = async () => {
    try {
      setSaving(true);
      setError(null);
      
      await api.patch('/auth/company-branding', {
        company_name: branding.company_name,
        company_address: branding.company_address,
        company_contact: branding.company_contact,
      });
      
      setMessage('Company branding updated successfully!');
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to save branding');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="branding-settings">
        <div className="loading-spinner">Loading branding settings...</div>
      </div>
    );
  }

  return (
    <article className="profile-page__card" style={{ marginBottom: '30px' }}>
      <h2 style={{ background: 'linear-gradient(135deg, #a78bfa 0%, #60a5fa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', fontSize: '1.5rem', fontWeight: '700', margin: '0 0 10px 0' }}>🎨 Company Branding</h2>
      <p className="subtitle" style={{ color: '#9ca3af', fontSize: '0.95rem', margin: '0 0 20px 0' }}>Upload your company logo and customize details. These will automatically appear on all your analysis reports.</p>

        {message && <div className="alert alert-success">{message}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        {upgradeRequired && (
          <div className="upgrade-banner">
            <div className="upgrade-content">
              <h3>🔓 Premium Feature</h3>
              <p>Company branding customization is available for paid subscribers only.</p>
              <p>Upgrade to Compliance Pro or Enterprise Risk to:</p>
              <ul>
                <li>Upload your company logo</li>
                <li>Customize company details on reports</li>
                <li>Create professional branded analysis exports</li>
              </ul>
            </div>
            <a href="/subscription" className="btn btn-upgrade">
              Upgrade to Paid Plan
            </a>
          </div>
        )}

        {!upgradeRequired && (
          <>
            <div className="branding-section">
              <h2>Company Logo</h2>
              <div className="logo-section">
                <div className="logo-preview">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Company Logo Preview" className="logo-image" />
                  ) : (
                    <div className="logo-placeholder">
                      <span>📁 No logo uploaded</span>
                    </div>
                  )}
                </div>

                <div className="logo-upload">
                  <div className="file-input-wrapper">
                    <input
                      type="file"
                      id="logo-input"
                      accept=".png,.jpg,.jpeg,.gif,.svg,.webp"
                      onChange={handleLogoChange}
                      disabled={saving}
                      className="file-input"
                    />
                    <label htmlFor="logo-input" className="file-label">
                      Choose Logo File
                    </label>
                  </div>
                  <p className="help-text">
                    Supported: PNG, JPG, JPEG, GIF, SVG, WebP (max 5MB)
                  </p>
                  {logoFile && (
                    <button
                      onClick={uploadLogo}
                      disabled={saving}
                      className="btn btn-primary"
                    >
                      {saving ? 'Uploading...' : 'Upload Logo'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="branding-section">
              <h2>Company Details</h2>

              <div className="form-group">
                <label htmlFor="company_name">Company Name</label>
                <input
                  type="text"
                  id="company_name"
                  name="company_name"
                  value={branding.company_name || ''}
                  onChange={handleInputChange}
                  placeholder="Your Company Name Ltd"
                  maxLength={255}
                  disabled={saving}
                />
              </div>

              <div className="form-group">
                <label htmlFor="company_address">Company Address</label>
                <input
                  type="text"
                  id="company_address"
                  name="company_address"
                  value={branding.company_address || ''}
                  onChange={handleInputChange}
                  placeholder="Street Address, City, Country"
                  maxLength={500}
                  disabled={saving}
                />
              </div>

              <div className="form-group">
                <label htmlFor="company_contact">Contact Email / Phone</label>
                <input
                  type="text"
                  id="company_contact"
                  name="company_contact"
                  value={branding.company_contact || ''}
                  onChange={handleInputChange}
                  placeholder="security@yourcompany.com or +1-XXX-XXX-XXXX"
                  maxLength={255}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="branding-preview">
              <h2>Preview - How Reports Will Look</h2>
              <div className="report-preview">
                <div className="preview-header">
                  <div className="preview-logo">
                    {logoPreview && <img src={logoPreview} alt="Logo" className="preview-logo-img" />}
                  </div>
                  <div className="preview-text">
                    <h3>Security Analysis Report</h3>
                    <p>Generated through GueInsight platform for: <strong>{branding.company_name || 'Your Company'}</strong></p>
                  </div>
                </div>
                <div className="preview-footer">
                  <p>Platform: GueInsight | Company: {branding.company_name || 'Your Company'}</p>
                  <p>Contact: {branding.company_contact || 'contact@company.com'}</p>
                  {branding.company_address && <p>Address: {branding.company_address}</p>}
                </div>
              </div>
            </div>

            <div className="action-buttons">
              <button
                onClick={saveBranding}
                disabled={saving}
                className="btn btn-success"
              >
                {saving ? 'Saving...' : '💾 Save All Changes'}
              </button>
              <button
                onClick={() => fetchBranding()}
                disabled={saving}
                className="btn btn-secondary"
              >
                ↻ Reset
              </button>
            </div>

            <div className="info-box">
              <h3>ℹ️ About Company Branding</h3>
              <ul>
                <li>Your company logo and details will appear on all exported reports (PDF, JSON, CSV)</li>
                <li>All analysis reports will show who analyzed the indicator and when</li>
                <li>Custom branding helps identify reports generated through your GueInsight platform</li>
                <li>Make these settings visible to your team so they understand the branding in reports</li>
              </ul>
            </div>
          </>
        )}
    </article>
  );
}
