"""
AbuseIPDB integration for IP address reputation and abuse reports.
"""
import requests
import os
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

ABUSEIPDB_API_BASE = "https://api.abuseipdb.com/api/v2"
ABUSEIPDB_API_KEY = os.getenv('ABUSEIPDB_API_KEY', '')


def test_connection(api_key):
    """Test AbuseIPDB API connection."""
    headers = {
        'Key': api_key,
        'Accept': 'application/json'
    }
    try:
        response = requests.get(
            f"{ABUSEIPDB_API_BASE}/check",
            headers=headers,
            params={'ipAddress': '127.0.0.1', 'maxAgeInDays': 90},
            timeout=10
        )
        if response.status_code == 200:
            return {'status': 'success', 'message': 'Connected to AbuseIPDB'}
        else:
            raise Exception(f"AbuseIPDB API returned {response.status_code}")
    except Exception as e:
        logger.error(f"AbuseIPDB connection test failed: {e}")
        raise


def check_ip(ip_address, max_age_days=90, api_key=None):
    """
    Check IP address reputation on AbuseIPDB.
    
    Args:
        ip_address: IP to check
        max_age_days: Only report abuses in last N days (default 90)
        api_key: AbuseIPDB API key
    
    Returns:
        dict with abuse score and report details
    """
    api_key = api_key or ABUSEIPDB_API_KEY
    
    if not api_key:
        raise ValueError("AbuseIPDB API key not configured")
    
    headers = {
        'Key': api_key,
        'Accept': 'application/json'
    }
    
    try:
        response = requests.get(
            f"{ABUSEIPDB_API_BASE}/check",
            headers=headers,
            params={
                'ipAddress': ip_address,
                'maxAgeInDays': max_age_days,
                'verbose': True
            },
            timeout=15
        )
        
        if response.status_code == 200:
            data = response.json().get('data', {})
            
            return {
                'status': 'success',
                'ip_address': ip_address,
                'abuse_confidence_score': data.get('abuseConfidenceScore', 0),
                'total_reports': data.get('totalReports', 0),
                'is_whitelisted': data.get('isWhitelisted', False),
                'last_reported_at': data.get('lastReportedAt'),
                'usage_type': data.get('usageType'),
                'isp': data.get('isp'),
                'domain': data.get('domain'),
                'reports': data.get('reports', [])[:5]  # First 5 reports
            }
        
        raise Exception(f"AbuseIPDB API error: {response.status_code}")
    
    except requests.Timeout:
        logger.error("AbuseIPDB request timeout")
        raise
    except Exception as e:
        logger.error(f"AbuseIPDB check error: {e}")
        raise


def report_ip(ip_address, comment, category, api_key=None):
    """
    Report an IP address to AbuseIPDB.
    
    Args:
        ip_address: IP to report
        comment: Description of abuse
        category: Abuse category (1-18, see AbuseIPDB docs)
        api_key: AbuseIPDB API key
    
    Returns:
        dict with report confirmation
    """
    api_key = api_key or ABUSEIPDB_API_KEY
    
    if not api_key:
        raise ValueError("AbuseIPDB API key not configured")
    
    headers = {
        'Key': api_key,
        'Accept': 'application/json'
    }
    
    try:
        response = requests.post(
            f"{ABUSEIPDB_API_BASE}/report",
            headers=headers,
            data={
                'ip': ip_address,
                'category': category,
                'comment': comment[:1000]  # Max 1000 chars
            },
            timeout=15
        )
        
        if response.status_code == 201:
            data = response.json().get('data', {})
            return {
                'status': 'success',
                'message': 'IP reported to AbuseIPDB',
                'abuse_confidence_score': data.get('abuseConfidenceScore'),
                'report_id': data.get('id')
            }
        
        raise Exception(f"Report failed: {response.status_code}")
    
    except Exception as e:
        logger.error(f"AbuseIPDB report error: {e}")
        raise


def check_ips_batch(ip_list, max_age_days=90, api_key=None):
    """
    Check multiple IPs in batch (respects rate limits).
    
    Args:
        ip_list: List of IPs to check
        max_age_days: Only report abuses in last N days
        api_key: AbuseIPDB API key
    
    Returns:
        dict with results for each IP
    """
    results = {}
    
    for ip in ip_list[:100]:  # Limit to 100 per batch
        try:
            results[ip] = check_ip(ip, max_age_days, api_key)
        except Exception as e:
            results[ip] = {'status': 'error', 'message': str(e)}
    
    return results


def enrich_analysis_results(analysis_results, api_key=None):
    """
    Enrich analysis results with AbuseIPDB data for found IPs.
    
    Args:
        analysis_results: dict with detected IPs
        api_key: AbuseIPDB API key
    
    Returns:
        dict with enriched results including AbuseIPDB reputation
    """
    api_key = api_key or ABUSEIPDB_API_KEY
    enriched = analysis_results.copy()
    
    if not api_key:
        return enriched
    
    try:
        # Check IPs
        if 'ip_addresses' in analysis_results:
            enriched['abuseipdb_ips'] = []
            for ip in analysis_results.get('ip_addresses', [])[:20]:  # Limit to 20
                try:
                    aidb_result = check_ip(ip, api_key=api_key)
                    enriched['abuseipdb_ips'].append(aidb_result)
                except:
                    pass
        
        return enriched
    
    except Exception as e:
        logger.error(f"Error enriching with AbuseIPDB data: {e}")
        return enriched


# AbuseIPDB Abuse Categories
ABUSE_CATEGORIES = {
    1: 'DNS Compromise',
    2: 'DNS Poisoning',
    3: 'Fraud Orders',
    4: 'DDoS Attack',
    5: 'FTP Brute-Force',
    6: 'Ping of Death',
    7: 'Phishing',
    8: 'Proxy Abuse',
    9: 'SPAM',
    10: 'SSH Brute-Force',
    11: 'IPS Alert',
    12: 'Legitimate Circumvention',
    13: 'Network Scan',
    14: 'SPIT',
    15: 'VPN IP',
    16: 'Port Scan',
    17: 'Hacking',
    18: 'OpenProxy'
}
