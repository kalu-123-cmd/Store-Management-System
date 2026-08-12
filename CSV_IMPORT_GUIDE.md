# CSV Product Import Guide

## 📋 Required CSV Format

Your CSV file must have these columns:

**Required:**
- `name` - Product name
- `sku` - Unique product identifier (SKU)

**Optional:**
- `category` - Product category
- `stock` - Stock quantity
- `costPrice` - Cost price
- `sellingPrice` - Selling price
- `margin` - Profit margin percentage
- `barcode` - Product barcode
- `brand` - Product brand
- `status` - Product status

## 📝 Sample CSV Format

```csv
name,sku,category,stock,costPrice,sellingPrice,margin
LED Bulb 9W,ELC-001,Electronics,50,180.00,200.00,10.0
LED Bulb 15W,ELC-002,Electronics,35,280.00,300.00,7.1
Extension Cord,ELC-003,Electronics,20,450.00,500.00,10.0
```

## 🚀 How to Import Products in Bulk

### Step 1: Prepare Your CSV File

Create a CSV file with your products using the format above. You can use Excel, Google Sheets, or any spreadsheet software and export as CSV.

### Step 2: Navigate to CSV Import

1. Log in to your StoreOS application
2. Click "CSV Import" in the sidebar navigation
3. You'll see the CSV Import page

### Step 3: Upload Your CSV File

1. Click "Select CSV File" or drag and drop your CSV file
2. The system will validate your file (must be .csv, max 10MB)
3. Click "Preview Import"

### Step 4: Review Validation Results

The system will show:
- **Total Rows** - How many products in your CSV
- **Valid** - How many rows passed validation
- **Warnings** - Rows with minor issues (will still import)
- **Errors** - Rows that failed validation (will not import)
- **Will Create** - New products to be added
- **Will Update** - Existing products to be updated
- **Stock Changes** - How many stock adjustments will occur

### Step 5: Confirm Import

1. Review the validation table
2. If there are no errors, click "Import Products"
3. Wait for the import to complete

### Step 6: View Results

After import:
- System automatically navigates to Dashboard
- You'll see updated product counts
- Inventory values will reflect imported data
- Stock movements are created for audit trail

## 🔧 Column Name Variations Supported

The system understands multiple column naming conventions:

**Product Name:** `name`, `product_name`, `productName`, `Product Name`
**SKU:** `sku`, `Sku`, `SKU`
**Stock:** `stock`, `quantity`, `currentStock`
**Cost Price:** `costPrice`, `cost_price`, `costprice`, `Cost Price`
**Selling Price:** `sellingPrice`, `selling_price`, `sellingprice`, `price`
**Category:** `category`, `Category`

## ✅ What Happens During Import

1. **Validation** - Checks required fields, numeric values, duplicate SKUs
2. **SKU Matching** - Identifies if product exists (UPDATE) or is new (CREATE)
3. **Product Sync** - Updates only fields present in CSV
4. **Inventory Sync** - Sets stock to CSV value (not additive)
5. **Stock Movement** - Creates ADJUSTMENT movement for audit trail
6. **Category Sync** - Auto-creates categories if needed
7. **Dashboard Refresh** - Automatically updates all metrics
8. **Audit Log** - Creates comprehensive audit trail

## 🎯 Important Notes

- **SKU is the key** - Use SKU to identify products
- **Empty fields don't overwrite** - If a field is empty in CSV, database value stays the same
- **Stock is set, not added** - CSV stock becomes the database stock
- **Duplicate SKUs in CSV** - Will be rejected with error
- **Transaction safety** - If any row fails, entire import rolls back

## 📊 Example CSV with 5 Products

```csv
name,sku,category,stock,costPrice,sellingPrice,margin
iPhone 15 Pro,PHONE-001,Electronics,10,85000,95000,11.8
Samsung Galaxy S24,PHONE-002,Electronics,15,65000,75000,13.3
MacBook Pro 16,LAPTOP-001,Electronics,5,85000,95000,10.5
Dell XPS 15,LAPTOP-002,Electronics,8,75000,95000,21.1
Sony TV 55",TV-001,Electronics,3,35000,45000,22.2
```

## ❌ Common Errors to Avoid

1. **Missing SKU** - Every row must have a unique SKU
2. **Missing Name** - Every row must have a product name
3. **Negative stock** - Stock must be 0 or positive
4. **Negative prices** - Cost and selling prices must be 0 or positive
5. **Duplicate SKUs in CSV** - Same SKU appearing twice in your file
6. **Invalid characters** - Special characters in SKU that aren't alphanumeric

## 🆘 Troubleshooting

If import fails:
1. Check CSV file is actually .csv format (not .xlsx)
2. Check required columns (name, sku) are present
3. Check numeric fields contain valid numbers
4. Check for duplicate SKUs in your CSV
5. Download error report for specific row-level issues

## 📥 Sample File Available

A sample CSV file is available at:
`data/products-import-sample.csv`

You can use this as a template or directly import it to test the system.