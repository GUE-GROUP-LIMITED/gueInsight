"""
Belgian Payment Routes

Endpoints for all Belgian payment methods:
- GET /belgium/payment-methods - List available payment methods
- POST /belgium/checkout - Start payment process
- POST /belgium/bancontact/create - Create Bancontact payment
- POST /belgium/sepa-mandate - Register SEPA mandate
- POST /belgium/sepa/charge - Charge via SEPA
- POST /belgium/sepa/revoke - Revoke SEPA mandate
- POST /belgium/bank-transfer/initiate - Generate bank transfer details
- POST /belgium/bank-transfer/confirm - Confirm received transfer
- GET /belgium/invoices/<id> - Get invoice (PDF or UBL-BE XML)
- POST /belgium/invoices/generate - Generate new invoice
- GET /belgium/vat-rates - Get current VAT rates
"""

from flask import Blueprint, request, jsonify, current_app, send_file
from flask_login import login_required, current_user
from app.models import db, User, Subscription, BillingTransaction, BillingStatus
from app.integrations.belgian_payments import BelgianPaymentProcessor, BelgianInvoiceGenerator
from datetime import datetime, timedelta
import logging
from io import BytesIO

belgian_bp = Blueprint('belgian', __name__, url_prefix='/belgium')
logger = logging.getLogger(__name__)

payment_processor = BelgianPaymentProcessor()
invoice_generator = BelgianInvoiceGenerator()


# ========== PAYMENT METHODS ==========

@belgian_bp.route('/payment-methods', methods=['GET'])
@login_required
def get_payment_methods():
    """
    Get available payment methods for Belgium.
    """
    return jsonify({
        'country': 'Belgium',
        'currency': 'EUR',
        'payment_methods': [
            {
                'id': 'bancontact',
                'name': 'Bancontact',
                'description': 'Most popular payment method in Belgium',
                'icon': 'bancontact',
                'supported_for': ['one_time', 'subscription'],
                'processing_time': 'Immediate',
            },
            {
                'id': 'sepa_debit',
                'name': 'SEPA Direct Debit',
                'description': 'Automated bank transfers (€) with mandate',
                'icon': 'bank',
                'supported_for': ['subscription'],
                'processing_time': '1-2 business days',
                'setup_required': True,
            },
            {
                'id': 'card',
                'name': 'Credit/Debit Card',
                'description': 'Visa, Mastercard, American Express',
                'icon': 'credit-card',
                'supported_for': ['one_time', 'subscription'],
                'processing_time': 'Immediate',
            },
            {
                'id': 'paypal',
                'name': 'PayPal',
                'description': 'PayPal account payment',
                'icon': 'paypal',
                'supported_for': ['one_time', 'subscription'],
                'processing_time': 'Immediate',
            },
            {
                'id': 'bank_transfer',
                'name': 'Bank Transfer',
                'description': 'Manual SEPA bank transfer (reference provided)',
                'icon': 'bank-transfer',
                'supported_for': ['one_time'],
                'processing_time': '1-3 business days',
            },
        ],
        'vat_rate': '21%',  # Standard rate for Belgium
        'languages': ['en', 'fr', 'nl', 'de'],
    })


# ========== BANCONTACT ==========

@belgian_bp.route('/bancontact/create', methods=['POST'])
@login_required
def create_bancontact_payment():
    """Create a Bancontact payment."""
    try:
        data = request.get_json()
        amount_minor = data.get('amount_minor')  # In cents
        description = data.get('description', f'Payment for {current_user.username}')
        subscription_id = data.get('subscription_id')
        
        if not amount_minor or amount_minor <= 0:
            return jsonify({'error': 'Invalid amount'}), 400
        
        # Create payment
        payment_intent = payment_processor.create_bancontact_payment(
            current_user.id,
            amount_minor,
            description
        )
        
        if not payment_intent:
            return jsonify({'error': 'Failed to create payment'}), 500
        
        return jsonify({
            'status': 'success',
            'payment_intent_id': payment_intent.id,
            'amount': f"€{payment_intent.amount/100:.2f}",
            'currency': 'EUR',
            'payment_method': 'bancontact',
            'client_secret': payment_intent.client_secret,
            'redirect_url': f"{current_app.config.get('FRONTEND_URL')}/payment/bancontact/{payment_intent.id}",
        })
        
    except Exception as e:
        logger.error(f"Bancontact payment creation error: {str(e)}")
        return jsonify({'error': 'Payment creation failed'}), 500


