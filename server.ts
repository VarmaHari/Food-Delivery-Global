import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// --- Mock Database ---
interface Location {
  lat: number;
  lng: number;
}

interface Rider {
  id: string;
  name: string;
  type: "crowd" | "dedicated";
  currentPos: Location;
  destination?: Location;
  isActive: boolean;
}

interface Order {
  id: string;
  restaurantName: string;
  items: string[];
  total: number;
  riderEarnings: number;
  deliveryTimeMinutes: number;
  distanceKm: number;
  status: "pending" | "matching" | "picked_up" | "in_progress" | "delivered" | "failed";
  pickup: Location;
  drop: Location;
  assignedRiderId?: string;
  createdAt: number;
}

let riders: Rider[] = [
  { id: "r1", name: "Alice (Crowd)", type: "crowd", currentPos: { lat: 12.9716, lng: 77.5946 }, destination: { lat: 12.9352, lng: 77.6245 }, isActive: true },
  { id: "r2", name: "Bob (Dedicated)", type: "dedicated", currentPos: { lat: 12.9500, lng: 77.6000 }, isActive: true },
  { id: "r3", name: "Charlie (Crowd)", type: "crowd", currentPos: { lat: 12.9600, lng: 77.5800 }, destination: { lat: 12.9800, lng: 77.6100 }, isActive: true },
];

let orders: Order[] = [];

// --- Helper Functions ---
function getDistance(l1: Location, l2: Location) {
  const R = 6371; // km
  const dLat = (l2.lat - l1.lat) * Math.PI / 180;
  const dLng = (l2.lng - l1.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(l1.lat * Math.PI / 180) * Math.cos(l2.lat * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// --- API Routes ---

// 1. Create Order with Details
app.post("/api/orders", (req, res) => {
  const { pickup, drop, restaurantName, items, total } = req.body;
  const dist = getDistance(pickup, drop);
  
  // Business Logic: 
  // - Earnings: Base ₹30 + ₹10 per km
  // - Time: 15 mins prep + 5 mins per km
  const riderEarnings = Math.round(30 + (dist * 10));
  const deliveryTimeMinutes = Math.round(15 + (dist * 5));

  const newOrder: Order = {
    id: uuidv4(),
    restaurantName: restaurantName || "The Gourmet Kitchen",
    items: items || ["Margherita Pizza", "Coke"],
    total: total || 450,
    riderEarnings,
    deliveryTimeMinutes,
    distanceKm: parseFloat(dist.toFixed(2)),
    status: "matching",
    pickup,
    drop,
    createdAt: Date.now(),
  };
  orders.push(newOrder);
  res.json(newOrder);
});

// 2. Get Orders (Admin/Customer View)
app.get("/api/orders", (req, res) => {
  res.json(orders);
});

// 3. Get Available Orders for a Specific Rider (Nearby on Route)
app.get("/api/orders/available", (req, res) => {
  const { riderId } = req.query;
  const rider = riders.find(r => r.id === riderId);
  
  if (!rider) return res.status(404).json({ error: "Rider not found" });

  // Only show orders that are in 'matching' status and not yet assigned
  const availableOrders = orders.filter(o => o.status === "matching" && !o.assignedRiderId);

  if (rider.type === "crowd" && rider.destination) {
    // Filter by route optimization for crowd riders
    const routeMatches = availableOrders.filter(order => {
      const originalDist = getDistance(rider.currentPos, rider.destination!);
      const newDist = getDistance(rider.currentPos, order.pickup) +
                      getDistance(order.pickup, order.drop) +
                      getDistance(order.drop, rider.destination!);
      const detourRatio = newDist / originalDist;
      return detourRatio <= 1.25; // 25% max detour for this demo
    });
    return res.json(routeMatches);
  }

  // For dedicated riders, just show nearby orders (within 5km)
  const nearbyOrders = availableOrders.filter(order => {
    return getDistance(rider.currentPos, order.pickup) <= 5;
  });
  res.json(nearbyOrders);
});

// 4. Accept Order (Concurrency Control)
app.post("/api/orders/:orderId/accept", (req, res) => {
  const { orderId } = req.params;
  const { riderId } = req.body;

  const order = orders.find(o => o.id === orderId);
  const rider = riders.find(r => r.id === riderId);

  if (!order || !rider) return res.status(404).json({ error: "Order or Rider not found" });

  if (order.assignedRiderId) {
    return res.status(400).json({ error: "Order already accepted by another rider" });
  }

  order.assignedRiderId = rider.id;
  order.status = "picked_up";
  res.json({ success: true, order });
});

// 5. Start Order (Begin Movement)
app.post("/api/orders/:orderId/start", (req, res) => {
  const { orderId } = req.params;
  const order = orders.find(o => o.id === orderId);
  if (!order) return res.status(404).json({ error: "Order not found" });

  order.status = "in_progress";
  res.json({ success: true, order });
});

// 6. Get Riders
app.get("/api/riders", (req, res) => {
  res.json(riders);
});

// --- Movement Simulation ---
setInterval(() => {
  orders.forEach(order => {
    if (order.status === "in_progress" && order.assignedRiderId) {
      const rider = riders.find(r => r.id === order.assignedRiderId);
      if (rider) {
        // Move rider towards drop location
        const step = 0.001; // Simulation speed
        const dLat = order.drop.lat - rider.currentPos.lat;
        const dLng = order.drop.lng - rider.currentPos.lng;
        const dist = Math.sqrt(dLat * dLat + dLng * dLng);

        if (dist < step) {
          rider.currentPos = { ...order.drop };
          order.status = "delivered";
        } else {
          rider.currentPos.lat += (dLat / dist) * step;
          rider.currentPos.lng += (dLng / dist) * step;
        }
      }
    }
  });
}, 1000);

// --- Vite Middleware ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
