import http from "http";
import { URL } from "url";

export type MockScenario =
  | "normal"
  | "courier_down"
  | "low_wallet"
  | "unserviceable"
  | "cod_disabled"
  | "already_scheduled"
  | "duplicate";

export interface MockServerOptions {
  port?: number;
  initialScenario?: MockScenario;
  webhookSecret?: string;
  appBaseUrl?: string;
}

export class MockShiprocketServer {
  private server: http.Server | null = null;
  public port: number;
  public scenario: MockScenario;
  public webhookSecret: string;
  public appBaseUrl: string;
  public lastRequestedEndpoints: string[] = [];
  public createdOrders: any[] = [];
  public assignedAwbs: any[] = [];
  public scheduledPickups: any[] = [];

  constructor(options: MockServerOptions = {}) {
    this.port = options.port || 3456;
    this.scenario = options.initialScenario || "normal";
    this.webhookSecret = options.webhookSecret || process.env.SHIPROCKET_WEBHOOK_TOKEN || "mock_secret_webhook_key_123";
    this.appBaseUrl = options.appBaseUrl || "http://localhost:3000";
  }

  public setScenario(s: MockScenario) {
    this.scenario = s;
  }

  public async start(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        try {
          await this.handleRequest(req, res);
        } catch (err: any) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err?.message || "Internal Mock Error" }));
        }
      });

      this.server.listen(this.port, () => {
        resolve(`http://127.0.0.1:${this.port}`);
      });

      this.server.on("error", (err) => reject(err));
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) return resolve();
      this.server.close(() => resolve());
    });
  }

  private async parseBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch {
          resolve({});
        }
      });
    });
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const parsedUrl = new URL(req.url || "/", `http://127.0.0.1:${this.port}`);
    const pathname = parsedUrl.pathname;
    this.lastRequestedEndpoints.push(`${req.method} ${pathname}`);

    // CORS headers for local testing
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PATCH, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Helper: Scenario control
    if (pathname === "/scenario" && req.method === "POST") {
      const body = await this.parseBody(req);
      if (body.scenario) {
        this.scenario = body.scenario;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, currentScenario: this.scenario }));
      return;
    }

    // Helper: Trigger webhook event to Dearr app
    if (pathname === "/trigger-webhook" && req.method === "POST") {
      const body = await this.parseBody(req);
      const result = await this.dispatchWebhook(body);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
      return;
    }

    // Shiprocket API Simulation:

    // 1. POST /auth/login
    if (pathname.includes("/auth/login") && req.method === "POST") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          id: 12345,
          first_name: "Dearr",
          last_name: "Mock",
          email: "test@dearr.in",
          company_id: 9999,
          token: "mock_shiprocket_bearer_token_xyz987654321",
          expires_in: 864000,
        })
      );
      return;
    }

    // Check Courier Down Scenario
    if (this.scenario === "courier_down") {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Shiprocket API gateway timeout", status_code: 503 }));
      return;
    }

    // 2. GET /courier/serviceability
    if (pathname.includes("/courier/serviceability") && req.method === "GET") {
      const deliveryPincode = parsedUrl.searchParams.get("delivery_postcode") || "";
      const cod = parsedUrl.searchParams.get("cod") === "1";

      if (this.scenario === "unserviceable" || deliveryPincode === "999999") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: 200,
            data: {
              available_courier_companies: [],
              recommended_courier_company_id: null,
            },
          })
        );
        return;
      }

      const isCodScenarioDisabled = this.scenario === "cod_disabled" || deliveryPincode === "560099";

      const couriers = [
        {
          courier_company_id: 101,
          courier_name: "Bluedart Surface",
          rate: 45.0,
          etd: "3 business days",
          estimated_delivery_days: 3,
          cod: isCodScenarioDisabled ? 0 : 1,
          rating: 4.6,
        },
        {
          courier_company_id: 102,
          courier_name: "Delhivery Surface",
          rate: 55.0,
          etd: "4 business days",
          estimated_delivery_days: 4,
          cod: isCodScenarioDisabled ? 0 : 1,
          rating: 4.2,
        },
        {
          courier_company_id: 103,
          courier_name: "Shadowfax Express",
          rate: 40.0,
          etd: "5 business days",
          estimated_delivery_days: 5,
          cod: isCodScenarioDisabled ? 0 : 1,
          rating: 3.9,
        },
      ];

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: 200,
          data: {
            available_courier_companies: couriers,
            recommended_courier_company_id: 101,
            recommended_courier_name: "Bluedart Surface",
          },
        })
      );
      return;
    }

    // 3. POST /orders/create/adhoc
    if (pathname.includes("/orders/create/adhoc") && req.method === "POST") {
      if (this.scenario === "low_wallet") {
        res.writeHead(402, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Insufficient wallet balance to book order" }));
        return;
      }

      if (this.scenario === "duplicate") {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "An order with this order_id already exists" }));
        return;
      }

      const body = await this.parseBody(req);
      const orderId = 10000 + this.createdOrders.length + 1;
      const shipmentId = 20000 + this.createdOrders.length + 1;
      this.createdOrders.push({ orderId, shipmentId, ...body });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          order_id: orderId,
          shipment_id: shipmentId,
          status: "NEW",
          status_code: 1,
          onboarding_completed_now: 0,
          awb_code: "",
          courier_company_id: null,
          courier_name: null,
        })
      );
      return;
    }

    // 4. POST /courier/assign/awb
    if (pathname.includes("/courier/assign/awb") && req.method === "POST") {
      if (this.scenario === "low_wallet") {
        res.writeHead(402, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Insufficient Shiprocket wallet balance to assign AWB" }));
        return;
      }

      const body = await this.parseBody(req);
      const awbCode = `MOCKAWB${Date.now().toString().slice(-8)}`;
      this.assignedAwbs.push({ awbCode, ...body });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          awb_assign_status: 1,
          response: {
            data: {
              shipment_id: body.shipment_id || 20001,
              awb_code: awbCode,
              courier_company_id: body.courier_id || 101,
              courier_name: body.courier_id === 102 ? "Delhivery Surface" : "Bluedart Surface",
              assigned_date_time: new Date().toISOString(),
              freight_charges: 45.0,
            },
          },
        })
      );
      return;
    }

    // 5. POST /courier/generate/pickup
    if (pathname.includes("/courier/generate/pickup") && req.method === "POST") {
      if (this.scenario === "already_scheduled") {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Pickup has already been scheduled for this shipment." }));
        return;
      }

      const body = await this.parseBody(req);
      const tokenNumber = `PKP${Date.now().toString().slice(-6)}`;
      this.scheduledPickups.push({ tokenNumber, ...body });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          pickup_status: 1,
          response: {
            pickup_scheduled_date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
            pickup_token_number: tokenNumber,
            status: "Scheduled",
          },
        })
      );
      return;
    }

    // 6. POST /courier/generate/label
    if (pathname.includes("/courier/generate/label") && req.method === "POST") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          label_created: 1,
          label_url: "https://mock.shiprocket.in/labels/sample_shipping_label.pdf",
        })
      );
      return;
    }

    // 7. POST /manifest/generate
    if (pathname.includes("/manifest/generate") && req.method === "POST") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: 1,
          manifest_url: "https://mock.shiprocket.in/manifests/sample_manifest.pdf",
        })
      );
      return;
    }

    // 8. POST /orders/cancel
    if (pathname.includes("/orders/cancel") && req.method === "POST") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: 200, message: "Order cancelled successfully" }));
      return;
    }

    // 9. GET /courier/track/awb/:awb
    if (pathname.includes("/courier/track/awb") && req.method === "GET") {
      const awb = pathname.split("/").pop() || "MOCKAWB";
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          tracking_data: {
            track_status: 1,
            shipment_status: 7,
            shipment_track: [
              {
                id: 1,
                awb_code: awb,
                current_status: "IN TRANSIT",
                etd: "2026-10-31",
                delivered_date: null,
                scans: [
                  {
                    date: new Date().toISOString(),
                    activity: "Parcel in transit to local destination hub",
                    location: "Bangalore Logistics Hub",
                    sr_status: "IN TRANSIT",
                  },
                ],
              },
            ],
          },
        })
      );
      return;
    }

    // Fallback 404
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: `Mock endpoint not found: ${pathname}` }));
  }

  public async dispatchWebhook(payload: {
    orderId: string;
    awb?: string;
    currentStatus: string;
    courierName?: string;
    etd?: string;
    isReturn?: boolean;
    badToken?: boolean;
  }): Promise<{ status: number; body: any }> {
    const webhookUrl = `${this.appBaseUrl}/api/webhooks/courier-updates`;
    const tokenHeader = payload.badToken ? "bad_invalid_token" : this.webhookSecret;

    const orderId = (payload as any).orderId || (payload as any).order_id;
    const currentStatus = (payload as any).currentStatus || (payload as any).current_status || "IN TRANSIT";
    const awb = payload.awb || "MOCKAWB12345";
    const courierName = (payload as any).courierName || (payload as any).courier_name || "Bluedart Surface";
    const etd = payload.etd || "2026-10-31";
    const isReturn = (payload as any).isReturn !== undefined ? (payload as any).isReturn : (payload as any).is_return;

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": tokenHeader,
      },
      body: JSON.stringify({
        order_id: orderId,
        awb,
        current_status: currentStatus,
        courier_name: courierName,
        etd,
        is_return: Boolean(isReturn),
        scans: (payload as any).scans || [],
      }),
    });

    const data = await res.json().catch(() => ({}));
    return { status: res.status, body: data };
  }
}

// Standalone runner if executed directly
if (require.main === module) {
  const server = new MockShiprocketServer({ port: 3456 });
  server.start().then((url) => {
    console.log(`Mock Shiprocket server running at ${url}`);
  });
}
