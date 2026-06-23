#!/usr/bin/env python3
import sys
import json
sys.path.insert(0, '.')

from app import create_app
from app.src.analysis.file_analysis import Analyzer

app = create_app()
with app.app_context():
    analyzer = Analyzer()
    results = analyzer.analyze('instance/sample_analysis.txt')
    
    print("\n" + "="*80)
    print("FILE ANALYSIS RESULTS")
    print("="*80)
    print(json.dumps(results, indent=2, default=str))
    print("="*80)
