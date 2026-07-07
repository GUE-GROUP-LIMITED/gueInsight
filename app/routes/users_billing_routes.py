from datetime import timedelta
import logging

from flask import request, current_app, Response
from flask_login import current_user, login_required

logger = logging.getLogger(__name__)


def _send_upgrade_receipt_email(user, transaction, new_plan, tier_config, previous_plan):
    """Send customized receipt email when user upgrades or downgrades subscription."""
    try:
        from app.notifications.alerts import send_email
        
        plan_names = {
            'free': 'Free',
            'starter': 'Starter',
            'compliance_pro': 'Compliance Pro',
            'enterprise_professional': 'Enterprise Professional',
            'enterprise_risk': 'Enterprise Risk',
            'enterprise_elite': 'Enterprise Elite',
            'premium_individual': 'Premium Individual',
            'premium_small_business': 'Premium Small Business',
            'premium_large_business': 'Premium Large Business',
        }
        
        old_plan_name = plan_names.get(previous_plan, previous_plan.replace('_', ' ').title())
        new_plan_name = tier_config.get('name', plan_names.get(new_plan, new_plan.replace('_', ' ').title()))
        amount = transaction.amount_minor / 100.0
        transaction_dt = getattr(transaction, 'created_at', None)
        
        subject = f"✓ Subscription Upgrade Confirmed - Receipt #{transaction.id}"
        
        body = f"""
Hello {user.first_name or 'User'},

Your subscription has been successfully upgraded!

══════════════════════════════════════════
UPGRADE DETAILS
══════════════════════════════════════════

Previous Plan:  {old_plan_name}
New Plan:       {new_plan_name}
Effective Date: {transaction.period_start.strftime('%B %d, %Y') if transaction.period_start else 'Today'}
Upgrade Date:   {transaction_dt.strftime('%B %d, %Y %H:%M:%S UTC') if transaction_dt else 'Today'}

══════════════════════════════════════════
BILLING INFORMATION
══════════════════════════════════════════

Receipt Number: REC-{transaction.id:06d}
Amount:         €{amount:.2f}/month
Billing Cycle:  Monthly
Currency:       EUR (€)
Status:         ✓ Completed

Subscription Period:
  Start: {transaction.period_start.strftime('%B %d, %Y') if transaction.period_start else 'Today'}
  End:   {transaction.period_end.strftime('%B %d, %Y') if transaction.period_end else 'In 30 days'}

══════════════════════════════════════════
NEW PLAN FEATURES
══════════════════════════════════════════

{new_plan_name} includes:

"""
        
        if 'features' in tier_config:
            for feature in tier_config['features']:
                body += f"• {feature}\n"
        
        body += f"""
══════════════════════════════════════════
NEXT STEPS
══════════════════════════════════════════

Your new plan is active immediately. You can:

1. View your billing history: https://app.gueinsight.com/billing
2. Download your receipt: https://app.gueinsight.com/billing (Receipt #{transaction.id})
3. Manage your subscription: https://app.gueinsight.com/subscription
4. Contact support: support@gueinsight.com

Thank you for upgrading to {new_plan_name}!

Best regards,
The gueInsight Team
        """
        
        send_email(user.email, subject, body)
        logger.info(f"Sent upgrade receipt email to {user.email} for upgrade to {new_plan}")
    except Exception as e:
        logger.error(f"Failed to send upgrade receipt email: {e}")


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
        import base64
        import os
        current_app.logger.info('auth_billing_receipt called for txn_id=%s user_id=%s', txn_id, getattr(current_user, 'id', None))
        tx = ur.BillingTransaction.query.filter_by(id=txn_id, user_id=current_user.id).first()
        if not tx:
            current_app.logger.info('auth_billing_receipt not found txn=%s uid=%s', txn_id, getattr(current_user, 'id', None))
            return {'error': 'Transaction not found.'}, 404

        # --- Logo (base64 inline so it works in blob windows and downloads) ---
        logo_html = ''
        logo_candidates = [
            os.path.join(current_app.root_path, '..', 'frontend', 'public', 'img', 'logo.png'),
            os.path.join(current_app.root_path, 'static', 'img', 'logo.png'),
            os.path.join(current_app.root_path, '..', 'frontend', 'src', 'img', 'logo.png'),
        ]
        for logo_path in logo_candidates:
            if os.path.isfile(logo_path):
                try:
                    with open(logo_path, 'rb') as logo_file:
                        b64 = base64.b64encode(logo_file.read()).decode('ascii')
                    logo_html = f'<img src="data:image/png;base64,{b64}" alt="GueInsight" style="height:48px; width:auto; display:block;">'
                    break
                except Exception:
                    continue

        if not logo_html:
            logo_html = '<div style="font-size:22px; font-weight:700; color:#0b66c3; letter-spacing:-0.5px;">GueInsight</div>'

        amount_major = (tx.amount_minor or 0) / 100.0
        created_dt = getattr(tx, 'created_at', None)
        created_fmt = created_dt.strftime('%d %B %Y, %H:%M UTC') if created_dt else ''
        period_start = (tx.period_start.strftime('%d %b %Y') if getattr(tx, 'period_start', None) else '—')
        period_end   = (tx.period_end.strftime('%d %b %Y')   if getattr(tx, 'period_end',   None) else '—')
        status = (tx.status.value if hasattr(tx.status, 'value') else str(tx.status))
        status_color = {'succeeded': '#0b7c4d', 'failed': '#b81f2e', 'pending': '#7a5700'}.get(status.lower(), '#444')
        status_bg    = {'succeeded': '#d4f4e5', 'failed': '#fde8e8', 'pending': '#fef3c7'}.get(status.lower(), '#f0f0f0')

        item_label = getattr(tx, 'description', None) or 'Subscription'

        # Upgrade/downgrade plan-change section
        upgrade_section = ''
        provider_txn_label = (tx.provider_txn_id or '').strip()
        if provider_txn_label.startswith('plan-change:'):
            parts = provider_txn_label.split(':', 2)
            if len(parts) == 3:
                previous_plan = parts[1].replace('_', ' ').title()
                new_plan      = parts[2].replace('_', ' ').title()
                upgrade_section = f"""
                <tr style="background:#f0f7ff;">
                    <td style="padding:10px 6px;"><strong>Plan change</strong></td>
                    <td style="padding:10px 6px; color:#666;">{previous_plan} → <strong style="color:#0b66c3;">{new_plan}</strong></td>
                    <td></td>
                </tr>"""

        # Customer company name if available
        customer_company = ''
        if getattr(current_user, 'company_name', None):
            customer_company = f'<div style="color:#555;">{current_user.company_name}</div>'

        html = f"""<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Receipt #{tx.id:06d} — GueInsight</title>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
               background: #f4f6f9; color: #111; padding: 32px 16px; }}
        .page {{ max-width: 740px; margin: 0 auto; background: #fff;
                 border-radius: 10px; box-shadow: 0 2px 16px rgba(0,0,0,.10); overflow: hidden; }}

        /* ── Header band ── */
        .hd {{ background: linear-gradient(135deg, #03275e 0%, #0b66c3 100%);
               padding: 28px 32px; display: flex; justify-content: space-between; align-items: center; }}
        .hd-logo {{ display: flex; align-items: center; gap: 14px; }}
        .hd-wordmark {{ color: #fff; }}
        .hd-wordmark-title {{ font-size: 20px; font-weight: 700; letter-spacing: -.3px; }}
        .hd-wordmark-sub {{ font-size: 11px; opacity: .75; margin-top: 2px; }}
        .hd-right {{ text-align: right; color: #fff; }}
        .hd-right h2 {{ font-size: 15px; font-weight: 600; opacity: .9; }}
        .hd-right .rec-num {{ font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }}

        /* ── Body ── */
        .body {{ padding: 32px; }}

        /* ── Two-column address row ── */
        .addr-row {{ display: flex; gap: 32px; margin-bottom: 28px; }}
        .addr-block {{ flex: 1; }}
        .addr-block h4 {{ font-size: 10px; text-transform: uppercase; letter-spacing: 1px;
                          color: #888; margin-bottom: 8px; }}
        .addr-block p {{ font-size: 13px; line-height: 1.7; color: #333; }}
        .addr-block a {{ color: #0b66c3; text-decoration: none; }}

        /* ── Table ── */
        table {{ width: 100%; border-collapse: collapse; margin-bottom: 24px; }}
        thead tr {{ background: #f0f4f8; }}
        th {{ font-size: 11px; text-transform: uppercase; letter-spacing: .6px;
              color: #666; padding: 10px 12px; text-align: left; }}
        th:last-child {{ text-align: right; }}
        td {{ padding: 12px; font-size: 13px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }}
        td:last-child {{ text-align: right; font-weight: 600; }}
        tbody tr:last-child td {{ border-bottom: none; }}

        /* ── Totals row ── */
        .totals {{ border-top: 2px solid #e0e0e0; padding-top: 16px;
                   display: flex; justify-content: flex-end; margin-bottom: 24px; }}
        .totals-box {{ text-align: right; }}
        .totals-box .lbl {{ font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: .6px; margin-bottom: 4px; }}
        .totals-box .amt {{ font-size: 26px; font-weight: 700; color: #0b66c3; }}

        /* ── Status badge ── */
        .badge {{ display: inline-block; padding: 4px 10px; border-radius: 20px;
                  font-size: 11px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; }}

        /* ── Meta row ── */
        .meta {{ font-size: 11px; color: #888; line-height: 1.8; margin-bottom: 24px; }}

        /* ── Footer band ── */
        .ft {{ background: #f0f4f8; border-top: 1px solid #e0e0e0;
               padding: 20px 32px; font-size: 11px; color: #666;
               display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; }}
        .ft a {{ color: #0b66c3; text-decoration: none; }}

        @media print {{
            body {{ background: #fff; padding: 0; }}
            .page {{ box-shadow: none; border-radius: 0; }}
        }}
    </style>
</head>
<body>
<div class="page">

    <!-- Header -->
    <div class="hd">
        <div class="hd-logo">
            {logo_html}
            <div class="hd-wordmark">
                <div class="hd-wordmark-title">GueInsight</div>
                <div class="hd-wordmark-sub">A Gue Cyber Product</div>
            </div>
        </div>
        <div class="hd-right">
            <h2>Payment Receipt</h2>
            <div class="rec-num">#{tx.id:06d}</div>
        </div>
    </div>

    <!-- Body -->
    <div class="body">

        <!-- From / Bill To -->
        <div class="addr-row">
            <div class="addr-block">
                <h4>From</h4>
                <p>
                    <strong>Gue Cyber BV</strong><br>
                    Doorniksesteenweg 3B bus 101<br>
                    8580 Avelgem, Belgium<br>
                    Enterprise no. 1037.163.392<br>
                    <a href="mailto:support@gueinsight.com">support@gueinsight.com</a>
                </p>
            </div>
            <div class="addr-block">
                <h4>Bill To</h4>
                <p>
                    <strong>{current_user.first_name or ''} {current_user.last_name or ''}</strong><br>
                    {customer_company}
                    <a href="mailto:{current_user.email or ''}">{current_user.email or ''}</a>
                </p>
            </div>
            <div class="addr-block">
                <h4>Details</h4>
                <p>
                    <strong>Date:</strong> {created_fmt}<br>
                    <strong>Period:</strong> {period_start} – {period_end}<br>
                    <strong>Status:</strong>
                    <span class="badge" style="background:{status_bg}; color:{status_color};">{status.upper()}</span>
                </p>
            </div>
        </div>

        <!-- Line items -->
        <table>
            <thead>
                <tr>
                    <th style="width:50%">Description</th>
                    <th>Period</th>
                    <th>Amount</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>{item_label}</td>
                    <td style="color:#666;">{period_start} – {period_end}</td>
                    <td>{amount_major:.2f} {(tx.currency or 'EUR').upper()}</td>
                </tr>
                {upgrade_section}
            </tbody>
        </table>

        <!-- Total -->
        <div class="totals">
            <div class="totals-box">
                <div class="lbl">Total due</div>
                <div class="amt">{amount_major:.2f} {(tx.currency or 'EUR').upper()}</div>
            </div>
        </div>

        <!-- Meta -->
        <div class="meta">
            Transaction ID: <strong>{tx.id}</strong> &nbsp;·&nbsp;
            Receipt: <strong>#{tx.id:06d}</strong> &nbsp;·&nbsp;
            Generated: {created_fmt}
        </div>

    </div><!-- /body -->

    <!-- Footer -->
    <div class="ft">
        <span>
            <strong>Gue Cyber BV</strong> · Doorniksesteenweg 3B bus 101, 8580 Avelgem, Belgium ·
            Enterprise no. 1037.163.392
        </span>
        <span>
            <a href="https://www.guecyber.com">guecyber.com</a> ·
            <a href="mailto:support@gueinsight.com">support@gueinsight.com</a>
        </span>
    </div>

</div>
</body>
</html>"""

        return Response(html, mimetype='text/html')

    @users_bp.route('/auth/subscription/upgrade', methods=['POST'])
    @login_required
    def auth_upgrade_subscription():
        payload = request.get_json(silent=True) or request.form
        requested_plan = str(payload.get('plan') or '').strip().lower()

        plan_aliases = {
            'starter': 'starter',
            'growth': 'enterprise_professional',
            'scale': 'enterprise_elite',
            'premium': 'compliance_pro',
            'premium_individual': 'compliance_pro',
            'premium_small_business': 'enterprise_risk',
            'premium_large_business': 'enterprise_elite',
            'freemium': 'free',
        }
        normalized_plan = plan_aliases.get(requested_plan, requested_plan)
        
        # Support all new tier plans
        allowed_plans = {
            'free', 'starter', 'compliance_pro', 'enterprise_professional',
            'enterprise_risk', 'enterprise_elite',
            # Legacy names for backward compatibility
            'premium_individual', 'premium_small_business', 'premium_large_business'
        }
        
        if normalized_plan not in allowed_plans:
            return {
                'error': 'Invalid plan. Supported plans: free, starter, compliance_pro, enterprise_professional, enterprise_risk, enterprise_elite'
            }, 400

        now = ur._utc_now()
        current_subscription = (
            ur.Subscription.query
            .filter_by(user_id=current_user.id)
            .order_by(ur.Subscription.end_date.desc())
            .first()
        )

        current_plan = str(getattr(current_subscription, 'plan', '') or '').lower()
        current_plan_normalized = plan_aliases.get(current_plan, current_plan)
        if current_subscription and current_plan_normalized == normalized_plan and current_subscription.end_date and current_subscription.end_date >= now:
            return {'error': 'You are already on this active plan.'}, 400

        def _expire_current_subscription_immediately():
            if current_subscription and current_subscription.end_date and current_subscription.end_date > now:
                current_subscription.end_date = now
                ur.db.session.add(current_subscription)
                ur.db.session.commit()

        def _create_internal_subscription(plan_to_store: str, resolved_plan: str, start_date):
            resolved_tier = COMPLIANCE_TIERS.get(resolved_plan, {})
            period_days = 365 if not resolved_tier.get('requires_payment', False) else 30

            new_subscription = ur.Subscription(
                user_id=current_user.id,
                plan=plan_to_store,
                start_date=start_date,
                end_date=start_date + timedelta(days=period_days),
                payment_method='none' if period_days == 365 else 'test',
            )
            ur.db.session.add(new_subscription)
            ur.db.session.commit()

            amount_minor = resolved_tier.get('price_monthly_eur', 0)
            transaction = ur.BillingTransaction(
                user_id=current_user.id,
                subscription_id=new_subscription.id,
                provider='internal',
                provider_txn_id=f'plan-change:{current_plan or "free"}:{resolved_plan}',
                amount_minor=amount_minor,
                currency='EUR',
                status=ur.BillingStatus.SUCCEEDED,
                period_start=start_date,
                period_end=start_date + timedelta(days=period_days),
            )
            ur.db.session.add(transaction)
            ur.db.session.commit()

            receipt_url = f'/auth/billing/{transaction.id}/receipt'

            try:
                ur._create_user_notification(
                    current_user.id,
                    'billing',
                    'Subscription confirmed',
                    f'Your {resolved_tier.get("name", resolved_plan)} subscription is active. Receipt #{transaction.id:06d} is available in billing.',
                    severity='info',
                    action_url=receipt_url,
                )
                ur.db.session.commit()
            except Exception:
                ur.db.session.rollback()
                current_app.logger.exception('Failed to create subscription notification')

            try:
                _send_upgrade_receipt_email(
                    current_user,
                    transaction,
                    resolved_plan,
                    resolved_tier,
                    current_plan or 'free',
                )
            except Exception:
                current_app.logger.exception('Failed to send subscription receipt email')

            return {
                'message': 'Subscription created',
                'transaction_id': transaction.id,
                'receipt_url': receipt_url,
            }, 200

        # Get tier configuration
        from app.subscription_service import COMPLIANCE_TIERS
        tier_config = COMPLIANCE_TIERS.get(normalized_plan, {})
        
        # Check if payment is required for this plan
        requires_payment = tier_config.get('requires_payment', False)
        
        if not requires_payment:
            _expire_current_subscription_immediately()
            start_date = now

            return _create_internal_subscription(
                normalized_plan,
                normalized_plan,
                start_date,
            )

        if current_app.config.get('TESTING'):
            # Keep test runs deterministic and avoid external Stripe dependency.
            plan_to_store = requested_plan if requested_plan in {
                'premium_individual', 'premium_small_business', 'premium_large_business'
            } else normalized_plan
            _expire_current_subscription_immediately()
            start_date = now
            return _create_internal_subscription(plan_to_store, normalized_plan, start_date)
        
        # Paid plan - redirect to Stripe Checkout
        try:
            import stripe

            stripe_key = (
                current_app.config.get('STRIPE_SECRET_KEY')
                or current_app.config.get('STRIPE_API_KEY')
            )
            stripe.api_key = stripe_key
            is_production = bool(current_app.config.get('IS_PRODUCTION', False))
            allow_nonprod_fallback = bool(
                current_app.config.get('ALLOW_NONPROD_BILLING_FALLBACK', not is_production)
            )

            if not stripe.api_key and allow_nonprod_fallback:
                # Local/staging fallback to keep non-production environments functional without Stripe secrets.
                _expire_current_subscription_immediately()
                start_date = now
                return _create_internal_subscription(normalized_plan, normalized_plan, start_date)

            if not stripe.api_key:
                current_app.logger.error('Stripe key missing in production configuration for paid checkout')
                return {'error': 'Billing is temporarily unavailable. Please contact support.'}, 503
            
            # Get or create Stripe customer
            stripe_customer_id = current_user.stripe_customer_id
            if not stripe_customer_id:
                customer = stripe.Customer.create(
                    email=current_user.email,
                    name=f"{current_user.first_name} {current_user.last_name}",
                    metadata={'user_id': str(current_user.id)},
                )
                stripe_customer_id = customer.id
                current_user.stripe_customer_id = stripe_customer_id
                ur.db.session.add(current_user)
                ur.db.session.commit()
            
            # Prefer configured Stripe Price IDs, but support inline recurring price fallback.
            price_id = tier_config.get('stripe_price_id')
            amount_minor = int(tier_config.get('price_monthly_eur', 0) or 0)

            def _inline_line_items():
                return [
                    {
                        'price_data': {
                            'currency': 'eur',
                            'product_data': {'name': f"gueInsight - {tier_config.get('name', normalized_plan)}"},
                            'unit_amount': amount_minor,
                            'recurring': {'interval': 'month'},
                        },
                        'quantity': 1,
                    }
                ]

            line_items = [{'price': price_id, 'quantity': 1}] if price_id else _inline_line_items()

            try:
                checkout_session = stripe.checkout.Session.create(
                    payment_method_types=['card'],
                    customer=stripe_customer_id,
                    line_items=line_items,
                    mode='subscription',
                    success_url=current_app.config.get('FRONTEND_URL', 'http://localhost:5173') + '/subscription?upgrade=success',
                    cancel_url=current_app.config.get('FRONTEND_URL', 'http://localhost:5173') + '/subscription?upgrade=cancelled',
                    metadata={
                        'user_id': str(current_user.id),
                        'tier': normalized_plan,
                        'current_plan': current_plan or 'free',
                        'trial_days': '14',
                    },
                    billing_address_collection='auto',
                    phone_number_collection={'enabled': True},
                )
            except stripe.error.InvalidRequestError as stripe_error:
                # If configured price IDs are stale/missing in Stripe, retry with inline price_data.
                if price_id and 'No such price' in str(stripe_error):
                    checkout_session = stripe.checkout.Session.create(
                        payment_method_types=['card'],
                        customer=stripe_customer_id,
                        line_items=_inline_line_items(),
                        mode='subscription',
                        success_url=current_app.config.get('FRONTEND_URL', 'http://localhost:5173') + '/subscription?upgrade=success',
                        cancel_url=current_app.config.get('FRONTEND_URL', 'http://localhost:5173') + '/subscription?upgrade=cancelled',
                        metadata={
                            'user_id': str(current_user.id),
                            'tier': normalized_plan,
                            'current_plan': current_plan or 'free',
                            'trial_days': '14',
                        },
                        billing_address_collection='auto',
                        phone_number_collection={'enabled': True},
                    )
                else:
                    raise
            
            return {
                'message': 'Checkout session created',
                'checkout_url': checkout_session.url,
                'session_id': checkout_session.id,
            }, 200
            
        except Exception as e:
            is_production = bool(current_app.config.get('IS_PRODUCTION', False))
            allow_nonprod_fallback = bool(
                current_app.config.get('ALLOW_NONPROD_BILLING_FALLBACK', not is_production)
            )
            if allow_nonprod_fallback:
                current_app.logger.warning('Stripe checkout failed in non-production, using internal fallback: %s', e)
                start_date = now
                if current_subscription and current_subscription.end_date and current_subscription.end_date > now:
                    start_date = current_subscription.end_date
                return _create_internal_subscription(normalized_plan, normalized_plan, start_date)

            current_app.logger.exception('Failed to create Stripe checkout session')
            return {'error': 'Failed to initiate checkout. Please try again or contact support.'}, 500

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
