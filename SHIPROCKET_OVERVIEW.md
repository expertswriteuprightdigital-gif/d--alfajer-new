# 🚀 Complete Overview of the Shiprocket Integration

The application integrates deeply with Shiprocket for an end-to-end fulfillment process managed entirely from your Next.js Admin Panel. The integration covers order management, courier selection, real-time tracking, return management, and automated client notifications.

## 🎯 Key Features Integrated
1. **Automated Courier Selection UI**: Admins can check serviceability and retrieve available couriers (with rates, reliability rating, and ETA) based on the pickup location and delivery pincode.
2. **Instant AWB Generation**: Assigns the courier and generates the AWB (Air Waybill) immediately when an admin initiates shipment.
3. **Automated Notification System**: Customers are automatically emailed tracking links when the shipment is created or when its status changes.
4. **Real-time Tracking & Webhooks**: Listens to Shiprocket webhooks (e.g., "Picked Up", "In Transit", "Delivered") and updates the order status in your local database in real time.
5. **Bulk Processing**: Admins can select multiple orders and generate shipments/labels in bulk.
6. **Built-in Analytics Dashboard**: Dedicated admin pages displaying total spending, RTO (Return to Origin) rates, courier performance, and COD (Cash on Delivery) remittance.
7. **Rate Calculator & Label Printing**: You can estimate shipping costs before processing and print shipping labels directly from the order page.

---

## 📂 Code Architecture & File Structure

The Shiprocket functionality is cleanly structured across frontend pages, backend APIs, and core utility libraries.

### 1. Frontend Code (Admin UI)
Your admin panel contains dedicated UI elements to interact with the Shiprocket modules:
*   `src/app/admin/orders/[id]/page.tsx`: This is where the **Create Shiprocket Shipment** modal exists. It manages user clicks, displays available couriers, and triggers order creation.
*   `src/app/admin/shiprocket/page.tsx`: The main Analytics Dashboard.
*   **Other Admin Subpages**:
    *   `src/app/admin/shiprocket/serviceability/page.tsx`
    *   `src/app/admin/shiprocket/shipments/page.tsx` (List of shipments and tracking statuses)
    *   `src/app/admin/shiprocket/pickup/page.tsx`
    *   `src/app/admin/shiprocket/rate-calculator/page.tsx`
    *   `src/app/admin/shiprocket/cod/page.tsx` (Logs pending/remitted COD payments)
    *   `src/app/admin/shiprocket/returns/page.tsx`
*   `src/hooks/useShiprocket.ts`: A custom React hook abstracting the calls from the frontend components to your backend APIs.

### 2. Backend API Routes
These endpoints act as the middleman between your frontend and Shiprocket's external APIs:
*   `src/app/api/shiprocket/serviceability/route.ts`: Takes origin & destination pincodes to return available couriers + rates before making a booking.
*   `src/app/api/shiprocket/shipment/route.ts`: Orchestrates order creation (`orders/create/adhoc`) and automatically assigns an AWB to the shipment.
*   `src/app/api/shiprocket/tracking/route.ts`: Fetches the live tracking status of an order.
*   `src/app/api/shiprocket/generate-label/route.ts` & `/generate-invoice`: Used to fetch the printable PDF links.
*   `src/app/api/shiprocket/webhook/route.ts`: A server-side listener that receives asynchronous event triggers from Shiprocket (like "Order Delivered") and automatically updates your Supabase database (`src/lib/supabase/orders.ts`).
*   `src/app/api/shiprocket/auth/route.ts`: Fetches API tokens required to interact with Shiprocket securely.

### 3. Core Libraries & Workers
Functions performing the actual external HTTP requests.
*   `src/lib/shiprocket.ts`: Contains the raw API wrapper functions (`checkServiceability`, `createShiprocketShipment`, `assignCourierAndGenerateAWB`).
*   `src/lib/shiprocket-auth.ts`: Logic to manage and automatically refresh your Shiprocket authentication token if it expires.
*   `src/lib/shiprocket-automation.ts`: Automation logic.
*   `src/lib/shiprocket-client.ts`: Utilities like tracking URL generation.

---

## ⚙️ How the Workflow Actually Operates

### Step 1: Initiation and Serviceability
When an admin views a pending order (`/admin/orders/[id]`) and clicks **Create Shiprocket Shipment**, the frontend calls `/api/shiprocket/serviceability`. The API sends the stored *Pickup Location* pincode and the customer's *Delivery Pincode* to Shiprocket to evaluate which couriers can carry the package, returning their live rates.

### Step 2: Courier Selection and Shipment Creation
The admin selects a preferred courier (e.g., Delhivery Air) based on speed or cost. Clicking "Ship via Courier" sends a payload to `/api/shiprocket/shipment/route.ts`. The backend performs two steps:
1. Registers the shipment order with Shiprocket.
2. Directly asks Shiprocket to assign the chosen courier and returns an **AWB Code**.

### Step 3: Post-Processing
Once the AWB code is returned, your system:
*   Updates the status of the order in your Supabase DB to `shipped`.
*   Saves the `tracking_number`.
*   Updates the Admin UI to show "Shipment Created".
*   Triggers `src/lib/email/index.ts` to email the customer with their tracking details.

### Step 4: Real-time Lifecycle Updates
Shiprocket continues monitoring the physical package. When an event happens (e.g., package picks up or delivers), Shiprocket fires an automated POST request to your `/api/shiprocket/webhook/route.ts`. This webhook updates the local database state and triggers additional email notifications (Out for Delivery, Delivered) without requiring any admin intervention.
