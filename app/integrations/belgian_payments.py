"""
Belgian Payment Methods Integration

Handles all Belgian payment methods:
- Bancontact (most popular in Belgium)
- SEPA Direct Debit (recurring payments)
- Credit/Debit Cards via Stripe
- PayPal
- Manual bank transfers (IBAN)

VAT Handling:
- Standard rate: 21%
- Reduced rate: 6% (books, food, etc)
- Super-reduced: 0% (medicines, etc)
"""

import stripe
from flask import current_app
from app.models import db, User, Subscription, BillingTransaction, BillingStatus
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class BelgianPaymentProcessor:
    """
    Handles Belgian payment processing with all local payment methods.
    """
    
    # VAT rates for Belgium
    VAT_RATES = {
        'standard': 0.21,      # 21% - default rate
        'reduced': 0.06,       # 6% - books, food, etc
        'super_reduced': 0.00, # 0% - medicines, etc
    }
    
    # Belgian IBAN country code
    IBAN_COUNTRY = 'BE'
    
    # Supported payment methods
    PAYMENT_METHODS = {
        'bancontact': 'Bancontact',
        'sepa_debit': 'SEPA Direct Debit',
        'card': 'Credit/Debit Card',
        'paypal': 'PayPal',
        'bank_transfer': 'Bank Transfer',
    }
    
    def __init__(self):
        pass
    
    def _ensure_stripe_key(self):
        """Ensure Stripe API key is set before making requests."""
        if not stripe.api_key:
            stripe.api_key = current_app.config.get('STRIPE_API_KEY')
    
    # ========== BANCONTACT ==========
    
    def create_bancontact_payment(self, user_id, amount_minor, description):
        """
        Create a Bancontact payment (popular in Belgium).
        
        Args:
            user_id: User ID
            amount_minor: Amount in cents (e.g., 2990 for €29.90)
            description: Payment description
            
        Returns:
            Payment intent or redirect URL
        """
        self._ensure_stripe_key()
        try:
            user = User.query.get(user_id)
            if not user:
                logger.error(f"User {user_id} not found for Bancontact payment")
                return None
            
            # Create payment method
            payment_intent = stripe.PaymentIntent.create(
                amount=amount_minor,
                currency='eur',
                payment_method_types=['bancontact'],
                description=description,
                metadata={
                    'user_id': user_id,
                    'payment_method': 'bancontact',
                    'country': 'BE',
                }
            )
            
            logger.info(f"Bancontact payment intent created: {payment_intent.id} for user {user_id}")
            return payment_intent
            
        except stripe.error.StripeError as e:
            logger.error(f"Bancontact payment error: {str(e)}")
            return None
    
    def confirm_bancontact_payment(self, payment_intent_id, user_id, subscription_id=None):
        """
        Confirm and process a Bancontact payment.
        """
        try:
            user = User.query.get(user_id)
            intent = stripe.PaymentIntent.retrieve(payment_intent_id)
            
            if intent.status == 'succeeded':
                # Log successful transaction
                txn = BillingTransaction(
                    user_id=user_id,
                    status=BillingStatus.SUCCEEDED,
                    provider='stripe',
                    provider_txn_id=payment_intent_id,
                    amount_minor=intent.amount,
                    currency='eur',
                    payment_method='bancontact',
                )
                db.session.add(txn)
                
                # Extend subscription if applicable
                if subscription_id:
                    subscription = Subscription.query.get(subscription_id)
                    if subscription:
                        subscription.end_date += timedelta(days=30)
                        subscription.last_payment_date = datetime.utcnow()
                
                db.session.commit()
                logger.info(f"Bancontact payment confirmed for user {user_id}: €{intent.amount/100:.2f}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error confirming Bancontact payment: {str(e)}")
            return False
    
    # ========== SEPA DIRECT DEBIT ==========
    
    def create_sepa_mandate(self, user_id, iban, customer_email):
        """
        Create a SEPA Direct Debit mandate for recurring payments.
        
        Args:
            user_id: User ID
            iban: Customer's IBAN (must be Belgian format)
            customer_email: Customer email
            
        Returns:
            Mandate details or None
        """
        try:
            # Validate IBAN format
            if not self._validate_iban(iban):
                logger.error(f"Invalid IBAN format: {iban}")
                return None
            
            user = User.query.get(user_id)
            
            # Create or get Stripe customer
            if not user.stripe_customer_id:
                customer = stripe.Customer.create(
                    email=customer_email,
                    name=user.username,
                    metadata={'user_id': user_id, 'country': 'BE'}
                )
                user.stripe_customer_id = customer.id
                db.session.commit()
            else:
                customer = stripe.Customer.retrieve(user.stripe_customer_id)
            
            # Create bank account token
            bank_account_token = stripe.Token.create(
                bank_account={
                    'country': 'BE',
                    'currency': 'eur',
                    'account_holder_name': user.username,
                    'account_holder_type': 'individual',
                    'routing_number': self._extract_bank_code(iban),  # BIC code
                    'account_number': iban,
                }
            )
            
            # Create payment method
            payment_method = stripe.PaymentMethod.create(
                type='sepa_debit',
                sepa_debit={
                    'iban': iban,
                },
                billing_details={
                    'name': user.username,
                    'email': customer_email,
                }
            )
            
            # Attach to customer
            stripe.PaymentMethod.attach(
                payment_method.id,
                customer=customer.id
            )
            
            # Set as default payment method
            stripe.Customer.modify(
                customer.id,
                invoice_settings={
                    'default_payment_method': payment_method.id
                }
            )
            
            # Store mandate info
            user.sepa_mandate_id = payment_method.id
            user.sepa_iban_last4 = iban[-4:]
            db.session.commit()
            
            logger.info(f"SEPA mandate created for user {user_id}: {iban[-4:]}...")
            
            return {
                'mandate_id': payment_method.id,
                'customer_id': customer.id,
                'iban_last4': iban[-4:],
                'status': 'active',
            }
            
        except stripe.error.StripeError as e:
            logger.error(f"SEPA mandate creation error: {str(e)}")
            return None
    
    def charge_sepa_mandate(self, user_id, amount_minor, description):
        """
        Charge a customer using their SEPA mandate.
        """
        try:
            user = User.query.get(user_id)
            
            if not user.stripe_customer_id or not user.sepa_mandate_id:
                logger.error(f"User {user_id} missing SEPA mandate or customer ID")
                return None
            
            # Create payment intent with SEPA
            payment_intent = stripe.PaymentIntent.create(
                amount=amount_minor,
                currency='eur',
                customer=user.stripe_customer_id,
                payment_method=user.sepa_mandate_id,
                off_session=True,
                confirm=True,
                description=description,
                metadata={
                    'user_id': user_id,
                    'payment_method': 'sepa_debit',
                    'country': 'BE',
                }
            )
            
            if payment_intent.status == 'succeeded':
                logger.info(f"SEPA payment succeeded for user {user_id}: €{amount_minor/100:.2f}")
                return payment_intent
            
            logger.warning(f"SEPA payment pending for user {user_id}: {payment_intent.status}")
            return payment_intent
            
        except stripe.error.StripeError as e:
            logger.error(f"SEPA charge error: {str(e)}")
            return None
    
    def revoke_sepa_mandate(self, user_id):
        """Revoke a SEPA mandate."""
        try:
            user = User.query.get(user_id)
            
            if user.sepa_mandate_id:
                stripe.PaymentMethod.detach(user.sepa_mandate_id)
                user.sepa_mandate_id = None
                user.sepa_iban_last4 = None
                db.session.commit()
                
                logger.info(f"SEPA mandate revoked for user {user_id}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error revoking SEPA mandate: {str(e)}")
            return False
    
    # ========== PAYPAL INTEGRATION ==========
    
    def create_paypal_payment(self, user_id, amount_minor, description, return_url):
        """
        Create a PayPal payment link.
        
        Args:
            user_id: User ID
            amount_minor: Amount in cents
            description: Payment description
            return_url: URL to return after payment
            
        Returns:
            PayPal approval link or None
        """
        try:
            user = User.query.get(user_id)
            
            # Create payment via Stripe (supports PayPal)
            payment_intent = stripe.PaymentIntent.create(
                amount=amount_minor,
                currency='eur',
                payment_method_types=['paypal'],
                description=description,
                metadata={
                    'user_id': user_id,
                    'payment_method': 'paypal',
                    'country': 'BE',
                }
            )
            
            logger.info(f"PayPal payment intent created: {payment_intent.id}")
            return payment_intent
            
        except stripe.error.StripeError as e:
            logger.error(f"PayPal payment error: {str(e)}")
            return None
    
    # ========== BANK TRANSFER ==========
    
    def generate_bank_transfer_details(self, user_id, amount_minor, invoice_number):
        """
        Generate bank transfer details for manual payment.
        
        Returns:
            Bank transfer details including IBAN, BIC, reference
        """
        user = User.query.get(user_id)
        
        # Your company's bank details (should be in config)
        company_iban = current_app.config.get('COMPANY_IBAN', 'BE00000000000000000000')
        company_bic = current_app.config.get('COMPANY_BIC', 'GEBABEBB')
        company_name = current_app.config.get('COMPANY_NAME', 'GueInsight')
        
        # Payment reference (invoice number)
        payment_reference = f"INV-{invoice_number}"
        
        transfer_details = {
            'recipient_name': company_name,
            'iban': company_iban,
            'bic': company_bic,
            'amount': f"€{amount_minor/100:.2f}",
            'currency': 'EUR',
            'reference': payment_reference,
            'description': f"Subscription renewal - Invoice {invoice_number}",
            'user_name': user.username,
        }
        
        logger.info(f"Bank transfer details generated for user {user_id}")
        return transfer_details
    
    def log_bank_transfer_intent(self, user_id, amount_minor, invoice_number):
        """
        Log a bank transfer payment intent (manual tracking).
        """
        try:
            txn = BillingTransaction(
                user_id=user_id,
                status=BillingStatus.PENDING,
                provider='bank_transfer',
                provider_txn_id=f"TRANSFER-{invoice_number}",
                amount_minor=amount_minor,
                currency='eur',
                payment_method='bank_transfer',
                notes=f"Awaiting bank transfer for invoice {invoice_number}",
            )
            db.session.add(txn)
            db.session.commit()
            
            logger.info(f"Bank transfer intent logged for user {user_id}: €{amount_minor/100:.2f}")
            return txn.id
            
        except Exception as e:
            logger.error(f"Error logging bank transfer: {str(e)}")
            return None
    
    def confirm_bank_transfer(self, transaction_id, reference_code):
        """
        Confirm a bank transfer was received.
        """
        try:
            txn = BillingTransaction.query.get(transaction_id)
            if not txn:
                return False
            
            txn.status = BillingStatus.SUCCEEDED
            txn.provider_txn_id = reference_code
            txn.updated_at = datetime.utcnow()
            
            # Extend subscription
            subscription = Subscription.query.filter_by(user_id=txn.user_id).first()
            if subscription:
                subscription.end_date += timedelta(days=30)
                subscription.last_payment_date = datetime.utcnow()
            
            db.session.commit()
            logger.info(f"Bank transfer confirmed: {reference_code}")
            return True
            
        except Exception as e:
            logger.error(f"Error confirming bank transfer: {str(e)}")
            return False
    
    # ========== VAT CALCULATION ==========
    
    def calculate_vat(self, amount_minor, vat_rate='standard', country_code='BE'):
        """
        Calculate VAT for Belgium.
        
        Args:
            amount_minor: Net amount in cents
            vat_rate: 'standard', 'reduced', or 'super_reduced'
            country_code: Country code (for future multi-country support)
            
        Returns:
            {'net': amount_minor, 'vat': vat_amount, 'total': total_amount}
        """
        rate = self.VAT_RATES.get(vat_rate, self.VAT_RATES['standard'])
        vat_amount = int(amount_minor * rate)
        total = amount_minor + vat_amount
        
        return {
            'net': amount_minor,
            'vat_amount': vat_amount,
            'vat_rate': rate,
            'total': total,
            'vat_rate_percent': int(rate * 100),
        }
    
    def format_vat_breakdown(self, amount_minor, vat_rate='standard'):
        """
        Format VAT breakdown for display on invoices.
        """
        calc = self.calculate_vat(amount_minor, vat_rate)
        
        return {
            'net_amount': f"€{calc['net']/100:.2f}",
            'vat_rate': f"{calc['vat_rate_percent']}%",
            'vat_amount': f"€{calc['vat_amount']/100:.2f}",
            'total_amount': f"€{calc['total']/100:.2f}",
        }
    
    # ========== VALIDATION HELPERS ==========
    
    def _validate_iban(self, iban):
        """
        Validate IBAN format for Belgium.
        Belgian IBAN format: BE + 2 check digits + 3-digit bank code + 7-digit account
        """
        iban = iban.replace(' ', '').upper()
        
        if not iban.startswith('BE'):
            return False
        
        if len(iban) != 16:  # BE + 14 digits
            return False
        
        if not iban[2:].isdigit():
            return False
        
        return True
    
    def _extract_bank_code(self, iban):
        """Extract BIC code from IBAN (simplified)."""
        # In reality, you'd use a database mapping IBANs to BICs
        # For now, return a placeholder
        return 'GEBABEBB'  # Generic Belgian BIC