@belgian_bp.route('/bancontact/confirm/<payment_intent_id>', methods=['POST'])
@login_required
def confirm_bancontact_payment(payment_intent_id):
    """Confirm a Bancontact payment."""
    try:
        data = request.get_json()
        subscription_id = data.get('subscription_id')
        
        success = payment_processor.confirm_bancontact_payment(
            payment_intent_id,
            current_user.id,
            subscription_id
        )
        
        if success:
            return jsonify({
                'status': 'success',
                'message': 'Payment confirmed successfully',
            })
        else:
            return jsonify({'error': 'Payment not yet confirmed'}), 400
            
    except Exception as e:
        logger.error(f"Error confirming Bancontact payment: {str(e)}")
        return jsonify({'error': 'Confirmation failed'}), 500


# ========== SEPA DIRECT DEBIT ==========

@belgian_bp.route('/sepa-mandate', methods=['POST'])
@login_required
def register_sepa_mandate():
    """
    Register a SEPA Direct Debit mandate.
    
    Request:
    {
        "iban": "BE00000000000000",
        "confirm": true
    }
    """
    try:
        data = request.get_json()
        iban = data.get('iban', '').upper().replace(' ', '')
        
        if not iban:
            return jsonify({'error': 'IBAN required'}), 400
        
        # Validate IBAN
        if not iban.startswith('BE') or len(iban) != 16:
            return jsonify({
                'error': 'Invalid Belgian IBAN',
                'format_hint': 'BEXX XXXX XXXX XXXX (16 characters)'
            }), 400
        
        # Create mandate
        mandate = payment_processor.create_sepa_mandate(
            current_user.id,
            iban,
            current_user.email
        )
        
        if not mandate:
            return jsonify({'error': 'Failed to create SEPA mandate'}), 500
        
        return jsonify({
            'status': 'success',
            'message': 'SEPA mandate registered successfully',
            'mandate_id': mandate['mandate_id'],
            'customer_id': mandate['customer_id'],
            'iban_last4': mandate['iban_last4'],
            'mandate_confirmed': True,
        })
        
    except Exception as e:
        logger.error(f"SEPA mandate error: {str(e)}")
        return jsonify({'error': 'Mandate registration failed'}), 500


@belgian_bp.route('/sepa/charge', methods=['POST'])
@login_required
def charge_sepa_mandate():
    """
    Charge a customer using their SEPA mandate.
    
    Request:
    {
        "amount_minor": 2990,
        "description": "Monthly subscription - Compliance Pro"
    }
    """
    try:
        data = request.get_json()
        amount_minor = data.get('amount_minor')
        description = data.get('description', 'Subscription renewal')
        
        if not amount_minor or amount_minor <= 0:
            return jsonify({'error': 'Invalid amount'}), 400
        
        # Check if mandate exists
        if not current_user.sepa_mandate_id:
            return jsonify({
                'error': 'No SEPA mandate registered',
                'setup_url': '/belgium/sepa-mandate'
            }), 400
        
        # Charge via SEPA
        payment_intent = payment_processor.charge_sepa_mandate(
            current_user.id,
            amount_minor,
            description
        )
        
        if not payment_intent:
            return jsonify({'error': 'SEPA charge failed'}), 500
        
        return jsonify({
            'status': 'success' if payment_intent.status == 'succeeded' else 'pending',
            'payment_intent_id': payment_intent.id,
            'amount': f"€{payment_intent.amount/100:.2f}",
            'currency': 'EUR',
            'payment_method': 'sepa_debit',
            'message': 'Payment processing...' if payment_intent.status != 'succeeded' else 'Payment successful!',
        })
        
    except Exception as e:
        logger.error(f"SEPA charge error: {str(e)}")
        return jsonify({'error': 'Charge failed'}), 500


@belgian_bp.route('/sepa/revoke', methods=['POST'])
@login_required
def revoke_sepa_mandate():
    """Revoke the SEPA mandate."""
    try:
        success = payment_processor.revoke_sepa_mandate(current_user.id)
        
        if success:
            return jsonify({
                'status': 'success',
                'message': 'SEPA mandate revoked successfully',
            })
        else:
            return jsonify({'error': 'No SEPA mandate to revoke'}), 400
            
    except Exception as e:
        logger.error(f"Error revoking SEPA mandate: {str(e)}")
        return jsonify({'error': 'Revocation failed'}), 500


# ========== BANK TRANSFER ==========

@belgian_bp.route('/bank-transfer/initiate', methods=['POST'])
@login_required
def initiate_bank_transfer():
    """
    Generate bank transfer details for manual payment.
    
    Request:
    {
        "amount_minor": 2990,
        "invoice_number": "INV-2026-001"
    }
    """
    try:
        data = request.get_json()
        amount_minor = data.get('amount_minor')
        invoice_number = data.get('invoice_number', f"INV-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}")
        
        if not amount_minor or amount_minor <= 0:
            return jsonify({'error': 'Invalid amount'}), 400
        
        # Generate transfer details
        details = payment_processor.generate_bank_transfer_details(
            current_user.id,
            amount_minor,
            invoice_number
        )
        
        # Log the intent
        txn_id = payment_processor.log_bank_transfer_intent(
            current_user.id,
            amount_minor,
            invoice_number
        )
        
        return jsonify({
            'status': 'success',
            'transaction_id': txn_id,
            'bank_transfer': details,
            'message': f'Please transfer €{amount_minor/100:.2f} to the account below with reference: {details["reference"]}',
        })
        
    except Exception as e:
        logger.error(f"Bank transfer initiation error: {str(e)}")
        return jsonify({'error': 'Failed to generate transfer details'}), 500


