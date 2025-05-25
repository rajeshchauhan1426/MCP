import { KiteConnect } from "kiteconnect";
import * as fs from 'fs';
import WebSocket from 'ws';

const apiKey = "0qyngmjiy3zwu448";
const apiSecret = "s3runql8movqus4pc127wf937jv1in1a";
const kc = new KiteConnect({ api_key: apiKey });

// MCP Server Configuration
const MCP_SERVER = "ws://localhost:8080"; // Update with your MCP server address
let ws: WebSocket;

async function init() {
  try {
    // Connect to MCP server
    await connectToMCPServer();
    
    // Get stored access token
    let accessToken = '';
    try {
      accessToken = fs.readFileSync('access_token.txt', 'utf8');
      kc.setAccessToken(accessToken);
      await kc.getProfile();
      console.log("Using existing access token");
    } catch (err) {
      console.log("Access token invalid or expired. Please login again.");
      const requestToken = "kr1FnhWOoCkoePxFR1oyHWxLCBr0Ctvf";
      await generateSession(requestToken);
    }

    // Subscribe to MCP server messages
    ws.on('message', async (data: string) => {
      try {
        const message = JSON.parse(data);
        if (message.type === 'TRADE_SIGNAL') {
          await handleTradeSignal(message);
        }
      } catch (err) {
        console.error("Error processing MCP message:", err);
      }
    });

  } catch (err) {
    console.error("Initialization error:", err);
  }
}

async function connectToMCPServer() {
  return new Promise((resolve, reject) => {
    ws = new WebSocket(MCP_SERVER);

    ws.on('open', () => {
      console.log("Connected to MCP server");
      resolve(true);
    });

    ws.on('error', (error) => {
      console.error("MCP server connection error:", error);
      reject(error);
    });

    ws.on('close', () => {
      console.log("Disconnected from MCP server");
    });
  });
}

async function handleTradeSignal(signal: any) {
  try {
    const { action, symbol, quantity } = signal;
    
    if (action === 'BUY') {
      await placeOrder(symbol, quantity, 'BUY' as const);
    } else if (action === 'SELL') {
      await placeOrder(symbol, quantity, 'SELL' as const);
    }
  } catch (err) {
    console.error("Error handling trade signal:", err);
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

    // Send order status back to MCP server
    ws.send(JSON.stringify({
      type: 'ORDER_STATUS',
      orderId: order.order_id,
      status: orderStatus[0].status,
      symbol,
      quantity,
      transactionType
    }));
    
  } catch (err) {
    console.error(`Error placing ${transactionType} order:`, err);
    
    // Send error back to MCP server
    ws.send(JSON.stringify({
      type: 'ORDER_ERROR',
      error: err.message,
      symbol,
      quantity,
      transactionType
    }));
  }
}

// Initialize the trading system
init();