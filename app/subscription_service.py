import stripe
from datetime import timedelta, datetime
from app.models import db, User, Subscription
from app import db


class SubscriptionService:
    def __init__(self, user_id):
        self.user_id = user_id
        self.user = User.query.get(user_id)
        self.subscription = Subscription.query.filter_by(user_id=user_id).first()

    def create_subscription(self, plan_type):
        """Creates a subscription for the user."""
        if not self.user:
            raise ValueError("User not found")

        # Define the pricing and plans
        plan_prices = {
            'freemium': 0,  # Freemium is free
            'premium_individual': 100,  # 1 EUR in cents
            'premium_small_business': 200,  # 2 EUR in cents
            'premium_large_business': 300  # 3 EUR in cents
        }

        # Check if the plan_type is valid
        if plan_type not in plan_prices:
            raise ValueError("Invalid plan type")

        # Handle freemium plan separately
        if plan_type == 'freemium':
            # Create a freemium subscription directly
            self.subscription = Subscription(
                user_id=self.user_id,
                plan=plan_type,
                start_date=datetime.utcnow(),
                end_date=datetime.utcnow() + timedelta(days=30)  # 30-day free period
            )
            db.session.add(self.subscription)
            db.session.commit()
            return "Freemium subscription created successfully."

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
        """Upgrades the user's subscription to a new plan."""
        if not self.subscription:
            raise ValueError("No existing subscription found.")

        if new_plan_type not in ['premium_individual', 'premium_small_business', 'premium_large_business']:
            raise ValueError("Invalid new plan type.")

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
            return 'Freemium'
    return 'Freemium'