class BelgianInvoiceGenerator:
    """
    Generates Belgian-compliant e-invoices (UBL-BE for B2B, PDF for B2C).
    """
    
    def __init__(self):
        self._payment_processor = None
    
    @property
    def payment_processor(self):
        """Lazy-load payment processor."""
        if self._payment_processor is None:
            self._payment_processor = BelgianPaymentProcessor()
        return self._payment_processor
    
    def generate_invoice_data(self, user_id, subscription_id, invoice_number, 
                             invoice_date, due_date, items, vat_rate='standard',
                             is_b2b=False, customer_tax_id=None):
        """
        Generate invoice data structure (can be converted to UBL-BE or PDF).
        
        Args:
            items: List of {'description': str, 'amount_minor': int, 'quantity': int}
            is_b2b: Whether this is B2B (requires UBL-BE format)
            customer_tax_id: Customer's VAT number (for B2B)
        """
        user = User.query.get(user_id)
        subscription = Subscription.query.get(subscription_id)
        
        # Calculate totals
        subtotal = sum(item['amount_minor'] * item.get('quantity', 1) for item in items)
        vat_calc = self.payment_processor.calculate_vat(subtotal, vat_rate)
        
        # Company details (from config)
        company = {
            'name': current_app.config.get('COMPANY_NAME', 'GueInsight'),
            'address': current_app.config.get('COMPANY_ADDRESS', ''),
            'city': current_app.config.get('COMPANY_CITY', ''),
            'postal_code': current_app.config.get('COMPANY_POSTAL_CODE', ''),
            'country': 'BE',
            'vat_number': current_app.config.get('COMPANY_VAT_NUMBER', ''),
            'iban': current_app.config.get('COMPANY_IBAN', ''),
            'bic': current_app.config.get('COMPANY_BIC', ''),
        }
        
        # Customer details
        customer = {
            'name': user.username,
            'email': user.email,
            'address': user.address or 'N/A',
            'city': user.city or 'N/A',
            'postal_code': user.postal_code or 'N/A',
            'country': 'BE',
            'vat_number': customer_tax_id or '',
        }
        
        invoice_data = {
            'invoice_number': invoice_number,
            'invoice_date': invoice_date.isoformat(),
            'due_date': due_date.isoformat(),
            'company': company,
            'customer': customer,
            'items': items,
            'subtotal': subtotal,
            'vat_rate': vat_rate,
            'vat_rate_percent': int(self.payment_processor.VAT_RATES.get(vat_rate, 0.21) * 100),
            'vat_amount': vat_calc['vat_amount'],
            'total': vat_calc['total'],
            'currency': 'EUR',
            'payment_terms': '30 days',
            'payment_method': subscription.payment_method if subscription else 'card',
            'is_b2b': is_b2b,
            'language': 'en',  # Can be extended for multi-language
        }
        
        return invoice_data
    
    def generate_ubl_be_xml(self, invoice_data):
        """
        Generate UBL-BE XML invoice for B2B transactions.
        
        Returns:
            XML string in UBL-BE format
        """
        from datetime import datetime
        
        xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
    
    <!-- Invoice Metadata -->
    <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
    <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
    <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
    <cbc:ID>{invoice_data['invoice_number']}</cbc:ID>
    <cbc:IssueDate>{invoice_data['invoice_date'][:10]}</cbc:IssueDate>
    <cbc:DueDate>{invoice_data['due_date'][:10]}</cbc:DueDate>
    <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
    <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
    
    <!-- Supplier (Your Company) -->
    <cac:AccountingSupplierParty>
        <cac:Party>
            <cbc:EndpointID schemeID="0201">{invoice_data['company']['vat_number']}</cbc:EndpointID>
            <cac:PartyIdentification>
                <cbc:ID schemeID="0201">{invoice_data['company']['vat_number']}</cbc:ID>
            </cac:PartyIdentification>
            <cac:PartyName>
                <cbc:Name>{invoice_data['company']['name']}</cbc:Name>
            </cac:PartyName>
            <cac:PostalAddress>
                <cbc:StreetName>{invoice_data['company']['address']}</cbc:StreetName>
                <cbc:CityName>{invoice_data['company']['city']}</cbc:CityName>
                <cbc:PostalZone>{invoice_data['company']['postal_code']}</cbc:PostalZone>
                <cac:Country>
                    <cbc:IdentificationCode>{invoice_data['company']['country']}</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            <cac:PartyTaxScheme>
                <cbc:CompanyID>{invoice_data['company']['vat_number']}</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>
        </cac:Party>
    </cac:AccountingSupplierParty>
    
    <!-- Buyer (Customer) -->
    <cac:AccountingCustomerParty>
        <cac:Party>
            <cac:PartyIdentification>
                <cbc:ID schemeID="0201">{invoice_data['customer'].get('vat_number', '')}</cbc:ID>
            </cac:PartyIdentification>
            <cac:PartyName>
                <cbc:Name>{invoice_data['customer']['name']}</cbc:Name>
            </cac:PartyName>
            <cac:PostalAddress>
                <cbc:StreetName>{invoice_data['customer']['address']}</cbc:StreetName>
                <cbc:CityName>{invoice_data['customer']['city']}</cbc:CityName>
                <cbc:PostalZone>{invoice_data['customer']['postal_code']}</cbc:PostalZone>
                <cac:Country>
                    <cbc:IdentificationCode>{invoice_data['customer']['country']}</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
        </cac:Party>
    </cac:AccountingCustomerParty>
    
    <!-- Line Items -->
    <cac:InvoiceLine>
        <cbc:ID>1</cbc:ID>
        <cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="EUR">{invoice_data['subtotal']/100:.2f}</cbc:LineExtensionAmount>
        <cac:Item>
            <cbc:Description>{', '.join([item['description'] for item in invoice_data['items']])}</cbc:Description>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="EUR">{invoice_data['subtotal']/100:.2f}</cbc:PriceAmount>
        </cac:Price>
    </cac:InvoiceLine>
    
    <!-- Totals -->
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="EUR">{invoice_data['vat_amount']/100:.2f}</cbc:TaxAmount>
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="EUR">{invoice_data['subtotal']/100:.2f}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="EUR">{invoice_data['vat_amount']/100:.2f}</cbc:TaxAmount>
            <cac:TaxCategory>
                <cbc:ID>{invoice_data['vat_rate_percent']}</cbc:ID>
                <cbc:Percent>{invoice_data['vat_rate_percent']}</cbc:Percent>
            </cac:TaxCategory>
        </cac:TaxSubtotal>
    </cac:TaxTotal>
    
    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="EUR">{invoice_data['subtotal']/100:.2f}</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="EUR">{invoice_data['subtotal']/100:.2f}</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="EUR">{invoice_data['total']/100:.2f}</cbc:TaxInclusiveAmount>
        <cbc:AmountDueOnAccount currencyID="EUR">{invoice_data['total']/100:.2f}</cbc:AmountDueOnAccount>
    </cac:LegalMonetaryTotal>
    
    <!-- Payment Terms -->
    <cac:PaymentTerms>
        <cbc:Note>Payment due within {invoice_data['payment_terms']}</cbc:Note>
    </cac:PaymentTerms>
    
