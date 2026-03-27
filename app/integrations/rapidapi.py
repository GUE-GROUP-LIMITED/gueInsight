import requests

# Example: RapidAPI enrichment utility for IP, URL, and hash reputation
# Replace 'YOUR_RAPIDAPI_KEY' and 'API_HOST' with actual values from your RapidAPI subscription

RAPIDAPI_KEY = 'YOUR_RAPIDAPI_KEY'  # TODO: Move to config or environment variable
API_HOST = 'example-cyber-api.p.rapidapi.com'  # TODO: Replace with actual API host


def enrich_ip(ip):
    url = f"https://{API_HOST}/ip-reputation"
    headers = {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": API_HOST
    }
    params = {"ip": ip}
    response = requests.get(url, headers=headers, params=params)
    if response.status_code == 200:
        return response.json()
    return {"error": response.text}


def enrich_url(url_to_check):
    url = f"https://{API_HOST}/url-reputation"
    headers = {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": API_HOST
    }
    params = {"url": url_to_check}
    response = requests.get(url, headers=headers, params=params)
    if response.status_code == 200:
        return response.json()
    return {"error": response.text}


def enrich_hash(file_hash):
    url = f"https://{API_HOST}/hash-reputation"
    headers = {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": API_HOST
    }
    params = {"hash": file_hash}
    response = requests.get(url, headers=headers, params=params)
    if response.status_code == 200:
        return response.json()
    return {"error": response.text}


def enrich_event(event):
    """
    Enrich an event dict with threat intelligence (IP, URL, hash, etc.).
    """
    enrichment = {}
    if 'ip' in event:
        enrichment['ip'] = enrich_ip(event['ip'])
    if 'url' in event:
        enrichment['url'] = enrich_url(event['url'])
    if 'hash' in event:
        enrichment['hash'] = enrich_hash(event['hash'])
    return enrichment
