#!/usr/bin/env python3
import sys

with open("src/core/openclaw_client.py", "rb") as f:
    lines = f.readlines()
    line = lines[101].rstrip()  # Line 102
    print("Line 102 repr:", repr(line))
    print("Line 102 bytes:", [hex(b) for b in line])
    print("Line 102 chars:", [chr(b) if b < 128 else b for b in line])
