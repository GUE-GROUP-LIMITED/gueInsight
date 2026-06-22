"""
RapidAPI integration for IoC enrichment services.
Supports multiple cybersecurity APIs via RapidAPI marketplace.
"""
import requests
import os
import logging

logger = logging.getLogger(__name__)

RAPIDAPI_KEY = os.getenv('RAPIDAPI_KEY', '')
RAPIDAPI_HOST_IP_QUALITY = os.getenv('RAPIDAPI_HOST_IP_QUALITY', 'ipqualityscore-ip-reputation-database.p.rapidapi.com')
RAPIDAPI_HOST_THREAT_JAMMER = os.getenv('RAPIDAPI_HOST_THREAT_JAMMER', 'threat-jammer-api.p.rapidapi.com')


def test_connection(api_key):
    """Test RapidAPI connection."""
    try:
        headers = {
            'X-RapidAPI-Key': api_key,
            'X-RapidAPI-Host': RAPIDAPI_HOST_IP_QUALITY
        }
        
        response = requests.get(
            f"https://{RAPIDAPI_HOST_IP_QUALITY}/ip/reputation/",
            headers=headers,
            params={'ip': '8.8.8.8'},
            timeout=10
        )
        
        if response.status_code in [200, 400]:  # 400 is valid response for API
            return {'status': 'success', 'message': 'Connected to RapidAPI'}
        else:
            raise Exception(f"RapidAPI returned {response.status_code}")
    
    except Exception as e:
        logger.error(f"RapidAPI connection test failed: {e}")
        raise


def enrich_ip(ip, api_key=None):
    """
    Enrich IP address with reputation data via RapidAPI.
    
    Args:
        ip: IP address to check
        api_key: RapidAPI key
    
    Returns:
        dict with IP reputation details
    """
    api_key = api_key or RAPIDAPI_KEY
    
    if not api_key:
        raise ValueError("RapidAPI key not configured")
    
    headers = {
        'X-RapidAPI-Key': api_key,
        'X-RapidAPI-Host': RAPIDAPI_HOST_IP_QUALITY
    }
    
    try:
        response = requests.get(
            f"https://{RAPIDAPI_HOST_IP_QUALITY}/ip/reputation/",
            headers=headers,
            params={'ip': ip},
            timeout=15
        )
        
        if response.status_code == 200:
            data = response.json()
            return {
                'status': 'success',
                'ip': ip,
                'fraud_score': data.get('fraud_score', 0),
                'is_bot': data.get('is_bot', False),
                'is_crawler': data.get('is_crawler', False),
                'recent_abuse': data.get('recent_abuse', False),
                'country': data.get('country_code'),
                'isp': data.get('ISP'),
                'threat_level': 'high' if data.get('fraud_score', 0) > 75 else 'medium' if data.get('fraud_score', 0) > 50 else 'low'
            }
        else:
            raise Exception(f"IP enrichment failed: {response.status_code}")
    
    except Exception as e:
        logger.error(f"RapidAPI IP enrichment error: {e}")
        raise


def enrich_url(url_to_check, api_key=None):
    """
    Check URL safety using RapidAPI.
    
    Args:
        url_to_check: URL to check
        api_key: RapidAPI key
    
    Returns:
        dict with URL safety details
    """
    api_key = api_key or RAPIDAPI_KEY
    
    if not api_key:
        raise ValueError("RapidAPI key not configured")
    
    headers = {
        'X-RapidAPI-Key': api_key,
        'X-RapidAPI-Host': RAPIDAPI_HOST_THREAT_JAMMER
    }
    
    try:
        response = requests.get(
            f"https://{RAPIDAPI_HOST_THREAT_JAMMER}/api/scanner/url",
            headers=headers,
            params={'url': url_to_check},
            timeout=15
        )
        
        if response.status_code == 200:
            data = response.json()
            malicious_count = data.get('detection_count', 0)
            
            return {
                'status': 'success',
                'url': url_to_check,
                'malicious_count': malicious_count,
                'detection_engines': data.get('detection_engines', {}),
                'is_safe': malicious_count == 0,
                'threat_level': 'high' if malicious_count > 5 else 'medium' if malicious_count > 0 else 'low'
            }
        else:
            raise Exception(f"URL check failed: {response.status_code}")
    
    except Exception as e:
        logger.error(f"RapidAPI URL check error: {e}")
        raise


