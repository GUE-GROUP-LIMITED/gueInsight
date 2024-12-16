from src.ingestion.file_ingestion import read_files_from_directory, get_threat_data_from_api, read_log_file

# Test File Ingestion
files = read_files_from_directory('data/ransomware_notes')  # Ensure 'data/ransomware_notes' exists
for filename, content in files.items():
    print(f"Content of {filename}:")
    print(content[:100])  # Print first 100 characters

# Test API Ingestion (use valid API URL and key)
api_url = "https://api.alienvault.com/endpoint"
api_key = "your_api_key_here"
data = get_threat_data_from_api(api_url, api_key)
if data:
    print("API Data:")
    print(data)

# Test Log Ingestion (replace with valid log file path)
log_file_path = '/path/to/log_file.log'
log_data = read_log_file(log_file_path)
if log_data:
    print("Log Data:")
    print(log_data[:5])  # Print first 5 lines
