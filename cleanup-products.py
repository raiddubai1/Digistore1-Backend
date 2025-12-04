#!/usr/bin/env python3
import urllib.request
import json

# Test if backend is up
print("Testing backend connection...")
try:
    req = urllib.request.Request(
        "https://digistore1-backend.onrender.com/api/products?limit=1",
        headers={"User-Agent": "Python/3.0"}
    )
    with urllib.request.urlopen(req, timeout=60) as response:
        data = json.loads(response.read())
        total = data['data']['pagination']['total']
        print(f"Backend is up. Products found: {total}")
        
        if total == 0:
            print("No products to delete!")
        else:
            print(f"\nDeleting all {total} products...")
            # Call the cleanup endpoint
            delete_req = urllib.request.Request(
                "https://digistore1-backend.onrender.com/api/admin/products/cleanup-all",
                method="DELETE",
                headers={
                    "User-Agent": "Python/3.0",
                    "Content-Type": "application/json",
                    "x-cleanup-secret": "cleanup-digistore1-2024"
                }
            )
            with urllib.request.urlopen(delete_req, timeout=120) as delete_response:
                result = json.loads(delete_response.read())
                print(f"Result: {result}")
except Exception as e:
    print(f"Error: {e}")

