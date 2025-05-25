import { KiteConnect } from "kiteconnect";
import * as fs from 'fs';

const apiKey = "0qyngmjiy3zwu448";
const apiSecret = "s3runql8movqus4pc127wf937jv1in1a";

const kc = new KiteConnect({ api_key: apiKey });

async function init() {
  try {
    // Get the login URL
    const loginUrl = kc.getLoginURL();
    console.log("\n=== Please follow these steps ===");
    console.log("1. Visit this URL to login:", loginUrl);
    console.log("2. After login, you will be redirected to a URL");
    console.log("3. Copy the request_token from that URL");
    console.log("4. Enter the request_token when prompted\n");
    
    // Get command line arguments
    const args = process.argv.slice(2);
    const action = args[0]?.toLowerCase();
    const symbol = args[1];
    const quantity = parseInt(args[2]);
    
    if (!action || !symbol || !quantity) {
      console.log("Usage: bun index.ts [buy|sell] [SYMBOL] [QUANTITY]");
      console.log("Example: bun index.ts buy RELIANCE 1");
      return;
    }

    // Try to get stored access token
    let accessToken = '0x5NLRy1t8yR0vRVh9Fq7U1lktWUK4cK';
    try {
      accessToken = fs.readFileSync('access_token.txt', 'utf8');
      kc.setAccessToken(accessToken);
      // Verify if token is valid by making a test API call
      await kc.getProfile();
      console.log("Using existing access token");
    } catch (err) {
      console.log("Access token invalid or expired. Please login again.");
      const requestToken = "kr1FnhWOoCkoePxFR1oyHWxLCBr0Ctvf"; // Replace with token from login
      await generateSession(requestToken);
      return;
    }

    // Show profile details
    await showProfileDetails();

    if (action === 'buy') {
      await placeOrder(symbol, quantity, 'BUY' as const);
    } else if (action === 'sell') {
      await placeOrder(symbol, quantity, 'SELL' as const);
    } else {
      console.log("Invalid action. Use 'buy' or 'sell'");
    }
  } catch (err) {
    console.error(err);
  }
}

async function showProfileDetails() {
  try {
    const profile = await kc.getProfile();
    console.log("\n=== Your Zerodha Profile ===");
    console.log("User ID:", profile.user_id);
    console.log("Name:", profile.user_name);
    console.log("Email:", profile.email);
    console.log("User Type:", profile.user_type);
    console.log("Broker:", profile.broker);
    console.log("Products:", profile.products);
    console.log("Order Types:", profile.order_types);
    console.log("Exchanges:", profile.exchanges);
    console.log("Avatar URL:", profile.avatar_url);
    console.log("=======================\n");
  } catch (err) {
    console.error("Error fetching profile:", err);
  }
}

async function generateSession(requestToken: string) {
  try {
    const response = await kc.generateSession(requestToken, apiSecret);
    console.log("Access Token:", response.access_token);
    kc.setAccessToken(response.access_token);
    
    // Store the access token
    fs.writeFileSync('access_token.txt', response.access_token);
    console.log("Session generated successfully");
    
    // Show profile after successful session generation
    await showProfileDetails();
  } catch (err) {
    console.error("Error generating session:", err);
    throw err;
  }
}

async function placeOrder(symbol: string, quantity: number, transactionType: 'BUY' | 'SELL') {
  try {
    // Get instrument token for the symbol
    const instruments = await kc.getInstruments('NSE');
    const instrument = instruments.find(i => i.tradingsymbol === symbol);
    
    if (!instrument) {
      console.log(`Symbol ${symbol} not found`);
      return;
    }

    const orderParams = {
      tradingsymbol: symbol,
      exchange: 'NSE' as const,
      transaction_type: transactionType as 'BUY' | 'SELL',
      quantity: quantity,
      product: 'CNC' as const,
      order_type: 'MARKET' as const
    };

    const order = await kc.placeOrder('regular', orderParams);
    console.log(`\n=== ${transactionType} Order Placed ===`);
    console.log(`Order ID: ${order.order_id}`);
    console.log(`Symbol: ${symbol}`);
    console.log(`Quantity: ${quantity}`);
    console.log(`Type: ${transactionType}`);
    
    // Get order status
    const orderStatus = await kc.getOrderHistory(order.order_id);
    console.log("\nOrder Status:", orderStatus[0].status);
    
  } catch (err) {
    console.error(`Error placing ${transactionType} order:`, err);
  }
}

// Initialize the API calls
init();