#!/bin/bash

# Category Restructuring Script
# This script uses the existing admin API endpoints to restructure categories

API_URL="https://digistore1-backend.onrender.com"
SECRET="cleanup-digistore1-2024"

echo "=============================================="
echo "DIGISTORE1 CATEGORY RESTRUCTURING"
echo "=============================================="

# Function to delete a product by slug
delete_product() {
    local slug=$1
    echo "  Deleting product: $slug"
    curl -s -X DELETE "${API_URL}/api/admin/products/${slug}" \
        -H "x-admin-secret: ${SECRET}" \
        -H "Content-Type: application/json" | python3 -c "import sys,json; d=json.load(sys.stdin); print('    ✓ Deleted' if d.get('success') else '    ✗ Failed: ' + d.get('message', 'Unknown error'))"
}

# Function to delete a category by ID
delete_category() {
    local cat_id=$1
    local cat_name=$2
    echo "  Deleting category: $cat_name"
    curl -s -X DELETE "${API_URL}/api/admin/categories/${cat_id}" \
        -H "x-admin-secret: ${SECRET}" \
        -H "Content-Type: application/json" | python3 -c "import sys,json; d=json.load(sys.stdin); print('    ✓ Deleted' if d.get('success') else '    ✗ Failed: ' + d.get('message', 'Unknown error'))"
}

# Function to create a category
create_category() {
    local name=$1
    local parent_id=$2
    local active=$3
    echo "  Creating category: $name"
    
    if [ -z "$parent_id" ]; then
        body="{\"name\": \"$name\", \"active\": $active}"
    else
        body="{\"name\": \"$name\", \"parentId\": \"$parent_id\", \"active\": $active}"
    fi
    
    result=$(curl -s -X POST "${API_URL}/api/admin/categories" \
        -H "x-admin-secret: ${SECRET}" \
        -H "Content-Type: application/json" \
        -d "$body")
    
    cat_id=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data', {}).get('category', {}).get('id', ''))" 2>/dev/null)
    echo "    ✓ Created: $cat_id"
    echo "$cat_id"
}

# Function to update product category
move_product() {
    local slug=$1
    local new_cat_id=$2
    echo "  Moving product: $slug"
    curl -s -X PUT "${API_URL}/api/admin/products/update-thumbnail" \
        -H "x-admin-secret: ${SECRET}" \
        -H "Content-Type: application/json" \
        -d "{\"slug\": \"$slug\", \"categoryId\": \"$new_cat_id\"}" | python3 -c "import sys,json; d=json.load(sys.stdin); print('    ✓ Moved' if d.get('success') else '    ✗ Failed: ' + d.get('message', 'Unknown error'))"
}

# Get all products and extract the ones to delete
echo ""
echo "[STEP 1] Getting all products..."
PRODUCTS_JSON=$(curl -s "${API_URL}/api/products?limit=1000")

