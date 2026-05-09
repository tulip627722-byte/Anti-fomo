#!/usr/bin/env python3
import ast
import sys

try:
    with open('app.py', 'r', encoding='utf-8') as f:
        code = f.read()
    ast.parse(code)
    print("✓ Syntax is valid")
except SyntaxError as e:
    print(f"❌ Syntax error at line {e.lineno}:")
    print(f"   {e.msg}")
    print(f"   {e.text}")
    sys.exit(1)