</Invoice>
"""
        return xml
    
    def generate_invoice_summary(self, invoice_data):
        """
        Generate a human-readable invoice summary.
        """
        summary = f"""
INVOICE #{invoice_data['invoice_number']}
{'=' * 60}

From:
{invoice_data['company']['name']}
{invoice_data['company']['address']}
{invoice_data['company']['postal_code']} {invoice_data['company']['city']}
{invoice_data['company']['country']}
VAT: {invoice_data['company']['vat_number']}
IBAN: {invoice_data['company']['iban']}

Bill To:
{invoice_data['customer']['name']}
{invoice_data['customer']['address']}
{invoice_data['customer']['postal_code']} {invoice_data['customer']['city']}
{invoice_data['customer']['country']}

Invoice Date: {invoice_data['invoice_date'][:10]}
Due Date: {invoice_data['due_date'][:10]}
Currency: {invoice_data['currency']}

{'Description':<40} {'Amount':>15}
{'-' * 55}
{chr(10).join(f"{item['description']:<40} €{item['amount_minor']/100:>14.2f}" for item in invoice_data['items'])}

{'-' * 55}
Subtotal:                                €{invoice_data['subtotal']/100:>14.2f}
VAT ({invoice_data['vat_rate_percent']}%):                              €{invoice_data['vat_amount']/100:>14.2f}
TOTAL:                                   €{invoice_data['total']/100:>14.2f}

Payment Method: {invoice_data['payment_method']}
Payment Terms: {invoice_data['payment_terms']}
"""
        return summary
