"""
VirusTotal integration for malware and URL reputation checking.
"""
import requests
import os
import logging

logger = logging.getLogger(__name__)

VIRUSTOTAL_API_BASE = "https://www.virustotal.com/api/v3"
VIRUSTOTAL_API_KEY = os.getenv('VIRUSTOTAL_API_KEY', '')


def test_connection(api_key):
    """Test VirusTotal API connection."""
    headers = {
        'x-apikey': api_key
    }
    try:
        response = requests.get(f"{VIRUSTOTAL_API_BASE}/users/me", headers=headers, timeout=10)
        if response.status_code == 200:
            return {'status': 'success', 'message': 'Connected to VirusTotal'}
        else:
            raise Exception(f"VirusTotal API returned {response.status_code}")
    except Exception as e:
        logger.error(f"VirusTotal connection test failed: {e}")
        raise


def check_file_hash(file_hash, api_key=None):
    """
    Check file hash reputation on VirusTotal.
    
    Args:
        file_hash: MD5, SHA1, or SHA256 hash
        api_key: VirusTotal API key (defaults to env var)
    
    Returns:
        dict with detection count, last analysis, and vendor details
    """
    api_key = api_key or VIRUSTOTAL_API_KEY
    
    if not api_key:
        raise ValueError("VirusTotal API key not configured")
    
    headers = {'x-apikey': api_key}
    
    try:
        response = requests.get(
            f"{VIRUSTOTAL_API_BASE}/files/{file_hash}",
            headers=headers,
            timeout=15
        )
        
        if response.status_code == 404:
            return {'status': 'not_found', 'detections': 0}
        
        if response.status_code == 200:
            data = response.json()
            attributes = data.get('data', {}).get('attributes', {})
            
            last_analysis = attributes.get('last_analysis_stats', {})
            detections = last_analysis.get('malicious', 0) + last_analysis.get('suspicious', 0)
            
            return {
                'status': 'success',
                'file_hash': file_hash,
                'detections': detections,
                'vendor_count': last_analysis.get('undetected', 0),
                'last_analysis_date': attributes.get('last_analysis_date'),
                'last_analysis_results': attributes.get('last_analysis_results', {})
            }
        
        raise Exception(f"VirusTotal API error: {response.status_code}")
    
    except requests.Timeout:
        logger.error("VirusTotal request timeout")
        raise
    except Exception as e:
        logger.error(f"VirusTotal file check error: {e}")
        raise


def check_url(url, api_key=None):
    """
    Check URL reputation on VirusTotal.
    
    Args:
        url: URL to check
        api_key: VirusTotal API key
    
    Returns:
        dict with detection count and vendor details
    """
    api_key = api_key or VIRUSTOTAL_API_KEY
    
    if not api_key:
        raise ValueError("VirusTotal API key not configured")
    
    headers = {'x-apikey': api_key}
    
    try:
        # Submit URL for scanning if not already present
        response = requests.post(
            f"{VIRUSTOTAL_API_BASE}/urls",
            headers=headers,
            data={'url': url},
            timeout=15
        )
        
        if response.status_code == 200:
            data = response.json()
            analysis_id = data.get('data', {}).get('id')
            
            # Get analysis results
            if analysis_id:
                analysis_response = requests.get(
                    f"{VIRUSTOTAL_API_BASE}/analyses/{analysis_id}",
                    headers=headers,
                    timeout=15
                )
                
                if analysis_response.status_code == 200:
                    analysis_data = analysis_response.json()
                    stats = analysis_data.get('data', {}).get('attributes', {}).get('stats', {})
                    
                    detections = stats.get('malicious', 0) + stats.get('suspicious', 0)
                    
                    return {
                        'status': 'success',
                        'url': url,
                        'detections': detections,
                        'vendors_reported': stats.get('undetected', 0),
                        'analysis_id': analysis_id
                    }
        
        raise Exception(f"VirusTotal URL check failed: {response.status_code}")
    
    except Exception as e:
        logger.error(f"VirusTotal URL check error: {e}")
        raise


def enrich_analysis_results(analysis_results, api_key=None):
    """
    Enrich analysis results with VirusTotal data for found IoCs.
    
    Args:
        analysis_results: dict with detected hashes/URLs/IPs
        api_key: VirusTotal API key
    
    Returns:
        dict with enriched results including VirusTotal reputation
    """
    api_key = api_key or VIRUSTOTAL_API_KEY
    enriched = analysis_results.copy()
    
    if not api_key:
        return enriched
    
    try:
        # Check file hashes
        if 'file_hashes' in analysis_results:
            enriched['virustotal_hashes'] = []
            for file_hash in analysis_results.get('file_hashes', []):
                try:
                    vt_result = check_file_hash(file_hash, api_key)
                    enriched['virustotal_hashes'].append(vt_result)
                except:
                    pass
        
        # Check URLs
        if 'urls' in analysis_results:
            enriched['virustotal_urls'] = []
            for url in analysis_results.get('urls', [])[:5]:  # Limit to 5
                try:
                    vt_result = check_url(url, api_key)
                    enriched['virustotal_urls'].append(vt_result)
                except:
                    pass
        
        return enriched
    
    except Exception as e:
        logger.error(f"Error enriching with VirusTotal data: {e}")
        return enriched
