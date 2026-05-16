import React from 'react';
import './TrialModal.css';

const TrialModal = ({ onConfirm, onCancel }) => {
  return (
    <div className="trial-modal__backdrop" role="dialog" aria-modal="true">
      <div className="trial-modal">
        <h2>Start 14‑day free trial</h2>
        <p>
          To start your 14‑day trial you must select a paid plan and provide a payment method. We validate
          your payment method at sign-up; you will not be charged until the trial ends unless you keep the subscription.
        </p>
        <ul>
          <li>Payment method is required to prevent trial abuse.</li>
          <li>The trial will auto-convert to the selected plan and be billed after 14 days unless cancelled.</li>
          <li>You can cancel any time before the trial expires to avoid charges.</li>
        </ul>
        <div className="trial-modal__actions">
          <button className="trial-modal__confirm" onClick={onConfirm}>Continue to sign-up</button>
          <button className="trial-modal__cancel" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default TrialModal;
