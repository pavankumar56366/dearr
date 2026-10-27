# Shiprocket Logistics Integration — Production Go-Live Checklist

> **Target Environment:** Hostinger Production (Node.js + MySQL 8.x)\
> **Branch:** `feature/integrations-shiprocket`\
> **Release Coordinator:** Founder (Henry) / Lead Developer\
> **Status:** Pre-Release Validation Complete (Ready for Staged Deployment)

---

## 1. Important Safety & Rollout Constraints

> [!IMPORTANT]
> - **Hostinger production currently has migrations 001–012 applied.**
> - **Migrations 013 and 014 remain UNAPPLIED on Hostinger production until you execute Step 3 of this checklist.**
> - Do not push directly to `main` or merge without reviewing this document.
> - The application handles `SHIPROCKET_ENABLED=false` or unconfigured states with **100% graceful fallback**: customers can still checkout using the neutral ₹50 standard shipping fee.

---

## 2. Checklist Matrix

| Step | Action Item | Environment | Owner | Verified |
| :--- | :--- | :--- | :--- | :---: |
| **1.1** | Add server environment variables | Hostinger `.env` | Founder | [ ] |
| **1.2** | Verify primary pickup PIN code | Hostinger `.env` | Founder | [ ] |
| **2.1** | Verify Shiprocket pickup address | Shiprocket Dashboard | Founder | [ ] |
| **2.2** | Recharge Shiprocket wallet balance | Shiprocket Dashboard | Founder | [ ] |
| **2.3** | Register Webhook in Shiprocket | Shiprocket Dashboard | Founder | [ ] |
| **3.1** | Backup production MySQL database | Hostinger phpMyAdmin | Founder | [ ] |
| **3.2** | Execute Migration 013 on production | Hostinger phpMyAdmin | Founder | [ ] |
| **3.3** | Execute Migration 014 on production | Hostinger phpMyAdmin | Founder | [ ] |
| **3.4** | Run post-migration verification query | Hostinger phpMyAdmin | Founder | [ ] |
| **4.1** | Merge `feature/integrations-shiprocket` to `main` | GitHub | Founder | [ ] |
| **4.2** | Deploy latest build to Hostinger | Hostinger Node.js | Founder | [ ] |
| **4.3** | Perform end-to-end smoke test | Production Storefront | Founder | [ ] |

---

## 3. Detailed Step-by-Step Instructions

### Step 1: Configure Production Environment Variables

Add the following variables to Hostinger's environment configuration (via Hostinger hPanel > Web Applications > Environment Variables or `.env` file):

```bash
# Shiprocket Logistics Integration (Server-Only — Never prefix with NEXT_PUBLIC_)
SHIPROCKET_ENABLED="true"
SHIPROCKET_EMAIL="your-official-shiprocket-email@domain.com"
SHIPROCKET_PASSWORD="your-strong-shiprocket-password"
SHIPROCKET_WEBHOOK_TOKEN="generate-a-64-char-random-hex-token-here"
PRIMARY_PICKUP_PINCODE="560038" # Replace with your actual warehouse / office PIN code
```

> [!CAUTION]
> Never expose `SHIPROCKET_PASSWORD` or `SHIPROCKET_WEBHOOK_TOKEN` to the client. All files in the codebase use `import "server-only"` to shield these secrets.

---

### Step 2: Shiprocket Dashboard Setup

1. **Verify Pickup Address (`Settings > Pickup Addresses`):**
   - Ensure you have at least one registered pickup address (e.g. named `"Primary"`).
   - Ensure the address details (Contact Name, Phone, Full Address, and PIN code) are verified and active.
   - The PIN code should match `PRIMARY_PICKUP_PINCODE`.
2. **Recharge Wallet Balance (`Billing > Recharge Wallet`):**
   - Shiprocket requires available wallet balance to book shipments and assign AWBs.
   - Recommended initial balance: **₹500 – ₹1,000**.
   - *Note:* If the wallet balance runs out, the Dearr admin dashboard will display a friendly *"Insufficient Shiprocket wallet balance"* alert rather than crashing.
