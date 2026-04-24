import json
import smtplib
import re
import csv
import os
import hashlib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pypdf import PdfReader
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import html
from itsdangerous import URLSafeTimedSerializer
from app.config import Config
from flask import flash, redirect, url_for, current_app, abort
from flask_login import current_user, login_required
from flask_mail import Mail, Message
from app import db  # Add this line to import the db object

mail = Mail()

# Set up logging
logging.basicConfig(filename='app.log', level=logging.DEBUG, 
                    format='%(asctime)s - %(levelname)s - %(message)s')

class OutputHandler:
    @staticmethod
    def fetch_user_results(user_id):
        """Fetch analysis results for a specific user."""
        results_dir = '/Users/gabrielaloho/gueInsight/app/output/user_reports'
        user_results_file = os.path.join(results_dir, f'user_{user_id}_results.json')

        if os.path.exists(user_results_file):
            try:
                with open(user_results_file, 'r') as f:
                    return json.load(f)
            except json.JSONDecodeError:
                logging.error(f"Error decoding JSON for user {user_id}")
        return []

class OutputHandler:
    @staticmethod
    def save_to_user_dashboard(user_id, report_file, file_path=None):
        # Save the analysis results and report to a database or file system
        report_path = f"reports/{user_id}_analysis_report.pdf"
        
        # Save the report path in the database for the user (e.g., adding it to the 'UserReports' table)
        db.save_user_report(user_id, report_path)

        # Optionally, save the file in the file system
        with open(report_path, 'wb') as file:
            file.write(report_file)
        
        # Optionally, save other analysis details (visualization, etc.)
        if file_path:
            db.save_analysis(file_path)

    @staticmethod
    def export_to_json(data, filename):
        """Export analysis results to a JSON file."""
        try:
            with open(filename, 'w') as json_file:
                json.dump(data, json_file, indent=4)
            logging.info(f"Data successfully exported to {filename}")
        except Exception as e:
            logging.error(f"Error exporting to JSON: {e}")

    @staticmethod
    def export_to_pdf(data, filename):
        """Export analysis results to a PDF file."""
        try:
            c = canvas.Canvas(filename, pagesize=letter)
            width, height = letter
            y_position = height - 40

            c.setFont("Helvetica-Bold", 14)
            c.drawString(30, y_position, "Ransomware Report")
            c.setFont("Helvetica", 10)

            for key, value in data.items():
                y_position -= 20
                c.drawString(30, y_position, f"{key}: {', '.join(value) if isinstance(value, list) else value}")
                if y_position < 40:
                    c.showPage()
                    y_position = height - 40

            c.save()
            logging.info(f"Data successfully exported to PDF: {filename}")
        except Exception as e:
            logging.error(f"Error exporting to PDF: {e}")


def send_email_alert(subject, body, to_emails):
    """Send an email alert with findings."""
    from_email = os.getenv("FROM_EMAIL")
    password = os.getenv("EMAIL_PASSWORD")
    to_emails = to_emails if isinstance(to_emails, list) else [to_emails]

    msg = MIMEMultipart()
    msg['From'] = from_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))

    try:
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(from_email, password)
        server.sendmail(from_email, to_emails, msg.as_string())
        server.quit()
        logging.info(f"Email alert sent to {', '.join(to_emails)}")
    except Exception as e:
        logging.error(f"Error sending email: {e}")


def process_ransomware_note(file_path):
    """Process ransomware note and extract data."""
    try:
        with open(file_path, 'r') as file:
            text = file.read()

        keywords = [word for word in ['decrypt', 'key', 'ransomware', 'pay', 'bitcoin', 'demand'] if re.search(rf'\b{word}\b', text, re.IGNORECASE)]
        emails = re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b', text)
        bitcoin_addresses = re.findall(r'\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b', text)
        ransom_demand = bool(set(keywords) & {'pay', 'bitcoin'})

        return {"ransom_demand": ransom_demand, "keywords": keywords, "emails": emails, "bitcoin_addresses": bitcoin_addresses}
    except Exception as e:
        logging.error(f"Error processing ransomware note: {e}")
        return {}


def process_file(file_path):
    """Process different types of uploaded files."""
    processors = {
        'txt': process_text_file,
        'pdf': process_pdf,
        'json': process_json,
        'csv': process_csv,
    }

    if not allowed_file(file_path):
        return "Unsupported file type."

    ext = file_path.split('.')[-1].lower()
    process_func = processors.get(ext)
    return process_func(file_path) if process_func else "Unsupported file type."


def process_text_file(file_path):
    with open(file_path, 'r') as file:
        return {"content": file.read()}



def generate_report(analysis_results, visualization_results=None):
        report_path = f"/Users/gabrielaloho/gueInsight/app/user_reports/{current_user.id}_analysis_report.pdf"
        c = canvas.Canvas(report_path, pagesize=letter)
        
        # Add content (analysis results and visuals) to the PDF
        c.drawString(100, 750, "Analysis Report")
        c.drawString(100, 730, f"Analysis Results: {analysis_results}")
    
        if visualization_results:
            # Add visualization to the PDF
            c.drawImage(visualization_results, 100, 500)
    
        # Save the PDF
        c.save()
        return report_path


def process_pdf(file_path):
    """Extract text from PDF."""
    try:
        pdf = PdfReader(file_path)
        text = ''.join(page.extract_text() for page in pdf.pages)
        if "<script>" in text:  # Simple malicious content check
            return {"error": "Malicious content detected in PDF."}
        return {"content": text}
    except Exception as e:
        logging.error(f"Error processing PDF: {e}")
        return {"error": str(e)}


def process_json(file_path):
    try:
        with open(file_path, 'r') as file:
            return json.load(file)
    except Exception as e:
        logging.error(f"Error processing JSON: {e}")
        return {"error": str(e)}


def process_csv(file_path):
    try:
        with open(file_path, 'r') as file:
            return [row for row in csv.DictReader(file)]
    except Exception as e:
        logging.error(f"Error processing CSV: {e}")
        return {"error": str(e)}


def allowed_file(filename):
    """Check if a file has an allowed extension."""
    ALLOWED_EXTENSIONS = Config.ALLOWED_EXTENSIONS
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def generate_file_hash(file_path):
    """Generate a SHA-256 hash for a file."""
    hash_sha256 = hashlib.sha256()
    with open(file_path, 'rb') as file:
        while chunk := file.read(4096):
            hash_sha256.update(chunk)
    return hash_sha256.hexdigest()


def sanitize_input(input_text):
    """Sanitize input to ensure safe processing."""
    if not input_text:
        return input_text
    sanitized_text = html.escape(input_text.strip())
    sanitized_text = re.sub(r'[^a-zA-Z0-9\s\.,!?-]', '', sanitized_text)
    sanitized_text = re.sub(r'\s+', ' ', sanitized_text)
    return sanitized_text


def get_serializer(secret_key, salt):
    """
    Create and return a URLSafeTimedSerializer instance.
    :param secret_key: The app's secret key.
    :param salt: A unique salt for the serializer.
    :return: Configured serializer instance.
    """
    return URLSafeTimedSerializer(secret_key, salt=salt)

def check_admin_role(user):
    role = getattr(user, 'role', None)
    role_value = getattr(role, 'value', role)
    if role_value != 'admin':
        abort(403)


def generate_reset_token(email):
    serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    return serializer.dumps(email, salt=current_app.config['SECURITY_PASSWORD_SALT'])

def send_reset_email(user, token):
    msg = Message('Password Reset Request', recipients=[user.email])
    msg.body = f"To reset your password, visit the following link: {url_for('reset_password', token=token, _external=True)}"
    mail.send(msg)

