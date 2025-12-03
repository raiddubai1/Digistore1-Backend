#!/usr/bin/env python3
"""
Upload ALL ABOUT DOGS ebooks to Cloudinary and create products in the database.
"""

import os
import sys
import requests
import cloudinary
import cloudinary.uploader
from pathlib import Path
import re

# Cloudinary config - using the CORRECT account
cloudinary.config(
    cloud_name="dnb29pk8j",
    api_key="319936465742415",
    api_secret="gXqwvM5yGAVUJufLKS0u5hkcZjU"
)

# Backend API
API_BASE = "https://digistore1-backend.onrender.com/api"
CATEGORY_ID = "cmilryhjn000zea2yj73v29us"  # All About Dogs

# Source folder
SOURCE_DIR = "/Volumes/Raid1/Users/raidf/Downloads/ALL ABOUT DOGS"

def clean_title(filename):
    """Convert filename to clean product title"""
    name = Path(filename).stem
    # Add spaces before capital letters
    name = re.sub(r'([a-z])([A-Z])', r'\1 \2', name)
    # Replace underscores and hyphens with spaces
    name = name.replace('_', ' ').replace('-', ' ')
    # Clean up multiple spaces
    name = re.sub(r'\s+', ' ', name).strip()
    return name

def create_slug(title):
    """Create URL-friendly slug from title"""
    slug = title.lower()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'\s+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug.strip('-')

def upload_to_cloudinary(file_path):
    """Upload PDF to Cloudinary and return URL"""
    filename = Path(file_path).name
    print(f"  Uploading to Cloudinary: {filename}")
    
    result = cloudinary.uploader.upload(
        file_path,
        resource_type="raw",
        folder="digistore1/ebooks/all-about-dogs",
        public_id=create_slug(Path(file_path).stem),
        overwrite=True
    )
    return result['secure_url']

def create_product(title, file_url, file_size):
    """Create product in the database"""
    slug = create_slug(title)
    
    payload = {
        "title": title,
        "slug": slug,
        "description": f"Free eBook: {title}. This comprehensive guide covers everything you need to know about dogs, from training tips to health care advice.",
        "price": 0,
        "categoryId": CATEGORY_ID,
        "fileUrl": file_url,
        "fileType": "pdf",
        "fileSize": file_size,
        "status": "APPROVED",
        "featured": False,
        "thumbnailUrl": "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400"
    }
    
    response = requests.post(f"{API_BASE}/products", json=payload)
    if response.status_code in [200, 201]:
        print(f"  ✓ Created product: {title}")
        return True
    else:
        print(f"  ✗ Failed to create product: {response.text}")
        return False

def main():
    # Get all PDF files
    pdf_files = [f for f in os.listdir(SOURCE_DIR) if f.lower().endswith('.pdf')]
    print(f"Found {len(pdf_files)} PDF files to process\n")
    
    success = 0
    failed = 0
    
    for i, filename in enumerate(pdf_files, 1):
        file_path = os.path.join(SOURCE_DIR, filename)
        file_size = os.path.getsize(file_path)
        title = clean_title(filename)
        
        print(f"[{i}/{len(pdf_files)}] Processing: {title}")
        
        try:
            # Upload to Cloudinary
            file_url = upload_to_cloudinary(file_path)
            
            # Create product
            if create_product(title, file_url, file_size):
                success += 1
            else:
                failed += 1
        except Exception as e:
            print(f"  ✗ Error: {e}")
            failed += 1
        
        print()
    
    print(f"\n{'='*50}")
    print(f"DONE! Success: {success}, Failed: {failed}")

if __name__ == "__main__":
    main()

