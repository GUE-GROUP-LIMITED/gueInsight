import { Link } from 'react-router-dom';
import './ErrorPages.css';

const NotFound = () => (
	<main className="error-page">
		<section className="error-page__card">
			<p className="error-page__eyebrow">404</p>
			<h1>Page not found</h1>
			<p>
				The page you asked for does not exist, or it has moved. Use the link below to return to the React app.
			</p>
			<div className="error-page__actions">
				<Link to="/" className="error-page__primary-action">Go home</Link>
				<Link to="/dashboard" className="error-page__secondary-action">Open dashboard</Link>
			</div>
		</section>
	</main>
);

export default NotFound;
