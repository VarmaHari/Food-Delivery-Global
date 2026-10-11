import { useState, useEffect } from "react";
import { 
  Truck, 
  User, 
  MapPin, 
  Navigation, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Plus,
  ChevronRight,
  RefreshCw,
  Search,
  Play
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

// Fix Leaflet default icon issue using CDN to avoid build errors
const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

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

// Map component to handle view updates
function MapView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function App() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRiderId, setSelectedRiderId] = useState<string>("r1");
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);

  const fetchOrders = async () => {
    const res = await fetch("/api/orders");
    const data = await res.json();
    setOrders(data);
  };

  const fetchRiders = async () => {
    const res = await fetch("/api/riders");
    const data = await res.json();
    setRiders(data);
  };

  const fetchAvailableOrders = async () => {
    if (!selectedRiderId) return;
    const res = await fetch(`/api/orders/available?riderId=${selectedRiderId}`);
    const data = await res.json();
    setAvailableOrders(data);
  };

  useEffect(() => {
    fetchOrders();
    fetchRiders();
    const interval = setInterval(() => {
      fetchOrders();
      fetchRiders();
      fetchAvailableOrders();
    }, 1000); // Faster updates for simulation
    return () => clearInterval(interval);
  }, [selectedRiderId]);

  const createOrder = async () => {
    setLoading(true);
    const restaurants = ["Burger King", "Pizza Hut", "Taco Bell", "Sushi Zen", "Pasta Palace"];
    const itemSets = [
      ["Whopper Meal", "Onion Rings"],
      ["Pepperoni Feast", "Garlic Bread"],
      ["Crunchy Taco", "Nachos"],
      ["Salmon Nigiri", "Miso Soup"],
      ["Fettuccine Alfredo", "Wine"]
    ];
    const idx = Math.floor(Math.random() * restaurants.length);

    const pickup = { lat: 12.9716 + (Math.random() - 0.5) * 0.05, lng: 77.5946 + (Math.random() - 0.5) * 0.05 };
    const drop = { lat: 12.9716 + (Math.random() - 0.5) * 0.05, lng: 77.5946 + (Math.random() - 0.5) * 0.05 };
    
    await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        pickup, 
        drop, 
        restaurantName: restaurants[idx],
        items: itemSets[idx],
        total: Math.floor(Math.random() * 1000) + 200
      }),
    });
    fetchOrders();
    setLoading(false);
  };

  const acceptOrder = async (orderId: string) => {
    const res = await fetch(`/api/orders/${orderId}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ riderId: selectedRiderId }),
    });
    const result = await res.json();
    if (result.success) {
      fetchOrders();
      fetchAvailableOrders();
    } else {
      alert(result.error || "Failed to accept order");
    }
  };

  const startOrder = async (orderId: string) => {
    const res = await fetch(`/api/orders/${orderId}/start`, { method: "POST" });
    const result = await res.json();
    if (result.success) {
      fetchOrders();
    }
  };

  const currentRider = riders.find(r => r.id === selectedRiderId);
  const activeOrder = orders.find(o => o.assignedRiderId === selectedRiderId && o.status !== "delivered");

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-[1000] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg shadow-lg shadow-indigo-200">
              <Truck className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">CrowdFood <span className="text-indigo-600">OS</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
              <User className="w-4 h-4 text-slate-500" />
              <select 
                value={selectedRiderId} 
                onChange={(e) => setSelectedRiderId(e.target.value)}
                className="bg-transparent text-sm font-semibold focus:outline-none cursor-pointer"
              >
                {riders.map(r => (
                  <option key={r.id} value={r.id}>{r.name} ({r.type})</option>
                ))}
              </select>
            </div>
            <button 
              onClick={createOrder}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-full font-bold flex items-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-indigo-100 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Place Order
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left: Rider Context & Marketplace */}
        <div className="lg:col-span-4 space-y-8">
          {/* Map Section */}
          <section className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <MapPin className="w-5 h-5 text-indigo-600" />
              Live Map
            </h2>
            <div className="h-64 rounded-2xl overflow-hidden border border-slate-200 shadow-sm z-0">
              {currentRider && (
                <MapContainer 
                  center={[currentRider.currentPos.lat, currentRider.currentPos.lng]} 
                  zoom={13} 
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  <MapView center={[currentRider.currentPos.lat, currentRider.currentPos.lng]} />
                  <Marker position={[currentRider.currentPos.lat, currentRider.currentPos.lng]}>
                    <Popup>
                      {currentRider.name} (You)
                    </Popup>
                  </Marker>
                  {activeOrder && (
                    <>
                      <Marker position={[activeOrder.pickup.lat, activeOrder.pickup.lng]}>
                        <Popup>Pickup: {activeOrder.restaurantName}</Popup>
                      </Marker>
                      <Marker position={[activeOrder.drop.lat, activeOrder.drop.lng]}>
                        <Popup>Drop Location</Popup>
                      </Marker>
                    </>
                  )}
                </MapContainer>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Navigation className="w-5 h-5 text-indigo-600" />
                Rider Marketplace
              </h2>
              <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded uppercase">Live</span>
            </div>
            
            <div className="bg-indigo-900 rounded-2xl p-5 text-white shadow-xl relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest mb-1">Current Route</p>
                <h3 className="text-lg font-bold mb-4">
                  {currentRider?.name}
                </h3>
                {currentRider?.destination ? (
                  <div className="flex items-center gap-3 text-sm bg-indigo-800/50 p-3 rounded-xl border border-indigo-700/50">
                    <MapPin className="w-4 h-4 text-indigo-400" />
                    <span className="opacity-90">Heading to Destination</span>
                  </div>
                ) : (
                  <div className="text-sm opacity-70 italic">No fixed destination (Dedicated)</div>
                )}
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-10">
                <Navigation className="w-32 h-32 rotate-12" />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Orders on your route</p>
              <AnimatePresence mode="popLayout">
                {activeOrder ? (
                  <div className="bg-white p-4 rounded-xl border-l-4 border-l-emerald-500 border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-sm">Active: {activeOrder.restaurantName}</h4>
                        <p className="text-[10px] text-slate-500">{activeOrder.status.toUpperCase()}</p>
                      </div>
                      <span className="text-sm font-black text-emerald-600">₹{activeOrder.riderEarnings}</span>
                    </div>
                    {activeOrder.status === "picked_up" && (
                      <button 
                        onClick={() => startOrder(activeOrder.id)}
                        className="w-full mt-3 bg-emerald-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Play className="w-3 h-3" />
                        Start Delivery
                      </button>
                    )}
                    {activeOrder.status === "in_progress" && (
                      <div className="mt-3 flex items-center gap-2 text-xs font-bold text-emerald-600 animate-pulse">
                        <Navigation className="w-3 h-3" />
                        Moving to drop location...
                      </div>
                    )}
                  </div>
                ) : (
                  availableOrders.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-slate-400 text-sm">
                      No matching orders nearby...
                    </div>
                  ) : (
                    availableOrders.map(order => (
                      <motion.div 
                        key={order.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="bg-white p-4 rounded-xl border-l-4 border-l-indigo-600 border border-slate-200 shadow-sm hover:shadow-md transition-all group"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-bold text-sm">{order.restaurantName}</h4>
                            <p className="text-[10px] text-slate-500">{order.items.join(", ")}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-black text-emerald-600 block">₹{order.riderEarnings}</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Earnings</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 mb-3">
                          <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold">
                            <Clock className="w-3 h-3" />
                            {order.deliveryTimeMinutes} MINS
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold">
                            <Navigation className="w-3 h-3" />
                            {order.distanceKm} KM
                          </div>
                        </div>

                        <button 
                          onClick={() => acceptOrder(order.id)}
                          className="w-full mt-3 bg-indigo-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                        >
                          Accept & Deliver
                          <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                        </button>
                      </motion.div>
                    ))
                  )
                )}
              </AnimatePresence>
            </div>
          </section>
        </div>

        {/* Right: Global Order Tracking */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              Global Order Stream
            </h2>
            <div className="flex gap-2">
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <div className="w-2 h-2 bg-amber-400 rounded-full" /> Matching
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <div className="w-2 h-2 bg-indigo-500 rounded-full" /> In Transit
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <div className="w-2 h-2 bg-emerald-500 rounded-full" /> Delivered
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {orders.map(order => (
                <motion.div 
                  key={order.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col ${
                    order.status === 'in_progress' ? 'ring-2 ring-indigo-500 ring-offset-2' : 
                    order.status === 'delivered' ? 'border-emerald-200 bg-emerald-50/10' : ''
                  }`}
                >
                  <div className="p-4 flex-1">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2">
                        <div className="bg-slate-100 p-2 rounded-lg">
                          <Truck className={`w-4 h-4 ${
                            order.status === 'matching' ? 'text-amber-500' : 
                            order.status === 'delivered' ? 'text-emerald-500' : 'text-indigo-600'
                          }`} />
                        </div>
                        <div>
                          <h3 className="font-bold text-sm leading-tight">{order.restaurantName}</h3>
                          <span className="text-[10px] font-mono text-slate-400 uppercase">ID: {order.id.slice(0, 6)}</span>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter ${
                        order.status === 'matching' ? 'bg-amber-100 text-amber-700' : 
                        order.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {order.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-slate-300" />
                          <div className="w-0.5 h-4 bg-slate-100" />
                          <div className="w-2 h-2 rounded-full bg-indigo-500" />
                        </div>
                        <div className="flex-1 space-y-2">
                          <p className="text-[10px] text-slate-400 font-bold uppercase leading-none">Pickup: {order.pickup.lat.toFixed(3)}, {order.pickup.lng.toFixed(3)}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase leading-none">Drop: {order.drop.lat.toFixed(3)}, {order.drop.lng.toFixed(3)}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 pt-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                          <Clock className="w-3 h-3 text-indigo-500" />
                          {order.deliveryTimeMinutes} MINS
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                          <Navigation className="w-3 h-3 text-indigo-500" />
                          {order.distanceKm} KM
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                          ₹{order.riderEarnings} PAY
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-white rounded-full border border-slate-200 flex items-center justify-center">
                        <User className="w-3 h-3 text-slate-400" />
                      </div>
                      <span className="text-xs font-semibold text-slate-600">
                        {order.assignedRiderId ? riders.find(r => r.id === order.assignedRiderId)?.name : 'Awaiting Rider'}
                      </span>
                    </div>
                    <span className="text-sm font-black">₹{order.total}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Footer / Stats */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-8">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest">System Health</h4>
            <div className="flex items-center gap-2 text-emerald-600 font-medium">
              <CheckCircle className="w-4 h-4" />
              All services operational
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Cost Optimization</h4>
            <p className="text-sm text-slate-600">
              Crowdshipping saves an average of <span className="font-bold text-indigo-600">35%</span> per delivery compared to dedicated riders.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Fallback Status</h4>
            <div className="flex items-center gap-2 text-slate-600">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              Porter API: Connected
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
