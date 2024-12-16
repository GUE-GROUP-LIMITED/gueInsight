import os
import re
import pyshark
import sqlite3
import pdfplumber
import math
import hashlib
import logging
from collections import Counter

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

# Helper Functions

def preprocess_text(text):
    # Example: Basic preprocessing for NLP
    text = text.lower()  # Convert to lowercase
    text = ''.join([c for c in text if c.isalnum() or c.isspace()])  # Remove non-alphanumeric characters
    return text.strip().lower()


def preprocess_cloud_link(text):
    # Example: Basic preprocessing for NLP
    text = text.lower()  # Convert to lowercase
    text = ''.join([c for c in text if c.isalnum() or c.isspace()])  # Remove non-alphanumeric characters
    return text.strip().lower()
def clean_text(text):
    # Remove unnecessary whitespace and non-alphanumeric characters
    return re.sub(r'[^a-zA-Z0-9\s]', '', text.strip()).lower()

def preprocess_file(file_path):
    with open(file_path, 'r') as f:
        raw_data = f.read()
    return clean_text(raw_data)


def calculate_entropy(file_path):
    """
    Calculate the entropy of a file, which measures the randomness or unpredictability of its content.
    Higher entropy usually indicates more randomness (e.g., encrypted or compressed data).
    """
    with open(file_path, 'rb') as file:
        # Read the file as bytes
        file_data = file.read()
        
        # Frequency of each byte value (0-255)
        byte_frequencies = [0] * 256
        for byte in file_data:
            byte_frequencies[byte] += 1
        
        # Calculate probabilities for each byte value
        total_bytes = len(file_data)
        probabilities = [freq / total_bytes for freq in byte_frequencies if freq > 0]
        
        # Calculate entropy using Shannon entropy formula
        entropy = -sum(p * math.log2(p) for p in probabilities)
    
    return entropy

def generate_file_hash(file_path):
    """
    Generate a hash (SHA-256) of the file's contents for integrity checks.
    """
    sha256 = hashlib.sha256()
    with open(file_path, 'rb') as file:
        while chunk := file.read(8192):
            sha256.update(chunk)
    return sha256.hexdigest()

# IoC Extraction Functions

def extract_email_addresses(texts):
    """Extract email addresses from texts."""
    email_pattern = r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
    return set(email for text in texts for email in re.findall(email_pattern, text))

def extract_bitcoin_addresses(texts):
    """Extract Bitcoin wallet addresses from texts."""
    btc_pattern = r"([13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-zA-HJ-NP-Z0-9]{25,39})"
    return set(addr for text in texts for addr in re.findall(btc_pattern, text))

def extract_ip_addresses(texts):
    """Extract IP addresses from texts."""
    ip_pattern = r'\b(?:\d{1,3}\.){3}\d{1,3}\b'
    return set(ip for text in texts for ip in re.findall(ip_pattern, text))

def extract_urls(texts):
    """Extract URLs from texts."""
    url_pattern = r'https?://[^\s]+'
    return set(url for text in texts for url in re.findall(url_pattern, text))

def extract_file_hashes(texts):
    """Extract file hashes (MD5, SHA-1, SHA-256) from texts."""
    hash_pattern = r'\b[a-fA-F0-9]{32}\b|\b[a-fA-F0-9]{40}\b|\b[a-fA-F0-9]{64}\b'
    return set(h for text in texts for h in re.findall(hash_pattern, text))

def extract_keywords(texts, keywords=["bitcoin", "payment", "decrypt", "key"]):
    """Extract occurrences of specific keywords from texts."""
    keyword_counts = Counter()
    for text in texts:
        for keyword in keywords:
            keyword_counts[keyword] += text.lower().count(keyword.lower())
    return keyword_counts

# File Parsing Functions

def extract_text_from_pdf(pdf_path):
    """Extract text from a PDF file."""
    try:
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"File not found: {pdf_path}")
        with pdfplumber.open(pdf_path) as pdf:
            text = "".join(page.extract_text() for page in pdf.pages if page.extract_text())
        return text
    except Exception as e:
        logging.error(f"Error extracting text from PDF {pdf_path}: {e}")
        return ""

def extract_from_pcap(pcap_path):
    """Extract relevant IoCs from a PCAP file (e.g., IP addresses, URLs)."""
    ip_addresses, urls = set(), set()
    try:
        if not os.path.exists(pcap_path):
            raise FileNotFoundError(f"File not found: {pcap_path}")
        packets = pyshark.FileCapture(pcap_path)
        for packet in packets:
            if hasattr(packet, 'ip'):
                ip_addresses.add(packet.ip.src)
                ip_addresses.add(packet.ip.dst)
            if hasattr(packet, 'http') and hasattr(packet.http, 'host'):
                urls.update(re.findall(r'http[s]?://[^\s]+', packet.http.host))
        packets.close()
    except Exception as e:
        logging.error(f"Error extracting data from PCAP {pcap_path}: {e}")
    return ip_addresses, urls

