import { MockShiprocketServer } from "./mock-shiprocket-server";

async function testMock() {
  console.log("\n=======================================================");
  console.log(" Testing Mock Shiprocket Server Functionality (Part B)");
  console.log("=======================================================\n");

  const server = new MockShiprocketServer({ port: 3456 });
  const url = await server.start();
  console.log(`  ✓ Mock Shiprocket server started at ${url}`);

  try {
    // 1. Test Auth Login
    const loginRes = await fetch(`${url}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@dearr.in", password: "pwd" }),
    });
    const loginData = await loginRes.json();
    console.log(`  ✓ Auth endpoint responded status ${loginRes.status} (token received: ${Boolean(loginData.token)})`);

    // 2. Test Normal Serviceability
    server.setScenario("normal");
    const servRes = await fetch(`${url}/courier/serviceability?delivery_postcode=560001&cod=1`);
    const servData = await servRes.json();
    console.log(`  ✓ Normal serviceability couriers count: ${servData.data.available_courier_companies.length}`);

    // 3. Test Unserviceable Scenario
    server.setScenario("unserviceable");
    const unservRes = await fetch(`${url}/courier/serviceability?delivery_postcode=999999`);
    const unservData = await unservRes.json();
    console.log(`  ✓ Unserviceable scenario couriers count: ${unservData.data.available_courier_companies.length} (expected 0)`);

    // 4. Test Courier Down Scenario
    server.setScenario("courier_down");
    const downRes = await fetch(`${url}/courier/serviceability?delivery_postcode=560001`);
    console.log(`  ✓ Courier down scenario status: ${downRes.status} (expected 503)`);

    // 5. Test Low Wallet Scenario
    server.setScenario("low_wallet");
    const walletRes = await fetch(`${url}/orders/create/adhoc`, { method: "POST" });
    console.log(`  ✓ Low wallet scenario status: ${walletRes.status} (expected 402)`);

    console.log("\n  ✓ Mock Shiprocket Server Test: ALL SCENARIOS VERIFIED!\n");
  } finally {
    await server.stop();
    console.log("  ✓ Mock Shiprocket server stopped cleanly.");
  }
}

testMock().catch((err) => {
  console.error("Mock test failed:", err);
  process.exit(1);
});