@belgian_bp.route('/bank-transfer/confirm', methods=['POST'])
@login_required
def confirm_bank_transfer():
    """
    Confirm a bank transfer was received.
    
    Request:
    {
        "transaction_id": 123,
        "reference_code": "TRANSFER-INV-2026-001"
    }
    """
    try:
        data = request.get_json()
        transaction_id = data.get('transaction_id')
        reference_code = data.get('reference_code')
        
        if not transaction_id or not reference_code:
            return jsonify({'error': 'Transaction ID and reference code required'}), 400
        
        success = payment_processor.confirm_bank_transfer(transaction_id, reference_code)
        
        if success:
            return jsonify({
                'status': 'success',
                'message': 'Bank transfer confirmed and subscription extended',
            })
        else:
            return jsonify({'error': 'Transaction not found or already confirmed'}), 400
            
    except Exception as e:
        logger.error(f"Bank transfer confirmation error: {str(e)}")
        return jsonify({'error': 'Confirmation failed'}), 500


# ========== INVOICING ==========

@belgian_bp.route('/invoices/generate', methods=['POST'])
@login_required
def generate_invoice():
    """
    Generate a new e-invoice (PDF or UBL-BE XML).
    
    Request:
    {
        "subscription_id": 123,
        "items": [
            {"description": "Compliance Pro Monthly", "amount_minor": 2990, "quantity": 1}
        ],
        "is_b2b": false,
        "vat_rate": "standard"
    }
    """
    try:
        data = request.get_json()
        subscription_id = data.get('subscription_id')
        items = data.get('items', [])
        is_b2b = data.get('is_b2b', False)
        vat_rate = data.get('vat_rate', 'standard')
        customer_tax_id = data.get('customer_tax_id')
        
        if not items:
            return jsonify({'error': 'Items required'}), 400
        
        subscription = Subscription.query.get(subscription_id)
        if not subscription or subscription.user_id != current_user.id:
            return jsonify({'error': 'Subscription not found'}), 404
        
        # Generate invoice number
        invoice_number = f"INV-{datetime.utcnow().strftime('%Y%m%d')}-{subscription_id}"
        invoice_date = datetime.utcnow()
        due_date = invoice_date + timedelta(days=30)
        
        # Generate invoice data
        invoice_data = invoice_generator.generate_invoice_data(
            current_user.id,
            subscription_id,
            invoice_number,
            invoice_date,
            due_date,
            items,
            vat_rate,
            is_b2b,
            customer_tax_id
        )
        
        return jsonify({
            'status': 'success',
            'invoice_number': invoice_number,
            'invoice_date': invoice_date.isoformat(),
            'due_date': due_date.isoformat(),
            'total': f"€{invoice_data['total']/100:.2f}",
            'vat_breakdown': invoice_generator.payment_processor.format_vat_breakdown(
                sum(item['amount_minor'] * item.get('quantity', 1) for item in items),
                vat_rate
            ),
            'download_links': {
                'pdf': f"/belgium/invoices/{invoice_number}/pdf",
                'ubl_xml': f"/belgium/invoices/{invoice_number}/xml" if is_b2b else None,
            }
        })
        
    except Exception as e:
        logger.error(f"Invoice generation error: {str(e)}")
        return jsonify({'error': 'Failed to generate invoice'}), 500


@belgian_bp.route('/invoices/<invoice_number>/xml', methods=['GET'])
@login_required
def get_invoice_xml(invoice_number):
    """Download invoice as UBL-BE XML (for B2B)."""
    try:
        # Parse invoice number to get subscription
        parts = invoice_number.split('-')
        subscription_id = int(parts[-1])
        
        subscription = Subscription.query.get(subscription_id)
        if not subscription or subscription.user_id != current_user.id:
            return jsonify({'error': 'Invoice not found'}), 404
        
        # Generate invoice data (simplified for demo)
        items = [{'description': f'{subscription.plan} subscription', 'amount_minor': 2990, 'quantity': 1}]
        invoice_data = invoice_generator.generate_invoice_data(
            current_user.id,
            subscription_id,
            invoice_number,
            datetime.utcnow(),
            datetime.utcnow() + timedelta(days=30),
            items,
            is_b2b=True
        )
        
        # Generate UBL-BE XML
        xml_content = invoice_generator.generate_ubl_be_xml(invoice_data)
        
        return send_file(
            BytesIO(xml_content.encode('utf-8')),
            mimetype='application/xml',
            as_attachment=True,
            download_name=f'{invoice_number}.xml'
        )
        
    except Exception as e:
        logger.error(f"XML invoice error: {str(e)}")
        return jsonify({'error': 'Failed to generate XML invoice'}), 500


