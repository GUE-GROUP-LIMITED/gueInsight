"""
Slack integration for alert and notification delivery.
"""
import requests
import os
import logging
import json

logger = logging.getLogger(__name__)


def send_alert_to_slack(webhook_url, alert_data):
    """
    Send security alert to Slack channel.
    
    Args:
        webhook_url: Slack webhook URL
        alert_data: dict with alert information
    
    Returns:
        dict with success status
    """
    try:
        payload = {
            'text': f"🚨 GueInsight Security Alert",
            'attachments': [
                {
                    'color': 'danger',
                    'title': alert_data.get('title', 'Security Alert'),
                    'text': alert_data.get('description', ''),
                    'fields': [
                        {
                            'title': 'Severity',
                            'value': alert_data.get('severity', 'Unknown'),
                            'short': True
                        },
                        {
                            'title': 'Timestamp',
                            'value': alert_data.get('timestamp', ''),
                            'short': True
                        },
                        {
                            'title': 'Alert Type',
                            'value': alert_data.get('alert_type', ''),
                            'short': True
                        }
                    ],
                    'actions': [
                        {
                            'type': 'button',
                            'text': 'View in GueInsight',
                            'url': alert_data.get('view_url', '#')
                        }
                    ]
                }
            ]
        }
        
        response = requests.post(
            webhook_url,
            json=payload,
            timeout=10
        )
        
        if response.status_code == 200:
            return {'status': 'success', 'message': 'Alert sent to Slack'}
        else:
            raise Exception(f"Slack API returned {response.status_code}: {response.text}")
    
    except Exception as e:
        logger.error(f"Slack alert error: {e}")
        raise


def send_analysis_summary_to_slack(webhook_url, analysis_data):
    """
    Send analysis summary to Slack.
    
    Args:
        webhook_url: Slack webhook URL
        analysis_data: dict with analysis results
    
    Returns:
        dict with success status
    """
    try:
        payload = {
            'text': '📊 Analysis Report Summary',
            'attachments': [
                {
                    'color': '#36a64f',
                    'title': analysis_data.get('file_name', 'Analysis Report'),
                    'text': analysis_data.get('summary', ''),
                    'fields': [
                        {
                            'title': 'Threats Detected',
                            'value': str(analysis_data.get('threats_detected', 0)),
                            'short': True
                        },
                        {
                            'title': 'Processing Time',
                            'value': f"{analysis_data.get('processing_ms', 0)}ms",
                            'short': True
                        },
                        {
                            'title': 'IoCs Found',
                            'value': str(analysis_data.get('iocs_count', 0)),
                            'short': True
                        },
                        {
                            'title': 'Status',
                            'value': analysis_data.get('status', 'Unknown'),
                            'short': True
                        }
                    ]
                }
            ]
        }
        
        response = requests.post(
            webhook_url,
            json=payload,
            timeout=10
        )
        
        if response.status_code == 200:
            return {'status': 'success'}
        else:
            raise Exception(f"Slack API error: {response.status_code}")
    
    except Exception as e:
        logger.error(f"Slack summary error: {e}")
        raise


def test_webhook(webhook_url):
    """Test Slack webhook connection."""
    try:
        payload = {
            'text': '✅ GueInsight is connected to Slack!',
            'attachments': [
                {
                    'color': '#36a64f',
                    'text': 'Successfully integrated with GueInsight'
                }
            ]
        }
        
        response = requests.post(
            webhook_url,
            json=payload,
            timeout=10
        )
        
        if response.status_code == 200:
            return {'status': 'success', 'message': 'Webhook test successful'}
        else:
            raise Exception(f"Test failed with code {response.status_code}")
    
    except Exception as e:
        logger.error(f"Webhook test error: {e}")
        raise
