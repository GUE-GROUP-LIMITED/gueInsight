"""
User analysis and dashboard routes for file upload, text analysis, and URL inspection.
Extracted from users_routes.py to reduce monolith complexity.
"""
import json
import logging
from flask import Blueprint, render_template, request, redirect, url_for, flash, current_app, jsonify
from flask_login import login_required, current_user
import datetime
from app.models import (
    Subscription,
    AnalysisTransaction,
    AnalysisStatus,
    UserActivityEvent,
    db,
)
from app.forms import UploadFileForm, SubmitCloudLinkForm, SubmitTextForm, LogoutForm
from werkzeug.exceptions import RequestEntityTooLarge
from werkzeug.utils import secure_filename
from app.config import Config
from app.utils.utils import OutputHandler, generate_report

# Import helper functions and constants from parent module
from app.routes import users_routes as ur


def register_analysis_routes(users_bp):
    """Register dashboard and analysis endpoints to user blueprint."""
    
    @users_bp.route('/user_dashboard', methods=['GET', 'POST'])
    @login_required
    def user_dashboard():
        
        # Initialize the forms
        file_upload_form = UploadFileForm()
        url_submission_form = SubmitCloudLinkForm()
        text_submission_form = SubmitTextForm()
       
        # Get the user's subscription
        subscription = Subscription.query.filter_by(user_id=current_user.id).first()
        logout_form = LogoutForm()

        # Determine subscription status
        subscription_status = 'Freemium'  # Default status

        if subscription:
            if getattr(subscription, 'is_trial', False):
                subscription_status = 'Trial'
            elif getattr(subscription, 'is_active', False):
                subscription_status = 'Premium'

        # Render the dashboard template with the necessary data
        return render_template(
            'users/userbase.html',
            upload_form=file_upload_form,
            cloud_form=url_submission_form,
            text_form=text_submission_form,
            subscription_status=subscription_status,
            logout_form=logout_form
        )


    @users_bp.route('/upload', methods=['POST'])
    @login_required
    def upload_file():
        # Get the form data already passed from the dashboard
        file_upload_form = UploadFileForm()
        url_submission_form = SubmitCloudLinkForm()
        text_submission_form = SubmitTextForm()

        # Initialize the SubscriptionService to get subscription details
        from app.subscription_service import SubscriptionService
        subscription_service = SubscriptionService(current_user.id)
        subscription_status = subscription_service.get_subscription_status(current_user)
        subscription = subscription_service.subscription
        plan_key = ur._get_active_plan_key(current_user.id)
        analysis_limits = ur._get_analysis_limits_for_plan(plan_key)

        # Check the subscription status and upload limits
        if subscription_status == "Inactive" or subscription_status == "Expired":
            flash("Your subscription is inactive or expired. Please renew your subscription.", "danger")
            return redirect(url_for('users.user_dashboard'))

        if subscription_status == "Freemium":
            upload_limit = 1  # Freemium users can upload only once per month
        elif subscription_status == "Premium":
            # Determine upload limit based on the user's subscription plan
            if subscription.plan == 'premium_individual':
                upload_limit = 4
            elif subscription.plan == 'premium_small_business':
                upload_limit = 6
            elif subscription.plan == 'premium_large_business':
                upload_limit = 10
            else:
                upload_limit = 4
        else:
            flash("Invalid subscription status.", "danger")
            return redirect(url_for('users.user_dashboard'))

        # Count the user's uploads in the current month
        current_month = datetime.datetime.now().month
        upload_count = OutputHandler.count_uploads_in_month(current_user.id, current_month)

        # Check if the user has exceeded the allowed number of uploads
        if upload_count >= upload_limit:
            flash(f"You've exceeded your upload limit of {upload_limit} uploads for this month.", "danger")
            return redirect(url_for('users.user_dashboard'))

        # Handle File Upload
        if file_upload_form.validate_on_submit() and file_upload_form.file.data:
            uploaded_file = file_upload_form.file.data
            file_analysis_started_at = ur._utc_now()

            # Check the file type
            allowed_extensions = Config.ALLOWED_EXTENSIONS  # Get allowed file types from config
            file_extension = secure_filename(uploaded_file.filename).split('.')[-1].lower()

            if file_extension not in allowed_extensions:
                file_tx = AnalysisTransaction(
                    user_id=current_user.id,
                    source_type='file',
                    input_ref=uploaded_file.filename,
                    status=AnalysisStatus.FAILED,
                    plan_at_time=plan_key,
                    items_count=1,
                    error_message='Invalid file type.',
                    created_at=file_analysis_started_at,
                    completed_at=ur._utc_now(),
                )
                db.session.add(file_tx)
                db.session.commit()
                flash("Invalid file type. Please upload a valid file.", "danger")
                return redirect(url_for('users.user_dashboard'))

            # Check if the file size is within both global and plan-specific limits.
            file_size_bytes = len(uploaded_file.read())
            max_plan_file_size_bytes = analysis_limits['max_file_size_mb'] * 1024 * 1024
            max_allowed_bytes = min(Config.MAX_CONTENT_LENGTH, max_plan_file_size_bytes)
            if file_size_bytes > max_allowed_bytes:
                file_tx = AnalysisTransaction(
                    user_id=current_user.id,
                    source_type='file',
                    input_ref=uploaded_file.filename,
                    status=AnalysisStatus.BLOCKED_BY_PLAN,
                    plan_at_time=plan_key,
                    items_count=1,
                    input_size_bytes=file_size_bytes,
                    error_message='File exceeds plan limit.',
                    created_at=file_analysis_started_at,
                    completed_at=ur._utc_now(),
                )
                db.session.add(file_tx)
                db.session.commit()
                flash(
                    f"File exceeds your plan limit of {analysis_limits['max_file_size_mb']}MB per analysis.",
                    "danger",
                )
                return redirect(url_for('users.user_dashboard'))

            # Reset the file pointer after checking the size
            uploaded_file.seek(0)


            try:
                # Process the file
                from app.src.ingestion.file_ingestion import FileIngestion
                file_ingestion = FileIngestion(uploaded_file)
                file_path, file_hash = file_ingestion.save_and_ingest()

                # Preprocess the file
                from app.src.preprocessing.preprocess import Preprocessor
                preprocessor = Preprocessor(file_path)
                processed_data = preprocessor.process()

                # Analyze the file
                from app.src.analysis.file_analysis import Analyzer
                analyzer = Analyzer(processed_data)
                analysis_results = analyzer.analyze()

                # Generate visualization (if any)
                from app.src.visualization.visualization import Visualization
                visualization = Visualization(analysis_results)
                visualization_result = visualization.generate()

                report_generator = generate_report()
                report_file = report_generator.generate_report(analysis_results, visualization_result)

                # Save the report to the user's dashboard
               
                OutputHandler.save_to_user_dashboard(current_user.id, report_file, file_path)

                completed_at = ur._utc_now()
                file_tx = AnalysisTransaction(
                    user_id=current_user.id,
                    source_type='file',
                    input_ref=file_path,
                    status=AnalysisStatus.SUCCESS,
                    plan_at_time=plan_key,
                    items_count=1,
                    input_size_bytes=file_size_bytes,
                    processing_ms=max(1, int((completed_at - file_analysis_started_at).total_seconds() * 1000)),
                    result_summary='File analysis completed successfully.',
                    created_at=file_analysis_started_at,
                    completed_at=completed_at,
                )
                db.session.add(file_tx)
                ur._log_user_activity(
                    current_user.id,
                    event_type='analysis.file.success',
                    description='Completed a file analysis.',
                    entity_type='analysis_transaction',
                    metadata={'source_type': 'file', 'status': 'success'},
                )
                db.session.commit()

                # Render the results page
                return render_template('results.html', 
                                       results=analysis_results, 
                                       visualization=visualization_result,
                                       report_link='/Users/gabrielaloho/gueInsight/app/user_reports')  # Replace with actual path
            except Exception as e:
                file_tx = AnalysisTransaction(
                    user_id=current_user.id,
                    source_type='file',
                    input_ref=uploaded_file.filename,
                    status=AnalysisStatus.FAILED,
                    plan_at_time=plan_key,
                    items_count=1,
                    input_size_bytes=file_size_bytes,
                    error_message=str(e),
                    created_at=file_analysis_started_at,
                    completed_at=ur._utc_now(),
                )
                db.session.add(file_tx)
                db.session.commit()
                flash(f"Error processing file: {str(e)}", "danger")
                return redirect(url_for('users.user_dashboard'))


        # Handle URL Submission

        elif url_submission_form.validate_on_submit() and url_submission_form.cloud_link.data:
            cloud_link = url_submission_form.cloud_link.data
            url_analysis_started_at = ur._utc_now()
            if len(cloud_link) > analysis_limits['max_url_length']:
                url_tx = AnalysisTransaction(
                    user_id=current_user.id,
                    source_type='url',
                    input_ref=cloud_link[:500],
                    status=AnalysisStatus.BLOCKED_BY_PLAN,
                    plan_at_time=plan_key,
                    items_count=1,
                    input_size_bytes=len(cloud_link.encode('utf-8')),
                    error_message='URL exceeds plan input length limit.',
                    created_at=url_analysis_started_at,
                    completed_at=ur._utc_now(),
                )
                db.session.add(url_tx)
                db.session.commit()
                return jsonify({
                    'status': 'error',
                    'message': (
                        f"URL input exceeds your plan limit of {analysis_limits['max_url_length']} characters per analysis."
                    )
                }), 400
            try:
                # Threat intelligence enrichment
                from app.integrations.rapidapi import enrich_url
                enrichment = enrich_url(cloud_link)
                # Process the cloud link (analysis)
                from app.src.analysis.file_analysis import analyze_cloud_link
                analysis_results = analyze_cloud_link(cloud_link)

                completed_at = ur._utc_now()
                url_tx = AnalysisTransaction(
                    user_id=current_user.id,
                    source_type='url',
                    input_ref=cloud_link[:500],
                    status=AnalysisStatus.SUCCESS,
                    plan_at_time=plan_key,
                    items_count=1,
                    input_size_bytes=len(cloud_link.encode('utf-8')),
                    processing_ms=max(1, int((completed_at - url_analysis_started_at).total_seconds() * 1000)),
                    result_summary='URL analysis completed successfully.',
                    created_at=url_analysis_started_at,
                    completed_at=completed_at,
                )
                db.session.add(url_tx)
                ur._log_user_activity(
                    current_user.id,
                    event_type='analysis.url.success',
                    description='Completed a URL analysis.',
                    entity_type='analysis_transaction',
                    metadata={'source_type': 'url', 'status': 'success'},
                )
                db.session.commit()
                return jsonify({
                    'status': 'success',
                    'message': 'Cloud link processed successfully.',
                    'enrichment': enrichment,
                    'results': analysis_results
                })

            except Exception as e:
                url_tx = AnalysisTransaction(
                    user_id=current_user.id,
                    source_type='url',
                    input_ref=cloud_link[:500],
                    status=AnalysisStatus.FAILED,
                    plan_at_time=plan_key,
                    items_count=1,
                    input_size_bytes=len(cloud_link.encode('utf-8')),
                    error_message=str(e),
                    created_at=url_analysis_started_at,
                    completed_at=ur._utc_now(),
                )
                db.session.add(url_tx)
                db.session.commit()
                flash(f"Error processing cloud link: {str(e)}", "danger")
                return redirect(url_for('users.user_dashboard'))

        # Handle Text/Hash Submission

        elif text_submission_form.validate_on_submit() and text_submission_form.pasted_input.data:
            input_data = text_submission_form.pasted_input.data
            text_analysis_started_at = ur._utc_now()
            input_length = len(input_data)
            analysis_item_count = ur._count_analysis_items(input_data)

            if input_length > analysis_limits['max_text_chars']:
                text_tx = AnalysisTransaction(
                    user_id=current_user.id,
                    source_type='text',
                    input_ref=input_data[:500],
                    status=AnalysisStatus.BLOCKED_BY_PLAN,
                    plan_at_time=plan_key,
                    items_count=analysis_item_count,
                    input_size_bytes=len(input_data.encode('utf-8')),
                    error_message='Text exceeds plan input length limit.',
                    created_at=text_analysis_started_at,
                    completed_at=ur._utc_now(),
                )
                db.session.add(text_tx)
                db.session.commit()
                return jsonify({
                    'status': 'error',
                    'message': (
                        f"Text input exceeds your plan limit of {analysis_limits['max_text_chars']} characters per analysis."
                    )
                }), 400

            if analysis_item_count > analysis_limits['max_items_per_analysis']:
                text_tx = AnalysisTransaction(
                    user_id=current_user.id,
                    source_type='text',
                    input_ref=input_data[:500],
                    status=AnalysisStatus.BLOCKED_BY_PLAN,
                    plan_at_time=plan_key,
                    items_count=analysis_item_count,
                    input_size_bytes=len(input_data.encode('utf-8')),
                    error_message='Input item count exceeds plan limit.',
                    created_at=text_analysis_started_at,
                    completed_at=ur._utc_now(),
                )
                db.session.add(text_tx)
                db.session.commit()
                return jsonify({
                    'status': 'error',
                    'message': (
                        f"This request has {analysis_item_count} items, but your plan allows "
                        f"up to {analysis_limits['max_items_per_analysis']} items per analysis."
                    )
                }), 400
            try:
                # Threat intelligence enrichment (try as hash, IP, or URL)
                from app.integrations.rapidapi import enrich_event
                enrichment = enrich_event({'hash': input_data, 'ip': input_data, 'url': input_data})
                # Process the text/hash input (analysis)
                from app.src.analysis.file_analysis import analyze_text_for_security
                analysis_results = analyze_text_for_security(input_data)

                completed_at = ur._utc_now()
                text_tx = AnalysisTransaction(
                    user_id=current_user.id,
                    source_type='text',
                    input_ref=input_data[:500],
                    status=AnalysisStatus.SUCCESS,
                    plan_at_time=plan_key,
                    items_count=analysis_item_count,
                    input_size_bytes=len(input_data.encode('utf-8')),
                    processing_ms=max(1, int((completed_at - text_analysis_started_at).total_seconds() * 1000)),
                    result_summary='Text analysis completed successfully.',
                    created_at=text_analysis_started_at,
                    completed_at=completed_at,
                )
                db.session.add(text_tx)
                ur._log_user_activity(
                    current_user.id,
                    event_type='analysis.text.success',
                    description='Completed a text analysis.',
                    entity_type='analysis_transaction',
                    metadata={'source_type': 'text', 'status': 'success'},
                )
                db.session.commit()
                return jsonify({
                    'status': 'success',
                    'message': 'Text processed successfully.',
                    'enrichment': enrichment,
                    'results': analysis_results
                })

            except Exception as e:
                text_tx = AnalysisTransaction(
                    user_id=current_user.id,
                    source_type='text',
                    input_ref=input_data[:500],
                    status=AnalysisStatus.FAILED,
                    plan_at_time=plan_key,
                    items_count=analysis_item_count,
                    input_size_bytes=len(input_data.encode('utf-8')),
                    error_message=str(e),
                    created_at=text_analysis_started_at,
                    completed_at=ur._utc_now(),
                )
                db.session.add(text_tx)
                db.session.commit()
                flash(f"Error processing text input: {str(e)}", "danger")
                return redirect(url_for('users.user_dashboard'))

        # If no valid form submission, return an error message
        flash("Please submit a valid file, text, or URL.", "danger")
        return redirect(url_for('users.user_dashboard'))