def enrich_hash(file_hash, api_key=None):
    """
    Check file hash reputation via RapidAPI.
    
    Args:
        file_hash: MD5, SHA1, or SHA256 hash
        api_key: RapidAPI key
    
    Returns:
        dict with hash reputation
    """
    api_key = api_key or RAPIDAPI_KEY
    
    if not api_key:
        raise ValueError("RapidAPI key not configured")
    
    headers = {
        'X-RapidAPI-Key': api_key,
        'X-RapidAPI-Host': RAPIDAPI_HOST_THREAT_JAMMER
    }
    
    try:
        response = requests.get(
            f"https://{RAPIDAPI_HOST_THREAT_JAMMER}/api/scanner/hash",
            headers=headers,
            params={'hash': file_hash},
            timeout=15
        )
        
        if response.status_code == 200:
            data = response.json()
            malicious_count = data.get('detection_count', 0)
            
            return {
                'status': 'success',
                'hash': file_hash,
                'malicious_count': malicious_count,
                'detection_engines': data.get('detection_engines', {}),
                'is_malicious': malicious_count > 0,
                'threat_level': 'high' if malicious_count > 5 else 'medium' if malicious_count > 0 else 'low'
            }
        else:
            raise Exception(f"Hash check failed: {response.status_code}")
    
    except Exception as e:
        logger.error(f"RapidAPI hash check error: {e}")
        raise


def enrich_event(event, api_key=None):
    """
    Enrich security event with external threat intelligence.
    
    Args:
        event: dict with event data (contains IPs, URLs, hashes, domains)
        api_key: RapidAPI key
    
    Returns:
        dict with enriched event data
    """
    api_key = api_key or RAPIDAPI_KEY
    enriched = event.copy()
    
    if not api_key:
        logger.warning("RapidAPI key not configured, skipping enrichment")
        return enriched
    
    try:
        # Enrich IPs
        if 'source_ip' in event:
            try:
                enriched['source_ip_reputation'] = enrich_ip(event['source_ip'], api_key)
            except Exception as e:
                logger.warning(f"Failed to enrich source IP: {e}")
        
        # Enrich URLs
        if 'urls' in event and isinstance(event['urls'], list):
            enriched['url_reputation'] = []
            for url in event['urls'][:5]:  # Limit to 5
                try:
                    enriched['url_reputation'].append(enrich_url(url, api_key))
                except:
                    pass
        
        # Enrich file hashes
        if 'file_hashes' in event and isinstance(event['file_hashes'], list):
            enriched['hash_reputation'] = []
            for file_hash in event['file_hashes'][:5]:  # Limit to 5
                try:
                    enriched['hash_reputation'].append(enrich_hash(file_hash, api_key))
                except:
                    pass
        
        return enriched
    
    except Exception as e:
        logger.error(f"Event enrichment error: {e}")
        return enriched


def batch_enrich_iocs(ioc_list, ioc_type='ip', api_key=None):
    """
    Batch enrich IoCs (respects rate limits).
    
    Args:
        ioc_list: List of IoCs to check
        ioc_type: Type of IoC (ip, url, hash, domain)
        api_key: RapidAPI key
    
    Returns:
        dict with results for each IoC
    """
    results = {}
    
    for ioc in ioc_list[:20]:  # Limit batch size due to rate limits
        try:
            if ioc_type == 'ip':
                results[ioc] = enrich_ip(ioc, api_key)
            elif ioc_type == 'url':
                results[ioc] = enrich_url(ioc, api_key)
            elif ioc_type == 'hash':
                results[ioc] = enrich_hash(ioc, api_key)
        except Exception as e:
            results[ioc] = {'status': 'error', 'message': str(e)}
    
    return results
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
