"""
Company branding and logo management endpoints.
"""
import os
import json
from datetime import datetime, timezone
from flask import Blueprint, request, current_app, jsonify
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
from werkzeug.exceptions import RequestEntityTooLarge
from app.models import UserPreference, Subscription, db


def _get_upload_folder():
    """Get the company logos upload directory."""
    upload_folder = os.path.join(current_app.instance_path, 'company_logos')
    os.makedirs(upload_folder, exist_ok=True)
    return upload_folder


def _allowed_file(filename):
    """Check if file extension is allowed for logo upload."""
    allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions


def _user_has_paid_subscription():
    """Check if current user has an active paid subscription."""
    if not current_user:
        return False
    
    # Get active subscription
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    subscription = Subscription.query.filter(
        Subscription.user_id == current_user.id,
        Subscription.end_date > now,
        Subscription.plan.notin_(['starter', 'free', 'freemium'])
    ).first()
    
    return subscription is not None


def register_company_branding_routes(bp):
    """Register company branding management routes."""

    @bp.route('/auth/company-branding', methods=['GET'])
    @login_required
    def get_company_branding():
        """Get current user's company branding settings."""
        has_paid = _user_has_paid_subscription()
        pref = UserPreference.query.filter_by(user_id=current_user.id).first()
        
        if not pref:
            return {
                'branding': {},
                'has_paid_subscription': has_paid,
                'upgrade_required': not has_paid
            }, 200

        return {
            'branding': {
                'company_name': pref.company_name or '',
                'company_logo_url': pref.company_logo_url or '',
                'company_address': pref.company_address or '',
                'company_contact': pref.company_contact or '',
            },
            'has_paid_subscription': has_paid,
            'upgrade_required': not has_paid
        }, 200

    @bp.route('/auth/company-branding/logo', methods=['POST'])
    @login_required
    def upload_company_logo():
        """Upload a company logo image (paid subscribers only)."""
        if not _user_has_paid_subscription():
            return {
                'error': 'Company branding customization is available for paid subscribers only',
                'upgrade_url': '/subscription'
            }, 403
        
        if 'logo' not in request.files:
            return {'error': 'No logo file provided'}, 400

        logo_file = request.files['logo']
        if logo_file.filename == '':
            return {'error': 'No file selected'}, 400

        if not _allowed_file(logo_file.filename):
            return {'error': 'Invalid file type. Allowed: PNG, JPG, JPEG, GIF, SVG, WebP'}, 400

        # Validate file size (max 5MB)
        logo_file.seek(0, os.SEEK_END)
        file_size = logo_file.tell()
        logo_file.seek(0)
        if file_size > 5 * 1024 * 1024:  # 5MB limit
            return {'error': 'Logo file too large (max 5MB)'}, 413

        try:
            # Save file with user ID in filename
            filename = f"user_{current_user.id}_{secure_filename(logo_file.filename)}"
            upload_folder = _get_upload_folder()
            filepath = os.path.join(upload_folder, filename)
            logo_file.save(filepath)

            # Update user preference with logo URL
            pref = UserPreference.query.filter_by(user_id=current_user.id).first()
            if not pref:
                pref = UserPreference(user_id=current_user.id)
                db.session.add(pref)

            logo_url = f'/api/company-logos/{filename}'
            pref.company_logo_url = logo_url
            db.session.commit()

            return {
                'status': 'success',
                'message': 'Logo uploaded successfully',
                'logo_url': logo_url,
            }, 200

        except Exception as e:
            current_app.logger.error(f'Logo upload error for user {current_user.id}: {e}')
            return {'error': 'Failed to upload logo'}, 500

    @bp.route('/auth/company-branding', methods=['PATCH'])
    @login_required
    def update_company_branding():
        """Update company branding details (paid subscribers only)."""
        if not _user_has_paid_subscription():
            return {
                'error': 'Company branding customization is available for paid subscribers only',
                'upgrade_url': '/subscription'
            }, 403
        
        payload = request.get_json(silent=True) or {}

        pref = UserPreference.query.filter_by(user_id=current_user.id).first()
        if not pref:
            pref = UserPreference(user_id=current_user.id)
            db.session.add(pref)

        allowed_fields = {
            'company_name',
            'company_address',
            'company_contact',
        }

        for field_name in allowed_fields:
            if field_name in payload:
                value = payload.get(field_name)
                if isinstance(value, str):
                    setattr(pref, field_name, value.strip())
                else:
                    setattr(pref, field_name, value)

        db.session.commit()

        return {
            'status': 'success',
            'message': 'Company branding updated',
            'branding': {
                'company_name': pref.company_name or '',
                'company_logo_url': pref.company_logo_url or '',
                'company_address': pref.company_address or '',
                'company_contact': pref.company_contact or '',
            }
        }, 200

    @bp.route('/api/company-logos/<filename>', methods=['GET'])
    def get_company_logo(filename):
        """Serve uploaded company logo files."""
        try:
            upload_folder = _get_upload_folder()
            filepath = os.path.join(upload_folder, secure_filename(filename))
            
            if not os.path.exists(filepath):
                return {'error': 'Logo not found'}, 404

            # Determine MIME type
            mime_types = {
                'png': 'image/png',
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'gif': 'image/gif',
                'svg': 'image/svg+xml',
                'webp': 'image/webp',
            }
            ext = filename.rsplit('.', 1)[1].lower()
            mime_type = mime_types.get(ext, 'image/png')

            with open(filepath, 'rb') as f:
                image_data = f.read()

            return current_app.response_class(
                image_data,
                mimetype=mime_type,
                headers={'Content-Disposition': f'inline; filename={filename}'}
            )
        except Exception as e:
            current_app.logger.error(f'Logo retrieval error: {e}')
            return {'error': 'Failed to retrieve logo'}, 500
