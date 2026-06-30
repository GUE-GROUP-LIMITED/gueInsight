"""
Production error handlers and security middleware.

Centralizes error handling for production-safe responses without exposing
stack traces or sensitive information to end users.
"""

import logging
from flask import jsonify, render_template, request
from werkzeug.exceptions import HTTPException

logger = logging.getLogger(__name__)


def init_production_errors(app):
    """
    Register all production-safe error handlers with the Flask app.
    Call this in create_app() to enable production error handling.
    """
    
    @app.errorhandler(400)
    def handle_bad_request(error):
        """Handle malformed requests (e.g., invalid JSON, missing required fields)."""
        logger.warning(f"Bad request: {request.path} - {error}")
        
        if request.path.startswith('/api/'):
            return jsonify({
                'error': 'Invalid request',
                'message': 'The request could not be understood by the server.'
            }), 400
        
        return render_template('errors/400.html'), 400
    
    
    @app.errorhandler(403)
    def handle_forbidden(error):
        """Handle unauthorized access attempts."""
        logger.warning(f"Forbidden access: {request.path} by user {request.remote_addr}")
        
        if request.path.startswith('/api/'):
            return jsonify({
                'error': 'Forbidden',
                'message': 'You do not have permission to access this resource.'
            }), 403
        
        return render_template('errors/403.html'), 403
    
    
    @app.errorhandler(404)
    def handle_not_found(error):
        """Handle 404 Not Found - already exists in app.py but enhanced here."""
        logger.info(f"Resource not found: {request.path}")
        
        if request.path.startswith('/api/'):
            return jsonify({
                'error': 'Not found',
                'message': 'The requested resource was not found.'
            }), 404
        
        # Serve React frontend for SPA routes
        try:
            from flask import send_from_directory
            dist_dir = _get_frontend_dist_dir()
            response = send_from_directory(dist_dir, 'index.html')
            response.status_code = 404
            response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
            return response
        except Exception as e:
            logger.error(f"Failed to serve frontend index: {e}")
            return render_template('errors/404.html'), 404
    
    
    @app.errorhandler(422)
    def handle_unprocessable_entity(error):
        """Handle validation errors."""
        logger.warning(f"Unprocessable entity: {request.path} - {error}")
        
        if request.path.startswith('/api/'):
            return jsonify({
                'error': 'Unprocessable entity',
                'message': 'The request could not be processed due to validation errors.',
                'details': str(error) if app.debug else None
            }), 422
        
        return render_template('errors/422.html'), 422


    @app.errorhandler(413)
    def handle_payload_too_large(error):
        """Handle oversize uploads with a user-friendly response."""
        logger.warning(f"Payload too large: {request.path} - {error}")

        if request.path.startswith('/api/'):
            return jsonify({
                'error': 'Payload too large',
                'message': 'The uploaded file exceeds the allowed size for your plan.'
            }), 413

        return render_template('errors/422.html'), 413
    
    
    @app.errorhandler(500)
    def handle_server_error(error):
        """
        Handle 500 Internal Server Errors.
        CRITICAL: Never expose stack traces to users in production.
        """
        logger.error(
            f"Internal server error: {request.path}",
            exc_info=True,
            extra={
                'user_id': getattr(request, 'user', {}).get('id'),
                'remote_addr': request.remote_addr,
                'path': request.path,
                'method': request.method,
            }
        )
        
        if request.path.startswith('/api/'):
            return jsonify({
                'error': 'Internal server error',
                'message': 'An unexpected error occurred. The team has been notified.',
                'request_id': _get_request_id()
            }), 500
        
        try:
            response = render_template('errors/500.html', request_id=_get_request_id())
            return response, 500
        except Exception as template_error:
            logger.error(f"Failed to render 500 template: {template_error}")
            return jsonify({
                'error': 'Internal server error',
                'message': 'An unexpected error occurred.',
                'request_id': _get_request_id()
            }), 500
    
    
    @app.errorhandler(503)
    def handle_service_unavailable(error):
        """Handle service unavailable (e.g., database down, maintenance mode)."""
        logger.error(f"Service unavailable: {error}")
        
        if request.path.startswith('/api/'):
            return jsonify({
                'error': 'Service unavailable',
                'message': 'The service is temporarily unavailable. Please try again later.'
            }), 503
        
        return render_template('errors/503.html'), 503
    
    
    @app.errorhandler(Exception)
    def handle_generic_exception(error):
        """
        Catch-all handler for any unhandled exceptions.
        CRITICAL: Log the full exception but never expose details to users.
        """
        logger.error(
            f"Unhandled exception: {type(error).__name__}",
            exc_info=True,
            extra={'path': request.path}
        )
        
        # Check if it's a known HTTPException that should be handled
        if isinstance(error, HTTPException):
            return error
        
        if request.path.startswith('/api/'):
            return jsonify({
                'error': 'Internal server error',
                'message': 'An unexpected error occurred. The team has been notified.',
                'request_id': _get_request_id()
            }), 500
        
        return render_template('errors/500.html'), 500


def _get_frontend_dist_dir():
    """Get path to React frontend distribution."""
    import os
    return os.path.abspath(os.path.join(
        os.path.dirname(__file__), '..', 'frontend', 'dist'
    ))


def _get_request_id():
    """Get or generate request ID for tracking."""
    from flask import g
    if hasattr(g, 'request_id'):
        return g.request_id
    
    import uuid
    request_id = str(uuid.uuid4())
    g.request_id = request_id
    return request_id


def validate_production_config(app):
    """
    Validate production configuration at startup.
    Raises ValueError if critical config is missing or invalid.
    """
    errors = []
    app_env = str(app.config.get('APP_ENV') or app.config.get('ENV') or '').strip().lower()
    is_production = app_env in {'production', 'prod'}
    
    # Check SECRET_KEY
    if not app.config.get('SECRET_KEY'):
        errors.append('SECRET_KEY environment variable is required')
    
    # Check SECURITY_PASSWORD_SALT
    if not app.config.get('SECURITY_PASSWORD_SALT'):
        errors.append('SECURITY_PASSWORD_SALT environment variable is required')
    
    # Check database URI for production (should not be SQLite)
    db_uri = app.config.get('SQLALCHEMY_DATABASE_URI', '')
    if is_production:
        if 'sqlite' in db_uri.lower():
            errors.append('SQLite database is not suitable for production. Use PostgreSQL.')

        if db_uri.startswith('postgres://'):
            errors.append('Use postgres+psycopg2 or postgresql:// for production database URIs.')

        # Ensure secure cookies in production.
        if not app.config.get('SESSION_COOKIE_SECURE', False):
            app.logger.warning('SESSION_COOKIE_SECURE is not enabled. Enabling for production.')
            app.config['SESSION_COOKIE_SECURE'] = True
        if not app.config.get('REMEMBER_COOKIE_SECURE', False):
            app.logger.warning('REMEMBER_COOKIE_SECURE is not enabled. Enabling for production.')
            app.config['REMEMBER_COOKIE_SECURE'] = True

        if app.config.get('SECRET_KEY') in {'dev-secret-key', 'change-me', 'secret', 'test-secret-key'}:
            errors.append('SECRET_KEY must be a strong, unique production secret.')

        if app.config.get('SECURITY_PASSWORD_SALT') in {'dev-security-salt', 'change-me', 'salt', 'test-salt'}:
            errors.append('SECURITY_PASSWORD_SALT must be a strong, unique production secret.')
    
    if errors:
        error_msg = '\n'.join([f'  - {e}' for e in errors])
        raise ValueError(f'Production configuration errors:\n{error_msg}')
    
    app.logger.info('Production configuration validated successfully')
