import os
import re
import math
import hashlib
import subprocess
import requests
from werkzeug.utils import secure_filename

# Environment variables for API keys
ALIENVAULT_API_KEY = os.getenv("ALIENVAULT_API_KEY")
VIRUSTOTAL_API_KEY = os.getenv("VIRUSTOTAL_API_KEY")
REQUEST_TIMEOUT_SECONDS = 10

# File validation constants
ALLOWED_EXTENSIONS = {
    'txt', 'json', 'xml', 'log', 'pcap', 'pcapng', 
        'yar', 'yara', 'pdf', 'sqlite', 'db', 'mdb', 'bin'
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
UPLOAD_FOLDER = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'uploads')
SANDBOX_FOLDER = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'sandbox')

# Ensure folders exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(SANDBOX_FOLDER, exist_ok=True)

# File Validation
def validate_file(file):
    """Validates file type and size."""
    if not file.filename or '.' not in file.filename:
        raise ValueError("Invalid file name.")
    if file.filename.rsplit('.', 1)[1].lower() not in ALLOWED_EXTENSIONS:
        raise ValueError("Unsupported file type. Please upload valid file formats.")
    if file.content_length > MAX_FILE_SIZE:
        raise ValueError("File size exceeds the maximum allowed limit of 10MB.")
    return True

# Helper function to make API requests with retries
def make_api_request(url, headers, retries=3):
    """Makes a GET request to the given URL and retries if it fails."""
    for _ in range(retries):
        try:
            response = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT_SECONDS)
            if response.status_code == 200:
                return response.json()
            else:
                print(f"Error {response.status_code}: {url}")
                return None
        except requests.exceptions.RequestException as e:
            print(f"Request error: {e}")
    return None

# Antivirus Integration
def scan_with_clamav(file_path):
    """Scans a file using ClamAV for malware."""
    result = subprocess.run(
        ["clamscan", file_path],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=False,
    )
    if result.returncode == 0:
        return "Clean"
    else:
        return "Malicious"



from app.config import Config

def get_user_upload_folder(user_id):
    """Returns the upload folder for a specific user."""
    user_folder = Config.user_upload_folder(user_id)
    os.makedirs(user_folder, exist_ok=True)
    return user_folder

def save_uploaded_file(uploaded_file, user_id):
    """Saves the uploaded file securely in the user's directory."""
    user_folder = get_user_upload_folder(user_id)
    filename = secure_filename(uploaded_file.filename)
    file_path = os.path.join(user_folder, filename)
    uploaded_file.save(file_path)
    return file_path

def sandbox_file(file_path):
    """Moves the file to a sandbox environment for secure analysis."""
    sandboxed_path = os.path.join(SANDBOX_FOLDER, os.path.basename(file_path))
    os.rename(file_path, sandboxed_path)
    return sandboxed_path

def extract_iocs_from_text(text):
    """Extract IoCs like IPs, URLs, emails from text."""
    ip_pattern = r'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b'
    url_pattern = r'(https?://[^\s]+)'
    email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'

    ips = re.findall(ip_pattern, text)
    urls = re.findall(url_pattern, text)
    emails = re.findall(email_pattern, text)

    iocs = []
    for ip in ips:
        iocs.append({"type": "ip", "value": ip})
    for url in urls:
        iocs.append({"type": "url", "value": url})
    for email in emails:
        iocs.append({"type": "email", "value": email})

    return iocs

# Feature Extraction
def calculate_entropy(file_path):
    """Calculate the entropy of a file."""
    with open(file_path, 'rb') as file:
        file_data = file.read()
        byte_frequencies = [0] * 256
        for byte in file_data:
            byte_frequencies[byte] += 1
        total_bytes = len(file_data)
        probabilities = [freq / total_bytes for freq in byte_frequencies if freq > 0]
        entropy = -sum(p * math.log2(p) for p in probabilities)
    return entropy

def generate_file_hash(file_path):
    """Generate a SHA-256 hash for the file."""
    sha256 = hashlib.sha256()
    with open(file_path, 'rb') as file:
        while chunk := file.read(8192):
            sha256.update(chunk)
    return sha256.hexdigest()

# File Analysis Workflow
def analyze_file(uploaded_file, user_id):
    try:
        # Validate and save file
        validate_file(uploaded_file)
        file_path = save_uploaded_file(uploaded_file, user_id)

        # Antivirus scan
        scan_result = scan_with_clamav(file_path)
        if scan_result == "Malicious":
            print("Malicious file detected.")
            return {"status": "malicious", "details": "File flagged by antivirus."}

        # Move file to sandbox
        sandboxed_path = sandbox_file(file_path)

        # File analysis
        entropy = calculate_entropy(sandboxed_path)
        file_hash = generate_file_hash(sandboxed_path)

        # Return analysis results
        return {
            "status": "analyzed",
            "entropy": entropy,
            "file_hash": file_hash,
        }

    except Exception as e:
        print(f"An error occurred during file analysis: {e}")
        return {"status": "error", "details": str(e)}

# Example Usage
if __name__ == "__main__":
    # Simulating an uploaded file
    class UploadedFile:
        def __init__(self, filename, content_length):
            self.filename = filename
            self.content_length = content_length
        
        def save(self, file_path):
            with open(file_path, 'wb') as f:
                f.write(b"This is a test file.")

    uploaded_file = UploadedFile("test.txt", 1024)
    result = analyze_file(uploaded_file, user_id=1)
    print(result)
