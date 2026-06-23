#!/usr/bin/env python
"""Test Flask routes configuration."""

from app.app import create_app

app = create_app()

print("Analysis and Branding Routes Registered:")
print("-" * 60)
for rule in sorted(app.url_map.iter_rules(), key=lambda r: r.rule):
    if 'analysis' in rule.rule.lower() or 'branding' in rule.rule.lower():
        methods = rule.methods - {'HEAD', 'OPTIONS'}
        print(f"{str(methods):30} {rule.rule:45} -> {rule.endpoint}")
print("-" * 60)
print("✅ Flask app initialized successfully!")
