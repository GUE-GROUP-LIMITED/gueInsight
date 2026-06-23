from datetime import timedelta

from flask import request, current_app, Response
from flask_login import current_user, login_required


def register_billing_routes(users_bp):
    from app.routes import users_routes as ur

    @users_bp.route('/auth/notifications', methods=['GET'])
    @login_required
    def auth_notifications():
        unread_only = str(request.args.get('unread_only') or '').lower() in {'1', 'true', 'yes'}
        limit = request.args.get('limit', default=25, type=int)
        limit = max(1, min(limit, 100))

        query = ur.UserNotification.query.filter_by(user_id=current_user.id)
        if unread_only:
            query = query.filter_by(is_read=False)

        notifications = query.order_by(ur.UserNotification.created_at.desc()).limit(limit).all()
        unread_count = ur.UserNotification.query.filter_by(user_id=current_user.id, is_read=False).count()

        return {
            'notifications': [notification.to_dict() for notification in notifications],
            'unread_count': unread_count,
        }, 200

    @users_bp.route('/auth/notifications/<int:notification_id>/read', methods=['PATCH'])
    @login_required
    def auth_notifications_mark_read(notification_id):
        notification = ur.UserNotification.query.filter_by(id=notification_id, user_id=current_user.id).first()
        if not notification:
            return {'error': 'Notification not found.'}, 404

        notification.is_read = True
        notification.read_at = ur._utc_now()
        ur.db.session.commit()

        unread_count = ur.UserNotification.query.filter_by(user_id=current_user.id, is_read=False).count()
        return {'message': 'Notification marked as read.', 'notification': notification.to_dict(), 'unread_count': unread_count}, 200

    @users_bp.route('/auth/notifications/read_all', methods=['POST'])
    @login_required
    def auth_notifications_mark_all_read():
        now = ur._utc_now()
        notifications = ur.UserNotification.query.filter_by(user_id=current_user.id, is_read=False).all()
        for notification in notifications:
            notification.is_read = True
            notification.read_at = now
        ur.db.session.commit()

        return {'message': 'All notifications marked as read.', 'unread_count': 0}, 200

    @users_bp.route('/auth/transactions', methods=['GET'])
    @login_required
    def auth_transactions():
        limit = request.args.get('limit', default=20, type=int)
        limit = max(1, min(limit, 100))

        analysis_rows = (
            ur.AnalysisTransaction.query
            .filter_by(user_id=current_user.id)
            .order_by(ur.AnalysisTransaction.created_at.desc())
            .limit(limit)
            .all()
        )
        activity_rows = (
            ur.UserActivityEvent.query
            .filter_by(user_id=current_user.id)
            .order_by(ur.UserActivityEvent.created_at.desc())
            .limit(limit)
            .all()
        )
        billing_rows = (
            ur.BillingTransaction.query
            .filter_by(user_id=current_user.id)
            .order_by(ur.BillingTransaction.created_at.desc())
            .limit(limit)
            .all()
        )

        return {
            'analysis_transactions': [row.to_dict() for row in analysis_rows],
            'activity_events': [row.to_dict() for row in activity_rows],
            'billing_transactions': [row.to_dict() for row in billing_rows],
        }, 200

    @users_bp.route('/auth/billing/<int:txn_id>/receipt', methods=['GET'])
    @login_required
    def auth_billing_receipt(txn_id):
        current_app.logger.info('auth_billing_receipt called for txn_id=%s user_id=%s', txn_id, getattr(current_user, 'id', None))
        tx = ur.BillingTransaction.query.filter_by(id=txn_id, user_id=current_user.id).first()
        if not tx:
            current_app.logger.info('auth_billing_receipt not found txn=%s uid=%s', txn_id, getattr(current_user, 'id', None))
            return {'error': 'Transaction not found.'}, 404

        amount_major = (tx.amount_minor or 0) / 100.0
        created = (tx.created_at.isoformat() if getattr(tx, 'created_at', None) else '')
        period_start = (tx.period_start.isoformat() if getattr(tx, 'period_start', None) else '')
        period_end = (tx.period_end.isoformat() if getattr(tx, 'period_end', None) else '')
        status = (tx.status.value if hasattr(tx.status, 'value') else str(tx.status))

        item_label = getattr(tx, 'description', None) or tx.provider or 'Subscription'

        html = f"""
        <!doctype html>
        <html>
        <head>
            <meta charset=\"utf-8\">
            <title>Receipt #{tx.id}</title>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; padding: 28px; color: #111; }}
                .receipt {{ max-width: 720px; margin: 0 auto; border: 1px solid #e6e6e6; padding: 24px; }}
                .header {{ display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; }}
                h1 {{ margin:0; font-size:20px; }}
                table {{ width:100%; border-collapse:collapse; margin-top:12px; }}
                td, th {{ text-align:left; padding:8px 6px; border-bottom:1px solid #f2f2f2; }}
                .total {{ font-weight:700; font-size:18px; }}
            </style>
        </head>
        <body>
            <div class=\"receipt\">
                <div class=\"header\">
                    <div>
                        <h1>gueInsight</h1>
                        <div>Receipt #{tx.id}</div>
                    </div>
                    <div>
                        <div>{current_app.config.get('COMPANY_NAME', 'gueInsight')}</div>
                        <div>{current_app.config.get('COMPANY_ADDRESS', '')}</div>
                    </div>
                </div>

                <div>
                    <strong>Bill To</strong>
                    <div>{current_user.first_name or ''} {current_user.last_name or ''}</div>
                    <div>{current_user.email or ''}</div>
                </div>

                <table>
                    <thead>
                        <tr><th>Description</th><th>Period</th><th style=\"text-align:right\">Amount</th></tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>{item_label}</td>
                            <td>{period_start} -> {period_end}</td>
                            <td style=\"text-align:right\">{amount_major:.2f} { (tx.currency or '').upper() }</td>
                        </tr>
                    </tbody>
                </table>

                <div style=\"margin-top:18px; display:flex; justify-content:space-between; align-items:center;\">
                    <div>Status: {status}</div>
                    <div class=\"total\">Total: {amount_major:.2f} { (tx.currency or '').upper() }</div>
                </div>

                <div style=\"margin-top:18px; font-size:12px; color:#666\">Created: {created}</div>
            </div>
        </body>
        </html>
        """

        return Response(html, mimetype='text/html')

    @users_bp.route('/auth/subscription/upgrade', methods=['POST'])
    @login_required
    def auth_upgrade_subscription():
        payload = request.get_json(silent=True) or request.form
        requested_plan = str(payload.get('plan') or '').strip().lower()

        plan_aliases = {
            'starter': 'premium_individual',
            'growth': 'premium_small_business',
            'scale': 'premium_large_business',
            'premium': 'premium_individual',
        }
        normalized_plan = plan_aliases.get(requested_plan, requested_plan)
        allowed_plans = {'premium_individual', 'premium_small_business', 'premium_large_business'}

        if normalized_plan not in allowed_plans:
            return {
                'error': 'Invalid plan. Use premium_individual, premium_small_business, or premium_large_business.'
            }, 400

        now = ur._utc_now()
        current_subscription = (
            ur.Subscription.query
            .filter_by(user_id=current_user.id)
            .order_by(ur.Subscription.end_date.desc())
            .first()
        )

        current_plan = str(getattr(current_subscription, 'plan', '') or '').lower()
        if current_subscription and current_plan == normalized_plan and current_subscription.end_date and current_subscription.end_date >= now:
            return {'error': 'You are already on this active plan.'}, 400

        start_date = now
        if current_subscription and current_subscription.end_date and current_subscription.end_date > now:
            start_date = current_subscription.end_date

        new_subscription = ur.Subscription(
            user_id=current_user.id,
            plan=normalized_plan,
            start_date=start_date,
            end_date=start_date + timedelta(days=30),
        )
        ur.db.session.add(new_subscription)
        ur.db.session.commit()
        return {'message': 'Subscription created'}, 200

    @users_bp.route('/auth/billing/receipt/raw/<int:txn_id>', methods=['GET'])
    @login_required
    def auth_billing_receipt_raw(txn_id):
        tx = ur.BillingTransaction.query.filter_by(id=txn_id, user_id=current_user.id).first()
        if not tx:
            return {'error': 'Transaction not found.'}, 404

        amount_major = (tx.amount_minor or 0) / 100.0
        created = (tx.created_at.isoformat() if getattr(tx, 'created_at', None) else '')
        period_start = (tx.period_start.isoformat() if getattr(tx, 'period_start', None) else '')
        period_end = (tx.period_end.isoformat() if getattr(tx, 'period_end', None) else '')
        status = (tx.status.value if hasattr(tx.status, 'value') else str(tx.status))

        html = f"""
        <!doctype html>
        <html>
        <head><meta charset=\"utf-8\"><title>Receipt #{tx.id}</title></head>
        <body>
        <h1>Receipt #{tx.id}</h1>
        <p>Amount: {amount_major:.2f} {(tx.currency or '').upper()}</p>
        <p>Period: {period_start} - {period_end}</p>
        <p>Status: {status}</p>
        <p>Created: {created}</p>
        </body>
        </html>
        """

        return Response(html, mimetype='text/html')

    @users_bp.route('/auth/subscription/plans', methods=['GET'])
    def auth_subscription_plans():
        from app.subscription_service import COMPLIANCE_TIERS
        plans = []
        for tier_key, config in COMPLIANCE_TIERS.items():
            plans.append({
                'id': tier_key,
                'name': config.get('name'),
                'price': config.get('price_monthly_eur') / 100,  # Convert from cents to euros
                'price_eur': f"€{config.get('price_monthly_eur', 0) / 100:.2f}",
                'price_monthly_eur': config.get('price_monthly_eur'),
                'price_annually_eur': config.get('price_annually_eur'),
                'description': config.get('description'),
                'features': config.get('features', []),
                'compliance_level': config.get('compliance_level'),
                'gdpr_ready': config.get('gdpr_ready', False),
                'nis2_ready': config.get('nis2_ready', False),
                'storage_gb': config.get('storage_gb'),
            })
        return plans, 200

    @users_bp.route('/auth/subscription', methods=['GET'])
    @login_required
    def auth_subscription():
        latest_subscription = (
            ur.Subscription.query
            .filter_by(user_id=current_user.id)
            .order_by(ur.Subscription.end_date.desc())
            .first()
        )
        
        if not latest_subscription:
            return {
                'tier': 'Free',
                'status': 'active',
                'start_date': None,
                'end_date': None,
                'is_trial': False,
            }, 200

        status = 'active' if latest_subscription.end_date and latest_subscription.end_date >= ur._utc_now() else 'expired'
        return {
            'id': latest_subscription.id,
            'tier': latest_subscription.plan,
            'status': status,
            'start_date': latest_subscription.start_date.isoformat() if latest_subscription.start_date else None,
            'end_date': latest_subscription.end_date.isoformat() if latest_subscription.end_date else None,
            'is_trial': bool(getattr(latest_subscription, 'is_trial', False)),
            'stripe_subscription_id': getattr(latest_subscription, 'stripe_subscription_id', None),
        }, 200

    @users_bp.route('/auth/user', methods=['GET'])
    @login_required
    def auth_user():
        return ur._serialize_auth_user(current_user), 200

    @users_bp.route('/checkout/create-session', methods=['POST'])
    @login_required
    def checkout_create_session():
        import stripe
        payload = request.get_json(silent=True) or request.form
        plan_name = str(payload.get('plan_name') or '').strip().lower()
        billing_cycle = str(payload.get('billing_cycle') or 'monthly').strip().lower()

        from app.subscription_service import COMPLIANCE_TIERS
        plan_map = {v.get('name', '').lower(): k for k, v in COMPLIANCE_TIERS.items()}
        tier_key = plan_map.get(plan_name)
        
        if not tier_key or tier_key not in COMPLIANCE_TIERS:
            return {'error': f'Invalid plan: {plan_name}'}, 400

        tier_config = COMPLIANCE_TIERS[tier_key]
        stripe_key = current_app.config.get('STRIPE_API_KEY')
        if not stripe_key:
            return {'error': 'Stripe configuration missing'}, 500

        stripe.api_key = stripe_key
        customer_id = getattr(current_user, 'stripe_customer_id', None)
        
        # Create or retrieve customer
        if not customer_id:
            try:
                customer = stripe.Customer.create(
                    email=current_user.email,
                    name=f"{current_user.first_name} {current_user.last_name}",
                    metadata={'user_id': current_user.id}
                )
                customer_id = customer.id
                current_user.stripe_customer_id = customer_id
                ur.db.session.commit()
            except Exception as e:
                current_app.logger.exception('Failed to create Stripe customer')
                return {'error': f'Failed to create checkout: {str(e)}'}, 500

        # Create checkout session
        try:
            price_cents = tier_config.get('price_monthly_eur') if billing_cycle == 'monthly' else tier_config.get('price_annually_eur')
            
            session = stripe.checkout.Session.create(
                customer=customer_id,
                payment_method_types=['card'],
                line_items=[{
                    'price_data': {
                        'currency': 'eur',
                        'product_data': {
                            'name': tier_config.get('name'),
                            'description': tier_config.get('description'),
                        },
                        'unit_amount': price_cents,
                        'recurring': {
                            'interval': 'month' if billing_cycle == 'monthly' else 'year',
                            'interval_count': 1,
                        } if billing_cycle in ['monthly', 'annual'] else None,
                    },
                    'quantity': 1,
                }] if billing_cycle in ['monthly', 'annual'] else [{
                    'price_data': {
                        'currency': 'eur',
                        'product_data': {
                            'name': tier_config.get('name'),
                            'description': tier_config.get('description'),
                        },
                        'unit_amount': price_cents,
                    },
                    'quantity': 1,
                }],
                mode='subscription' if billing_cycle in ['monthly', 'annual'] else 'payment',
                success_url=f"{current_app.config.get('FRONTEND_URL', 'http://localhost:5174')}/subscription?session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{current_app.config.get('FRONTEND_URL', 'http://localhost:5174')}/subscription",
                metadata={
                    'user_id': current_user.id,
                    'tier': tier_key,
                    'trial_days': 14,
                }
            )
            
            return {
                'message': 'Checkout session created',
                'session_id': session.id,
                'checkout_url': session.url,
            }, 201
        except Exception as e:
            current_app.logger.exception('Failed to create Stripe checkout session')
            return {'error': f'Failed to create checkout: {str(e)}'}, 500