import stripe
from datetime import timedelta, datetime
from app.models import db, User, Subscription
from app import db


# Compliance-focused pricing tiers with feature matrix
COMPLIANCE_TIERS = {
    "free": {
        "name": "Free",
        "price_monthly_eur": 0,
        "price_annually_eur": 0,
        "description": "Get started with basic analysis and learning",
        "features": [
            "Basic file types (TXT, JSON, XML, logs)",
            "Manual analysis",
            "Community support",
        ],
        "compliance_level": "None",
        "gdpr_ready": False,
        "nis2_ready": False,
        "storage_gb": 1,
        "stripe_price_id": None,  # Free tier - no payment
        "requires_payment": False,
    },
    "starter": {
        "name": "Starter",
        "price_monthly_eur": 4990,  # €49.90/month in cents
        "price_annually_eur": 49900,
        "description": "For small teams and individual professionals",
        "features": [
            "PDF, PCAP, logs analysis",
            "Basic threat detection",
            "Email support",
            "30-day retention",
        ],
        "compliance_level": "Basic",
        "gdpr_ready": False,
        "nis2_ready": False,
        "storage_gb": 5,
        "stripe_price_id": "price_starter_eur_monthly",  # Test mode price ID - update with actual Stripe ID
        "requires_payment": True,
    },
    "compliance_pro": {
        "name": "Compliance Pro",
        "price_monthly_eur": 9990,  # €99.90/month in cents
        "price_annually_eur": 99900,
        "description": "GDPR-focused threat detection with compliance audit trails",
        "features": [
            "PDF, PCAP, logs analysis",
            "GDPR export & deletion tools",
            "90-day retention",
            "M365 connector (basic)",
        ],
        "compliance_level": "GDPR Article 5",
        "gdpr_ready": True,
        "nis2_ready": False,
        "storage_gb": 10,
        "stripe_price_id": "price_compliance_pro_eur_monthly",  # Test mode price ID - update with actual Stripe ID
        "requires_payment": True,
    },
    "enterprise_professional": {
        "name": "Enterprise Professional",
        "price_monthly_eur": 29990,  # €299.90/month in cents
        "price_annually_eur": 299900,
        "description": "GDPR + NIS2 compliance for growing enterprises",
        "features": [
            "All file types + databases",
            "Full GDPR compliance tools",
            "NIS2 risk management",
            "M365 + Google Workspace",
            "90-day retention & audit logs",
        ],
        "compliance_level": "GDPR + NIS2",
        "gdpr_ready": True,
        "nis2_ready": True,
        "storage_gb": 50,
        "stripe_price_id": "price_enterprise_prof_eur_monthly",  # Test mode price ID - update with actual Stripe ID
        "requires_payment": True,
    },
    "enterprise_risk": {
        "name": "Enterprise Risk",
        "price_monthly_eur": 49900,  # €499/month in cents
        "price_annually_eur": 499000,
        "description": "NIS2 + ISO27001 critical infrastructure risk management",
        "features": [
            "All Enterprise Professional features",
            "NIS2 incident reporting",
            "M365 + Google Workspace connectors",
            "Advanced DLP policy assessment",
            "Privilege escalation detection",
            "Device compliance monitoring",
            "1-year retention & audit logs",
            "Custom alert rules",
            "Priority support",
        ],
        "compliance_level": "NIS2 + ISO27001",
        "gdpr_ready": True,
        "nis2_ready": True,
        "storage_gb": 100,
        "stripe_price_id": "price_enterprise_risk_eur_monthly",  # Test mode price ID - update with actual Stripe ID
        "requires_payment": True,
    },
    "enterprise_elite": {
        "name": "Enterprise Elite",
        "price_monthly_eur": 99900,  # €999/month in cents (custom pricing available)
        "price_annually_eur": 999000,
        "description": "White-glove SOC2/ISO27001 compliance + EU-only data residency",
        "features": [
            "All Enterprise Risk features",
            "EU-only data residency enforcement",
            "SOC2 Type II readiness assessment",
            "Custom compliance dashboards",
            "Dedicated compliance officer support",
            "Incident response playbooks",
            "Unlimited file/text analysis",
            "Real-time security alerting",
            "Compliance training materials",
        ],
        "compliance_level": "SOC2 Type II + ISO27001 + GDPR + NIS2",
        "gdpr_ready": True,
        "nis2_ready": True,
        "storage_gb": 1000,
        "stripe_price_id": "price_enterprise_elite_eur_monthly",  # Test mode price ID - update with actual Stripe ID
        "requires_payment": True,
    },
}


