#!/usr/bin/env python3
import urllib.request
import json
import ssl

# Bypass SSL verification for local testing
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

url = 'https://digistore1-backend.onrender.com/api/admin/products/cleanup-all'
print(f"Calling DELETE {url}")

req = urllib.request.Request(
    url,
    method='DELETE',
    headers={
        'Content-Type': 'application/json',
        'x-cleanup-secret': 'cleanup-digistore1-2024'
    }
)

try:
    with urllib.request.urlopen(req, timeout=120, context=ssl_context) as response:
        print(f'Status: {response.status}')
        body = response.read().decode()
        print(f'Response: {body}')
except urllib.error.HTTPError as e:
    print(f'HTTP Error: {e.code} {e.reason}')
    body = e.read().decode()
    print(f'Body: {body}')
except Exception as e:
    print(f'Error: {e}')

