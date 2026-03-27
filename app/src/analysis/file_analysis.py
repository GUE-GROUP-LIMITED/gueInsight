from app.models import AlertRule, Alert, Event, db
from app.notifications.alerts import send_slack_alert, send_teams_alert
import re
import json
from transformers import pipeline
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import CountVectorizer
from transformers import pipeline
from transformers import pipeline
from transformers import pipeline
import numpy as np
from sklearn.ensemble import RandomForestClassifier
import logging
import mimetypes
from PyPDF2 import PdfReader
import docx
import os
import re

class Analyzer:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        logging.basicConfig(level=logging.INFO)

    def analyze(self, file_path: str) -> dict:
        results = {
            "file_path": file_path,
            "file_type": self.get_file_type(file_path),
            "suspicious_patterns": [],
            "indicators_of_compromise": [],
            "metadata": self.get_file_metadata(file_path)
        }

        try:
            file_extension = self.get_file_extension(file_path).lower()

            # Process based on file type
            content = ""
            if file_extension == 'pdf':
                content = self.extract_text_from_pdf(file_path)
            elif file_extension == 'docx':
                content = self.extract_text_from_docx(file_path)
            elif file_extension in ['txt', 'log']:
                content = self.extract_text_from_txt(file_path)
            else:
                content = self.extract_text_from_binary(file_path)

            # Perform detection of suspicious patterns and IoCs
            results["suspicious_patterns"] = self.detect_suspicious_patterns(content)
            results["indicators_of_compromise"] = self.detect_iocs(content)

            # --- ALERT RULE EVALUATION ---
            self.evaluate_alert_rules(content, file_path, results)

        except Exception as e:
            self.logger.error(f"Error analyzing file {file_path}: {str(e)}")
            results["error"] = str(e)

        return results

    def evaluate_alert_rules(self, content, file_path, analysis_results):
        # Get all enabled rules (global and user-specific if available)
        rules = AlertRule.query.filter_by(enabled=True).all()
        triggered = []
        for rule in rules:
            triggered_flag = False
            desc = None
            if rule.rule_type == 'keyword' and rule.value.lower() in content.lower():
                triggered_flag = True
                desc = f"Keyword '{rule.value}' found in file."
            elif rule.rule_type == 'ioc' and rule.value in analysis_results.get('indicators_of_compromise', []):
                triggered_flag = True
                desc = f"IOC '{rule.value}' detected in file."
            elif rule.rule_type == 'severity' and rule.severity == analysis_results.get('severity', 'medium'):
                triggered_flag = True
                desc = f"Severity '{rule.severity}' matched."
            if triggered_flag:
                # Create Event if not already
                event = Event(
                    timestamp=datetime.datetime.utcnow(),
                    source='analysis',
                    event_type='alert',
                    raw_data=json.dumps(analysis_results),
                    enrichment=None,
                    threat_detected=True
                )
                db.session.add(event)
                db.session.commit()
                alert = Alert(
                    event_id=event.id,
                    rule_id=rule.id,
                    triggered_at=datetime.datetime.utcnow(),
                    description=desc
                )
                db.session.add(alert)
                db.session.commit()
                # Send notifications (Slack/Teams)
                send_slack_alert(f"Alert triggered: {desc}")
                send_teams_alert(f"Alert triggered: {desc}")
                triggered.append(desc)
        if triggered:
            analysis_results['alerts_triggered'] = triggered

        return results

    def get_file_type(self, file_path: str) -> str:
        try:
            mime, _ = mimetypes.guess_type(file_path)
            return mime or "Unknown"
        except Exception as e:
            self.logger.error(f"Error getting file type for {file_path}: {str(e)}")
            return "Unknown"

    def get_file_extension(self, file_path: str) -> str:
        return os.path.splitext(file_path)[1][1:]

    def get_file_metadata(self, file_path: str) -> dict:
        return {
            "size": os.path.getsize(file_path),
            "last_modified": os.path.getmtime(file_path)
        }

    def extract_text_from_pdf(self, file_path: str) -> str:
        try:
            pdf_reader = PdfReader(file_path)
            text = "".join(page.extract_text() for page in pdf_reader.pages)
            return text
        except Exception as e:
            self.logger.error(f"Error extracting text from PDF file {file_path}: {str(e)}")
            return ""

    def extract_text_from_docx(self, file_path: str) -> str:
        try:
            doc = docx.Document(file_path)
            return "".join(para.text for para in doc.paragraphs)
        except Exception as e:
            self.logger.error(f"Error extracting text from DOCX file {file_path}: {str(e)}")
            return ""

    def extract_text_from_txt(self, file_path: str) -> str:
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                return file.read()
        except Exception as e:
            self.logger.error(f"Error extracting text from TXT file {file_path}: {str(e)}")
            return ""

    def extract_text_from_binary(self, file_path: str) -> str:
        try:
            with open(file_path, 'rb') as file:
                return file.read(1000).decode(errors='ignore')
        except Exception as e:
            self.logger.error(f"Error extracting text from binary file {file_path}: {str(e)}")
            return ""

    def detect_suspicious_patterns(self, content: str) -> list:
        patterns = [r"(exec|eval|base64_decode|system|shell_exec)", r"malicious_code"]
        return [pattern for pattern in patterns if re.search(pattern, content)]

    def detect_iocs(self, content: str) -> list:
        ip_pattern = r"\b(?:\d{1,3}\.){3}\d{1,3}\b"
        url_pattern = r"https?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+"
        return re.findall(ip_pattern, content) + re.findall(url_pattern, content)