@belgian_bp.route('/invoices/<invoice_number>/pdf', methods=['GET'])
@login_required
def get_invoice_pdf(invoice_number):
    """Download invoice as PDF."""
    try:
        # Parse invoice number to get subscription
        parts = invoice_number.split('-')
        subscription_id = int(parts[-1])
        
        subscription = Subscription.query.get(subscription_id)
        if not subscription or subscription.user_id != current_user.id:
            return jsonify({'error': 'Invoice not found'}), 404
        
        # Generate invoice data
        items = [{'description': f'{subscription.plan} subscription', 'amount_minor': 2990, 'quantity': 1}]
        invoice_data = invoice_generator.generate_invoice_data(
            current_user.id,
            subscription_id,
            invoice_number,
            datetime.utcnow(),
            datetime.utcnow() + timedelta(days=30),
            items
        )
        
        # Generate invoice summary (can be converted to PDF with weasyprint or reportlab)
        invoice_text = invoice_generator.generate_invoice_summary(invoice_data)
        
        return send_file(
            BytesIO(invoice_text.encode('utf-8')),
            mimetype='text/plain',
            as_attachment=True,
            download_name=f'{invoice_number}.txt'
        )
        
    except Exception as e:
        logger.error(f"PDF invoice error: {str(e)}")
        return jsonify({'error': 'Failed to generate PDF invoice'}), 500


# ========== VAT INFORMATION ==========

@belgian_bp.route('/vat-rates', methods=['GET'])
def get_vat_rates():
    """Get current VAT rates for Belgium."""
    return jsonify({
        'country': 'Belgium',
        'currency': 'EUR',
        'vat_rates': {
            'standard': {
                'rate': '21%',
                'applies_to': 'Most goods and services (default)',
                'rate_decimal': 0.21,
            },
            'reduced': {
                'rate': '6%',
                'applies_to': 'Food, books, newspapers, medicines',
                'rate_decimal': 0.06,
            },
            'super_reduced': {
                'rate': '0%',
                'applies_to': 'Medicines, medical devices, certain foods',
                'rate_decimal': 0.00,
            },
        },
        'information': {
            'invoice_required': True,
            'invoice_language': ['en', 'fr', 'nl', 'de'],
            'e_invoice_standard': 'UBL-BE for B2B',
            'payment_terms_standard': '30 days net',
        },
    })


@belgian_bp.route('/calculate-vat', methods=['POST'])
def calculate_vat():
    """
    Calculate VAT for an amount.
    
    Request:
    {
        "amount_minor": 2990,
        "vat_rate": "standard"
    }
    """
    try:
        data = request.get_json()
        amount_minor = data.get('amount_minor')
        vat_rate = data.get('vat_rate', 'standard')
        
        if not amount_minor or amount_minor <= 0:
            return jsonify({'error': 'Invalid amount'}), 400
        
        vat_calc = payment_processor.calculate_vat(amount_minor, vat_rate)
        
        return jsonify({
            'net_amount': f"€{vat_calc['net']/100:.2f}",
            'vat_rate': f"{vat_calc['vat_rate_percent']}%",
            'vat_amount': f"€{vat_calc['vat_amount']/100:.2f}",
            'total_amount': f"€{vat_calc['total']/100:.2f}",
        })
        
    except Exception as e:
        logger.error(f"VAT calculation error: {str(e)}")
        return jsonify({'error': 'VAT calculation failed'}), 500


# ========== PAYMENT STATUS ==========

@belgian_bp.route('/payment-status/<transaction_id>', methods=['GET'])
@login_required
def get_payment_status(transaction_id):
    """Get payment status."""
    try:
        txn = BillingTransaction.query.get(transaction_id)
        
        if not txn or txn.user_id != current_user.id:
            return jsonify({'error': 'Transaction not found'}), 404
        
        return jsonify({
            'transaction_id': txn.id,
            'status': txn.status.value if hasattr(txn.status, 'value') else str(txn.status),
            'amount': f"€{txn.amount_minor/100:.2f}",
            'payment_method': txn.payment_method or 'Unknown',
            'provider': txn.provider,
            'created_at': txn.created_at.isoformat(),
            'notes': txn.notes or '',
        })
        
    except Exception as e:
        logger.error(f"Payment status error: {str(e)}")
        return jsonify({'error': 'Failed to retrieve payment status'}), 500