def extract_from_sqlite(db_path):
    """Extract data from an SQLite database (e.g., emails, URLs)."""
    emails, urls = set(), set()
    try:
        if not os.path.exists(db_path):
            raise FileNotFoundError(f"File not found: {db_path}")
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in cursor.fetchall()]
        if "files" in tables:  # Adjust based on expected schema
            cursor.execute("SELECT * FROM files")
            rows = cursor.fetchall()
            for row in rows:
                row_text = " ".join(map(str, row))
                emails.update(re.findall(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", row_text))
                urls.update(re.findall(r'https?://[^\s]+', row_text))
    except Exception as e:
        logging.error(f"Error extracting data from SQLite {db_path}: {e}")
    finally:
        conn.close()
    return emails, urls
import re

# Extract indicators of compromise (IoCs) from text
def extract_iocs(text):
    ioc_patterns = {
        "ip": re.compile(r'\b(?:\d{1,3}\.){3}\d{1,3}\b'),  # IPv4
        "url": re.compile(
            r'((http|https)://([a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,})(:[0-9]{1,5})?(/[^\s]*)?)'
        ),  # URLs
        "hash": re.compile(r'\b[a-fA-F0-9]{32}\b|\b[a-fA-F0-9]{40}\b|\b[a-fA-F0-9]{64}\b')  # MD5, SHA-1, SHA-256
    }

    extracted = {}
    for ioc_type, pattern in ioc_patterns.items():
        matches = pattern.findall(text)
        if matches:
            extracted[ioc_type] = matches

    return extracted


# Main File Ingestion Function

def ingest_uploaded_files(file_paths):
    """Process uploaded files and extract IoCs from each type."""
    all_texts = []
    all_emails = set()
    all_btc_addresses = set()
    all_ip_addresses = set()
    all_urls = set()
    all_file_hashes = set()

    for file_path in file_paths:
        file_extension = file_path.split('.')[-1].lower()
        try:
            if not os.path.exists(file_path):
                logging.error(f"File not found: {file_path}")
                continue

            if file_extension in ['txt', 'json', 'xml', 'log']:
                with open(file_path, 'r') as file:
                    text = file.read()
                    all_texts.append(text)

            elif file_extension == 'pdf':
                text = extract_text_from_pdf(file_path)
                all_texts.append(text)

            elif file_extension in ['pcap', 'pcapng']:
                ip_addresses, urls = extract_from_pcap(file_path)
                all_ip_addresses.update(ip_addresses)
                all_urls.update(urls)

            elif file_extension in ['sqlite', 'db', 'mdb']:
                emails, urls = extract_from_sqlite(file_path)
                all_emails.update(emails)
                all_urls.update(urls)

            # Process IoCs from text-based files (pdf, txt, json, xml)
            if file_extension in ['txt', 'json', 'xml', 'log', 'pdf']:
                all_emails.update(extract_email_addresses([text]))
                all_btc_addresses.update(extract_bitcoin_addresses([text]))
                all_ip_addresses.update(extract_ip_addresses([text]))
                all_urls.update(extract_urls([text]))
                all_file_hashes.update(extract_file_hashes([text]))

        except Exception as e:
            logging.error(f"Error processing file {file_path}: {e}")

    return {
        "texts": all_texts,
        "emails": all_emails,
        "btc_addresses": all_btc_addresses,
        "ip_addresses": all_ip_addresses,
        "urls": all_urls,
        "file_hashes": all_file_hashes
    }

class Preprocess:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        logging.basicConfig(level=logging.INFO)

if __name__ == "__main__":
    # Simulate file ingestion from the user dashboard
    user_uploaded_files = ["example.pdf", "example.pcap", "example.txt"]  # Replace with actual uploaded file paths
    results = ingest_uploaded_files(user_uploaded_files)

    # Print results
    logging.info(f"Keyword Counts: {extract_keywords(results['texts'])}")
    logging.info(f"Email Addresses: {results['emails']}")
    logging.info(f"Bitcoin Addresses: {results['btc_addresses']}")
    logging.info(f"IP Addresses: {results['ip_addresses']}")
    logging.info(f"URLs: {results['urls']}")
    logging.info(f"File Hashes: {results['file_hashes']}")
