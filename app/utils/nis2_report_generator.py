"""
NIS2 Incident Report PDF Generator

Generates formatted PDF reports for NIS2 critical infrastructure incidents
suitable for submission to competent authorities (BSI, ANSSI, etc.)
"""

from io import BytesIO
from datetime import datetime
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY


class NIS2ReportGenerator:
    """Generate PDF reports for NIS2 incident submissions."""

    def __init__(self, incident_data):
        """
        Initialize with incident data dictionary.
        Expected fields:
        - id, incident_type, severity, affected_systems
        - initial_detection_at, description, actions_taken
        - notification_recipient, status, created_at
        - user (with email, company info)
        """
        self.incident = incident_data
        self.pagesize = A4
        self.margins = 0.75 * inch

    def generate_pdf(self) -> BytesIO:
        """Generate and return PDF as BytesIO object."""
        buffer = BytesIO()

        doc = SimpleDocTemplate(
            buffer,
            pagesize=self.pagesize,
            rightMargin=self.margins,
            leftMargin=self.margins,
            topMargin=self.margins,
            bottomMargin=self.margins,
        )

        styles = getSampleStyleSheet()
        story = []

        # Custom styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#0066cc'),
            spaceAfter=12,
            fontName='Helvetica-Bold',
        )

        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=14,
            textColor=colors.HexColor('#0066cc'),
            spaceAfter=6,
            spaceBefore=12,
            fontName='Helvetica-Bold',
        )

        # Title
        story.append(Paragraph('NIS2 INCIDENT REPORT', title_style))
        story.append(Spacer(1, 0.2 * inch))

        # Metadata Table
        metadata = [
            ['Incident ID:', self.incident.get('id', 'N/A')],
            ['Report Date:', datetime.now().strftime('%Y-%m-%d %H:%M:%S')],
            ['Reporting Organization:', self.incident.get('user', {}).get('company', 'N/A')],
            ['Reporter Email:', self.incident.get('user', {}).get('email', 'N/A')],
        ]

        metadata_table = Table(metadata, colWidths=[2 * inch, 4 * inch])
        metadata_table.setStyle(
            TableStyle([
                ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f0f0f0')),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#d0d0d0')),
            ])
        )
        story.append(metadata_table)
        story.append(Spacer(1, 0.3 * inch))

        # Incident Overview Section
        story.append(Paragraph('INCIDENT OVERVIEW', heading_style))

        severity_color_map = {
            'critical': colors.HexColor('#d32f2f'),
            'high': colors.HexColor('#f57c00'),
            'medium': colors.HexColor('#fbc02d'),
            'low': colors.HexColor('#388e3c'),
        }
        severity_color = severity_color_map.get(
            self.incident.get('severity', 'medium'), colors.black
        )

        overview_data = [
            ['Incident Type:', self.incident.get('incident_type', 'N/A').replace('_', ' ').title()],
            ['Severity Level:', self.incident.get('severity', 'N/A').upper()],
            ['Initial Detection:', self.incident.get('initial_detection_at', 'N/A')],
            ['Current Status:', self.incident.get('status', 'N/A').title()],
        ]

        overview_table = Table(overview_data, colWidths=[2 * inch, 4 * inch])
        overview_table.setStyle(
            TableStyle([
                ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f0f0f0')),
                ('TEXTCOLOR', (1, 1), (1, 1), severity_color),
                ('FONTNAME', (1, 1), (1, 1), 'Helvetica-Bold'),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#d0d0d0')),
            ])
        )
        story.append(overview_table)
        story.append(Spacer(1, 0.3 * inch))

        # Affected Systems Section
        story.append(Paragraph('AFFECTED SYSTEMS', heading_style))
        affected_systems = self.incident.get('affected_systems', 'N/A')
        story.append(
            Paragraph(
                f'<b>Systems Impacted:</b> {affected_systems}',
                styles['Normal'],
            )
        )
        story.append(Spacer(1, 0.2 * inch))

        # Incident Description Section
        story.append(Paragraph('INCIDENT DESCRIPTION', heading_style))
        description = self.incident.get('description', 'No description provided')
        story.append(Paragraph(description, styles['Normal']))
        story.append(Spacer(1, 0.2 * inch))

        # Actions Taken Section
        story.append(Paragraph('REMEDIATION ACTIONS', heading_style))
        actions = self.incident.get('actions_taken', 'No actions documented')
        story.append(Paragraph(actions, styles['Normal']))
        story.append(Spacer(1, 0.2 * inch))

        # Notification Details Section
        if self.incident.get('notification_recipient'):
            story.append(Paragraph('COMPETENT AUTHORITY NOTIFICATION', heading_style))
            notification_data = [
                ['Recipient:', self.incident.get('notification_recipient', 'N/A')],
                ['Notification Sent:', self.incident.get('notification_sent_at', 'Pending')],
            ]
            notification_table = Table(notification_data, colWidths=[2 * inch, 4 * inch])
            notification_table.setStyle(
                TableStyle([
                    ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f0f0f0')),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 10),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                    ('TOPPADDING', (0, 0), (-1, -1), 8),
                    ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#d0d0d0')),
                ])
            )
            story.append(notification_table)
            story.append(Spacer(1, 0.2 * inch))

        # Footer
        story.append(Spacer(1, 0.3 * inch))
        footer_style = ParagraphStyle(
            'Footer',
            parent=styles['Normal'],
            fontSize=8,
            textColor=colors.grey,
            alignment=TA_CENTER,
        )
        story.append(
            Paragraph(
                'This document contains confidential information related to a critical infrastructure incident. '
                'It is intended for authorized recipients only and must be handled according to applicable data protection regulations.',
                footer_style,
            )
        )
        story.append(Spacer(1, 0.1 * inch))
        story.append(
            Paragraph(
                f'Generated by gueInsight Compliance Platform on {datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")}',
                footer_style,
            )
        )

        # Build PDF
        doc.build(story)
        buffer.seek(0)
        return buffer