# Extract product slugs for eBooks categories
EBOOKS_SLUGS=$(echo "$PRODUCTS_JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
products = data.get('data', {}).get('products', [])
ebooks_cats = [
    'cmitanjuz0000h43howmybvro', 'cmitbeyeq0003iy3hxy92jsjq', 'cmitbeyob0005iy3hv4ux9vgh',
    'cmitdk0gg003biy3h692hhf8o', 'cmitbez93000diy3h2pjqai9g', 'cmitbeysm0007iy3hqnjaoek2',
    'cmitbezdj000fiy3hhnrn7grc', 'cmitbez5k000biy3hbbtd7cy5', 'cmitbeyx00009iy3hd3ok6viy'
]
for p in products:
    if p.get('category', {}).get('id') in ebooks_cats:
        print(p['slug'])
")

# Extract product slugs for Courses categories
COURSES_SLUGS=$(echo "$PRODUCTS_JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
products = data.get('data', {}).get('products', [])
courses_cats = ['cmitanl80000fh43hs2gwoylj', 'cmitbf3vm002fiy3habw2h2df', 'cmitbf41n002hiy3h2oyzt7w1', 'cmitbf3qz002diy3hx3lhyi62']
for p in products:
    if p.get('category', {}).get('id') in courses_cats:
        print(p['slug'])
")

echo ""
echo "[STEP 2] Deleting eBooks products ($(echo "$EBOOKS_SLUGS" | wc -l | tr -d ' ') products)..."
for slug in $EBOOKS_SLUGS; do
    delete_product "$slug"
done

echo ""
echo "[STEP 3] Deleting Courses products ($(echo "$COURSES_SLUGS" | wc -l | tr -d ' ') products)..."
for slug in $COURSES_SLUGS; do
    delete_product "$slug"
done

echo ""
echo "[STEP 4] Deleting eBooks subcategories..."
# Delete children first, then parent
for cat_id in cmitdk0gg003biy3h692hhf8o cmitbeyeq0003iy3hxy92jsjq cmitbeyob0005iy3hv4ux9vgh cmitbez93000diy3h2pjqai9g cmitbeysm0007iy3hqnjaoek2 cmitbezdj000fiy3hhnrn7grc cmitbez5k000biy3hbbtd7cy5 cmitbeyx00009iy3hd3ok6viy; do
    delete_category "$cat_id" "eBooks subcategory"
done
delete_category "cmitanjuz0000h43howmybvro" "eBooks (parent)"

echo ""
echo "[STEP 5] Deleting Courses subcategories..."
for cat_id in cmitbf3vm002fiy3habw2h2df cmitbf41n002hiy3h2oyzt7w1 cmitbf3qz002diy3hx3lhyi62; do
    delete_category "$cat_id" "Courses subcategory"
done
delete_category "cmitanl80000fh43hs2gwoylj" "Courses & Learning (parent)"

echo ""
echo "=============================================="
echo "DELETION COMPLETE - Moving to merges..."
echo "=============================================="

# STEP 6: Create "Business & Marketing Templates" under Canva Templates and move products
echo ""
echo "[STEP 6] Creating 'Business & Marketing Templates' under Canva Templates..."
NEW_CANVA_CAT=$(create_category "Business & Marketing Templates" "cmitanknl0006h43h511ct82l" "true")

echo "Moving products from old Canva subcategories to new one..."
# Get products from Business Templates, Marketing Templates, Social Media Packs
CANVA_MOVE_SLUGS=$(echo "$PRODUCTS_JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
products = data.get('data', {}).get('products', [])
canva_cats = ['cmitbf16z0017iy3hlce3tnng', 'cmitbf1lu001biy3h2omf0mea', 'cmitbf2ct001piy3h6z0xu74z']
for p in products:
    if p.get('category', {}).get('id') in canva_cats:
        print(p['slug'])
")

for slug in $CANVA_MOVE_SLUGS; do
    move_product "$slug" "$NEW_CANVA_CAT"
done

echo "Deleting old Canva subcategories..."
for cat_id in cmitbf16z0017iy3hlce3tnng cmitbf1lu001biy3h2omf0mea cmitbf2ct001piy3h6z0xu74z; do
    delete_category "$cat_id" "Old Canva subcategory"
done

# STEP 7: Create "Productivity & Lifestyle" under Planners & Printables and move products
echo ""
echo "[STEP 7] Creating 'Productivity & Lifestyle' under Planners & Printables..."
NEW_PLANNERS_CAT=$(create_category "Productivity & Lifestyle" "cmitanldb000ih43hbi9a9lx9" "true")

echo "Moving products from old Planners subcategories to new one..."
PLANNERS_MOVE_SLUGS=$(echo "$PRODUCTS_JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
products = data.get('data', {}).get('products', [])
planners_cats = ['cmitbf4uu002riy3hr8vaczqg', 'cmitbf4m3002niy3hib1fm7t8', 'cmitbf47v002jiy3hm7h6b646']
for p in products:
    if p.get('category', {}).get('id') in planners_cats:
        print(p['slug'])
")

for slug in $PLANNERS_MOVE_SLUGS; do
    move_product "$slug" "$NEW_PLANNERS_CAT"
done

echo "Deleting old Planners subcategories..."
for cat_id in cmitbf4uu002riy3hr8vaczqg cmitbf4m3002niy3hib1fm7t8 cmitbf47v002jiy3hm7h6b646; do
    delete_category "$cat_id" "Old Planners subcategory"
done

# STEP 8: Create hidden "Free Resources Library"
echo ""
echo "[STEP 8] Creating hidden 'Free Resources Library' category..."
create_category "Free Resources Library" "" "false"

echo ""
echo "=============================================="
echo "RESTRUCTURING COMPLETE!"
echo "=============================================="
echo ""
echo "Please verify the new category structure at:"
echo "${API_URL}/api/categories"