class SubscriptionService:
    def __init__(self, user_id):
        self.user_id = user_id
        self.user = User.query.get(user_id)
        self.subscription = Subscription.query.filter_by(user_id=user_id).first()

    def create_subscription(self, plan_type):
        """Creates a subscription for the user using compliance-focused tiers."""
        if not self.user:
            raise ValueError("User not found")

        # Map legacy plan types to new compliance-focused tiers
        plan_mapping = {
            'freemium': 'starter',
            'premium_individual': 'compliance_pro',
            'premium_small_business': 'enterprise_risk',
            'premium_large_business': 'enterprise_elite',
            # Also accept new tier names directly
            'starter': 'starter',
            'compliance_pro': 'compliance_pro',
            'enterprise_risk': 'enterprise_risk',
            'enterprise_elite': 'enterprise_elite',
        }

        normalized_plan = plan_mapping.get(plan_type)
        if not normalized_plan:
            raise ValueError(
                f"Invalid plan type: {plan_type}. Valid plans: {', '.join(COMPLIANCE_TIERS.keys())}"
            )

        plan_type = normalized_plan
        plan_prices = {
            tier: config["price_monthly_eur"]
            for tier, config in COMPLIANCE_TIERS.items()
        }

        plan_type = normalized_plan
        plan_prices = {
            tier: config["price_monthly_eur"]
            for tier, config in COMPLIANCE_TIERS.items()
        }

        # Check if the plan_type is valid
        if plan_type not in plan_prices:
            raise ValueError("Invalid plan type")

        # Handle free tier separately
        if plan_type == 'starter':
            # Create a starter subscription directly
            self.subscription = Subscription(
                user_id=self.user_id,
                plan=plan_type,
                start_date=datetime.utcnow(),
                end_date=datetime.utcnow() + timedelta(days=30)  # 30-day free period
            )
            db.session.add(self.subscription)
            db.session.commit()
            return "Starter subscription created successfully."

        # For premium plans, process payment
        amount = plan_prices[plan_type]
        intent = stripe.PaymentIntent.create(
            amount=amount,
            currency='eur',
            payment_method_types=['card'],
        )

        # Save payment intent and subscription data if the payment intent is successful
        if intent.status == 'requires_payment_method':
            # Proceed to process the subscription
            self.subscription = Subscription(
                user_id=self.user_id,
                plan=plan_type,
                payment_status='pending',
                start_date=datetime.utcnow()
            )
            db.session.add(self.subscription)
            db.session.commit()

            # Send the client secret to the front-end to complete payment
            return intent.client_secret

        else:
            raise ValueError("Payment Intent creation failed or status is invalid.")

    def confirm_payment(self, payment_intent_id, payment_method_id):
        """Confirm payment for the subscription."""
        if not self.subscription or self.subscription.payment_status != 'pending':
            raise ValueError("No pending subscription found.")

        # Retrieve the payment intent from Stripe
        payment_intent = stripe.PaymentIntent.confirm(
            payment_intent_id,
            payment_method=payment_method_id
        )

        if payment_intent.status == 'succeeded':
            # Mark subscription as active and update payment status
            self.subscription.payment_status = 'paid'
            self.subscription.end_date = datetime.utcnow() + timedelta(days=30)  # 30-day validity
            db.session.commit()
            return True
        else:
            self.subscription.payment_status = 'failed'
            db.session.commit()
            return False

    def upgrade_subscription(self, new_plan_type):
        """Upgrades the user's subscription to a new compliance tier."""
        if not self.subscription:
            raise ValueError("No existing subscription found.")

        # Accept both legacy and new tier names
        valid_tiers = list(COMPLIANCE_TIERS.keys()) + [
            'premium_individual', 'premium_small_business', 'premium_large_business'
        ]
        if new_plan_type not in valid_tiers:
            raise ValueError(f"Invalid new plan type. Valid tiers: {', '.join(list(COMPLIANCE_TIERS.keys()))}")

        current_plan_type = self.subscription.plan

        if current_plan_type == new_plan_type:
            raise ValueError("Already subscribed to this plan.")

        # Perform subscription upgrade
        self.subscription.plan = new_plan_type
        self.subscription.payment_status = 'pending'
        self.subscription.start_date = datetime.utcnow()
        db.session.commit()

        # Trigger payment for the new plan
        return self.create_subscription(new_plan_type)

    def cancel_subscription(self):
        """Cancels the user's subscription."""
        if not self.subscription:
            raise ValueError("No subscription found to cancel.")

        # Set subscription status to canceled and delete it
        self.subscription.end_date = datetime.utcnow()
        self.subscription.payment_status = 'canceled'
        db.session.commit()
        return True


def get_subscription_status(user):
    if not user.subscription_active:
        return "Inactive"
    if user.subscription_end_date and user.subscription_end_date < datetime.now():
        return "Expired"
    return "Active"

def get_subscription_duration(user):
    if user.subscription_start_date and user.subscription_end_date:
        remaining_days = (user.subscription_end_date - datetime.now()).days
        return remaining_days
    return None


def get_subscription_duration(user):
    subscription = Subscription.query.filter_by(user_id=user.id).first()
    if subscription and subscription.end_date:
        remaining_days = (subscription.end_date - datetime.utcnow()).days
        return max(remaining_days, 0)
    return 0

def get_subscription_status(user):
    subscription = Subscription.query.filter_by(user_id=user.id).first()
    if subscription:
        if getattr(subscription, "is_trial", False):
            return 'Trial'
        elif getattr(subscription, "is_active", False):
            return 'Premium'
        else:
            return 'Starter'
    return 'Starter'


def get_tier_info(plan_type: str) -> dict:
    """Get tier configuration and feature list by plan type."""
    # Handle legacy plan names
    plan_mapping = {
        'freemium': 'starter',
        'premium_individual': 'compliance_pro',
        'premium_small_business': 'enterprise_risk',
        'premium_large_business': 'enterprise_elite',
    }
    normalized_plan = plan_mapping.get(plan_type, plan_type)

    if normalized_plan not in COMPLIANCE_TIERS:
        return None

    return COMPLIANCE_TIERS[normalized_plan]


def get_compliance_level(user) -> str:
    """
    Return compliance readiness level for user's current tier.
    Used for dashboard badge and compliance checklists.
    """
    subscription = Subscription.query.filter_by(user_id=user.id).first()
    if not subscription:
        return "None"

    tier_info = get_tier_info(subscription.plan)
    if tier_info:
        return tier_info.get("compliance_level", "None")

    return "None"