3. **Configure Webhook (`Settings > API > Webhooks`):**
   - Click **Add New Webhook**.
   - **Webhook URL:** `https://dearr.in/api/webhooks/courier-updates`
     *(Note: This URL intentionally does NOT contain "shiprocket", "kartrocket", or "sr" to satisfy Shiprocket's strict URL format validators).*
   - **Secret Key / Webhook Token:** Paste the identical token you set for `SHIPROCKET_WEBHOOK_TOKEN`.
   - **Event Triggers:** Check:
     - `Shipment Status Update`
     - `Order Status Update`
     - `Tracking Scans`
     - `Delivery Complete`

---

### Step 3: Production Database Migrations

Before triggering the deployment build, apply migrations 013 and 014 to your Hostinger MySQL database.

#### 3.1 Create a Backup
In Hostinger hPanel > Databases > phpMyAdmin, select your production database (`dearr_production`) and click **Export** (Quick > SQL).

#### 3.2 Apply Migration 013
Run `database/migrations/013_shiprocket_integration.sql` in phpMyAdmin SQL tab:
```sql
-- 1. Create order_shipments table
CREATE TABLE IF NOT EXISTS `order_shipments` (
  `id` CHAR(36) NOT NULL,
  `order_id` CHAR(36) NOT NULL,
  `shiprocket_order_id` VARCHAR(50) DEFAULT NULL,
  `shiprocket_shipment_id` VARCHAR(50) DEFAULT NULL,
  `awb_code` VARCHAR(100) DEFAULT NULL,
  `courier_id` INT DEFAULT NULL,
  `courier_name` VARCHAR(100) DEFAULT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'NEW',
  `pickup_location` VARCHAR(100) NOT NULL DEFAULT 'Primary',
  `pickup_scheduled_date` VARCHAR(50) DEFAULT NULL,
  `pickup_token` VARCHAR(100) DEFAULT NULL,
  `label_url` TEXT DEFAULT NULL,
  `manifest_url` TEXT DEFAULT NULL,
  `tracking_url` TEXT DEFAULT NULL,
  `etd` VARCHAR(50) DEFAULT NULL,
  `last_tracking_activity` VARCHAR(255) DEFAULT NULL,
  `last_tracking_at` DATETIME DEFAULT NULL,
  `raw_response` JSON DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_order_shipments_order_id` (`order_id`),
  KEY `idx_order_shipments_awb` (`awb_code`),
  CONSTRAINT `fk_order_shipments_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Add columns to orders
ALTER TABLE `orders`
  ADD COLUMN `awb_code` VARCHAR(100) DEFAULT NULL AFTER `shipping_postal_code`,
  ADD COLUMN `courier_name` VARCHAR(100) DEFAULT NULL AFTER `awb_code`,
  ADD COLUMN `courier_status` VARCHAR(50) DEFAULT NULL AFTER `courier_name`;
```

#### 3.3 Apply Migration 014
Run `database/migrations/014_shiprocket_advanced_logistics.sql` in phpMyAdmin SQL tab:
```sql
-- 1. Add authoritative logistics & accounting columns to orders
ALTER TABLE `orders`
  ADD COLUMN `payment_method` VARCHAR(50) DEFAULT 'prepaid' AFTER `currency`,
  ADD COLUMN `shipping_base_amount` DECIMAL(10,2) DEFAULT 0.00 AFTER `shipping_amount`,
  ADD COLUMN `shipping_markup_amount` DECIMAL(10,2) DEFAULT 0.00 AFTER `shipping_base_amount`,
  ADD COLUMN `shipping_courier_id` INT DEFAULT NULL AFTER `shipping_markup_amount`,
  ADD COLUMN `shipping_courier_name` VARCHAR(150) DEFAULT NULL AFTER `shipping_courier_id`,
  ADD COLUMN `shipping_estimated_days` INT DEFAULT NULL AFTER `shipping_courier_name`,
  ADD COLUMN `shipping_rate_source` VARCHAR(50) DEFAULT 'standard' AFTER `shipping_estimated_days`,
  ADD COLUMN `cod_fee_amount` DECIMAL(10,2) DEFAULT 0.00 AFTER `shipping_rate_source`,
  ADD COLUMN `cod_collected_at` DATETIME DEFAULT NULL AFTER `cod_fee_amount`;

-- 2. Add per-product COD and lead-time columns to products
ALTER TABLE `products`
  ADD COLUMN `cod_fee` DECIMAL(10,2) DEFAULT NULL AFTER `cod_enabled`,
  ADD COLUMN `dispatch_lead_days` INT DEFAULT 2 AFTER `cod_fee`,
  ADD COLUMN `dispatch_timeline_text` VARCHAR(100) DEFAULT NULL AFTER `dispatch_lead_days`;

-- 3. Add actual freight cost to order_shipments
ALTER TABLE `order_shipments`
  ADD COLUMN `shipment_actual_cost` DECIMAL(10,2) DEFAULT NULL AFTER `courier_name`;

-- 4. Create shipment_tracking_events table for live scan milestones
CREATE TABLE IF NOT EXISTS `shipment_tracking_events` (
  `id` CHAR(36) NOT NULL,
  `order_id` CHAR(36) NOT NULL,
  `shipment_id` CHAR(36) DEFAULT NULL,
  `awb_code` VARCHAR(100) NOT NULL,
  `activity` VARCHAR(255) NOT NULL,
  `location` VARCHAR(150) DEFAULT NULL,
  `event_timestamp` DATETIME NOT NULL,
  `sr_status` VARCHAR(50) DEFAULT NULL,
  `raw_scan` JSON DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_tracking_event_unique` (`awb_code`, `activity`, `event_timestamp`),
  KEY `idx_tracking_order_id` (`order_id`),
  CONSTRAINT `fk_tracking_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### 3.4 Verification Query
Execute this verification query in phpMyAdmin to verify all tables and columns are created:
```sql
SELECT 'order_shipments' AS tbl, COUNT(*) AS count FROM information_schema.COLUMNS WHERE TABLE_NAME='order_shipments' AND TABLE_SCHEMA=DATABASE()
UNION ALL
SELECT 'shipment_tracking_events' AS tbl, COUNT(*) AS count FROM information_schema.COLUMNS WHERE TABLE_NAME='shipment_tracking_events' AND TABLE_SCHEMA=DATABASE()
UNION ALL
SELECT 'orders.cod_fee_amount' AS tbl, COUNT(*) AS count FROM information_schema.COLUMNS WHERE TABLE_NAME='orders' AND COLUMN_NAME='cod_fee_amount' AND TABLE_SCHEMA=DATABASE()
UNION ALL
SELECT 'products.cod_fee' AS tbl, COUNT(*) AS count FROM information_schema.COLUMNS WHERE TABLE_NAME='products' AND COLUMN_NAME='cod_fee' AND TABLE_SCHEMA=DATABASE();
```
*Expected Result:*
- `order_shipments`: 21 columns
- `shipment_tracking_events`: 10 columns
- `orders.cod_fee_amount`: 1
- `products.cod_fee`: 1

---

### Step 4: Verification & Smoke Test Scenarios

After deploying the code:

1. **Storefront Pincode Widget:**
   - Open any product page.
   - Enter a valid Indian PIN (e.g. `560038`).
   - Confirm it displays: *"Delivery available to 560038 • Estimated delivery in 2–4 business days"*.
2. **Prepaid Free Shipping:**
   - Add items totaling $\ge$ ₹999 to cart.
   - Navigate to checkout and enter delivery PIN.
   - Select **Prepaid (Razorpay / UPI)**.
   - Verify shipping fee shows **₹0.00 (FREE)**.
3. **Cash on Delivery (COD) Rules:**
   - On the same cart ($\ge$ ₹999), switch to **Cash on Delivery**.
   - Verify: Courier fee is ₹0, but **COD Handling Fee** is added (default ₹50).
   - If cart total exceeds ₹1,500, verify COD payment option is disabled with reason *"COD is only available for orders up to ₹1,500"*.
4. **Admin Fulfillment & Freight Accounting:**
   - Open `/admin/orders/[id]` for the newly placed order.
   - Click **Create Shiprocket Order** (verifies order payload push).
   - In the **Courier Assignment Strategy** dropdown, test switching between Recommended (Smart AI routing) and a custom carrier.
   - Click **Generate AWB & Assign Courier**.
   - Verify:
     - Courier name and AWB code appear with copy button.
     - **Freight Financial Accounting** card displays: Customer Paid vs Actual Courier Cost vs Net Margin badge.
     - Click **Print Label** to verify 4x6 shipping PDF opens in a new tab.
     - If COD order, test **Mark COD Cash Collected** button.
5. **Customer Live Tracking:**
   - Open `/account/orders/[id]` on the customer side.
   - Verify neutral courier badge, copyable AWB code, ETD, and tracking scan timeline milestones.

---

### Step 5: Rollback Plan (If Necessary)

If an issue arises in production:
1. Set `SHIPROCKET_ENABLED="false"` in Hostinger `.env` and restart the Node.js application.
2. The entire website immediately falls back to flat ₹50 shipping without downtime or errors.
3. To rollback database migrations, execute `database/migrations/rollback/014_rollback.sql` and `database/migrations/rollback/013_rollback.sql`.