# Lazy-load transformer models only when needed
def get_ner_pipeline():
    from transformers import pipeline
    return pipeline("ner", model="dbmdz/bert-large-cased-finetuned-conll03-english")

def get_classifier_pipeline():
    from transformers import pipeline
    return pipeline("zero-shot-classification", model="facebook/bart-large-mnli")

# Define IoC extraction methods
def extract_email_addresses(text):
    return re.findall(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", text)

def extract_bitcoin_addresses(text):
    return re.findall(r"\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b", text)

def extract_ip_addresses(text):
    return re.findall(r"\b(?:\d{1,3}\.){3}\d{1,3}\b", text)

def extract_urls(text):
    return re.findall(r"http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+", text)

def extract_file_hashes(text):
    return re.findall(r"\b[A-Fa-f0-9]{32,64}\b", text)

# A general function to extract all IoCs
def extract_iocs(text):
    iocs = {
        "emails": extract_email_addresses(text),
        "bitcoin_addresses": extract_bitcoin_addresses(text),
        "ips": extract_ip_addresses(text),
        "urls": extract_urls(text),
        "hashes": extract_file_hashes(text)
    }
    return iocs



def process_file(filepath):
    print(f"Processing file: {filepath}")

def process_text_or_hash(input_data):
    print(f"Processing input: {input_data}")

# Feature extraction
def extract_features_from_entity(entities):
    vectorizer = CountVectorizer()
    return vectorizer.fit_transform(entities)

# ML classification methods
def classify_text(text, candidate_labels):
    result = classifier_pipeline(text, candidate_labels)
    return result

def train_classifier(data, labels):
    vectorizer = CountVectorizer()
    X = vectorizer.fit_transform(data)
    classifier = RandomForestClassifier()
    classifier.fit(X, labels)
    return classifier

# General analysis function for file contents
def analyze_text_for_security(text):
    # Extract entities like emails, IPs, Bitcoin addresses
    iocs = extract_iocs(text)
    
    # Use the NER pipeline for named entity recognition
    entities = ner_pipeline(text)
    
    # Prepare the data for feature extraction
    features = extract_features_from_entity([entity['word'] for entity in entities])
    
    # Classify the text into predefined categories
    candidate_labels = ["malware", "phishing", "spam", "normal"]
    classification_result = classify_text(text, candidate_labels)
    
    return iocs, entities, features, classification_result




def analyze_cloud_link(link):
    # Extract entities like emails, IPs, Bitcoin addresses
    iocs = extract_iocs(link)
    
    # Use the NER pipeline for named entity recognition
    entities = ner_pipeline(link)
    
    # Prepare the data for feature extraction
    features = extract_features_from_entity([entity['word'] for entity in entities])
    
    # Classify the text into predefined categories
    candidate_labels = ["malware", "phishing", "spam", "normal"]
    classification_result = classify_text(link, candidate_labels)
    
    return iocs, entities, features, classification_result





# Analyze uploaded file contents (JSON example)
def analyze_file(file_path):
    with open(file_path, "r") as f:
        file_contents = json.load(f)
    
    # Assuming JSON structure has a text field for analysis
    text = file_contents.get("text", "")
    
    iocs, entities, features, classification_result = analyze_text_for_security(text)
    
    return {
        "iocs": iocs,
        "entities": entities,
        "features": features,
        "classification_result": classification_result
    }

def identify_ransom_family(note):
    families = {
        "Conti": r"Conti gang",
        "REvil": r"REvil",
        "LockBit": r"LockBit gang"
    }
    for family, pattern in families.items():
        if re.search(pattern, note, re.IGNORECASE):
            return family
    return "Unknown"


# Example of calling the analysis on a sample JSON file
if __name__ == "__main__":
    file_path = "sample_file.json"  # Example file path
    analysis_results = analyze_file(file_path)
    print(json.dumps(analysis_results, indent=4))

import requests

# Analyze URL for threats or anomalies
def analyze_url(url):
    try:
        response = requests.get(f"https://api.threatintel.com/analyze?url={url}")
        if response.status_code == 200:
            return response.json()  # Process the response
        else:
            return f"Unable to analyze URL. Received status code {response.status_code}."
    except Exception as e:
        return f"Error analyzing URL: {e}"

# Analyze hash against known threat databases
def analyze_hash(hash_value):
    try:
        response = requests.get(f"https://api.threatintel.com/hashlookup?hash={hash_value}")
        if response.status_code == 200:
            return response.json()  # Process the response
        else:
            return f"Unable to analyze hash. Received status code {response.status_code}."
    except Exception as e:
        return f"Error analyzing hash: {e}"

# Analyze plain text for indicators of compromise (IoCs)
def analyze_text(text):
    from app.src.preprocessing.preprocess import extract_iocs  # Import the IoC extraction function
    potential_iocs = extract_iocs(text)
    if potential_iocs:
        return {
            "message": "IoCs found in the provided text.",
            "iocs": potential_iocs
        }
    else:
        return "No IoCs found in the text."


from app.utils.utils import generate_file_hash
from app.src.preprocessing.preprocess import extract_iocs

def analyze_file(file_path):
    """
    Analyze the uploaded file for threats or indicators.
    """
    file_hash = generate_file_hash(file_path)
    threat_status = check_iocs_alienvault(file_hash)  # Replace with your actual threat-checking function
    return {
        "summary": "File analysis completed.",
        "status": "success",
        "findings": [
            {"indicator": "File Hash", "details": f"{file_hash} (Threat: {threat_status})"}
        ],
        "recommendations": [f"Quarantine the file if identified as malicious."],
    }

def analyze_text(text):
    """
    Analyze plain text for threat indicators.
    """
    iocs = extract_iocs(text)
    return {
        "summary": "Text analysis completed.",
        "status": "success" if iocs else "no findings",
        "findings": [
            {"indicator": ioc_type, "details": f"Potential {ioc_type.upper()} indicator: {match}"}
            for ioc_type, matches in iocs.items() for match in matches
        ],
        "recommendations": [
            "Investigate IoCs to determine their threat level.",
            "Implement security measures for confirmed threats."
        ] if iocs else [],
    }

import requests

def check_iocs_alienvault(hash_value):
    """
    Check the file hash against a threat database (e.g., AlienVault).
    Replace the URL and logic with your actual threat intelligence provider.
    """
    try:
        response = requests.get(f"https://otx.alienvault.com/api/v1/indicators/file/{hash_value}")
        if response.status_code == 200:
            data = response.json()
            return data.get("threat_status", "Unknown")
        else:
            return "Error in checking threat status."
    except Exception as e:
        return f"Error: {e}"
