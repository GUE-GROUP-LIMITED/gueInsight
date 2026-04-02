import { Link } from 'react-router-dom';
import './ErrorPages.css';

const ServerError = () => (
  <main className="error-page">
    <section className="error-page__card error-page__card--critical">
      <p className="error-page__eyebrow">500</p>
      <h1>Internal server error</h1>
      <p>
        Something went wrong on the server. The frontend is still available, so you can return to the app and try
        again once the service is healthy.
      </p>
      <div className="error-page__actions">
        <Link to="/" className="error-page__primary-action">Go home</Link>
        <Link to="/dashboard" className="error-page__secondary-action">Open dashboard</Link>
      </div>
    </section>
  </main>
);

export default ServerError;