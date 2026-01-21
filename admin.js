import { db } from './firebase-config.js';
import { collection, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const adminMap = L.map('admin-map').setView([16.8661, 96.1951], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(adminMap);

let markers = { riders: {}, orders: {} };

// --- Rider များအားလုံးကို Live ပြခြင်း ---
onSnapshot(collection(db, "active_riders"), (snap) => {
    snap.forEach((doc) => {
        const data = doc.data();
        if (markers.riders[doc.id]) adminMap.removeLayer(markers.riders[doc.id]);
        
        const riderIcon = L.icon({
            iconUrl: 'https://cdn-icons-png.flaticon.com/512/3198/3198336.png',
            iconSize: [30, 30]
        });

        markers.riders[doc.id] = L.marker([data.lat, data.lng], { icon: riderIcon })
            .addTo(adminMap)
            .bindPopup(`🚴 Rider: ${data.name}<br>Online`);
    });
});

// --- Active Order များအားလုံးကို ပြခြင်း ---
const orderQuery = query(collection(db, "orders"), where("status", "!=", "completed"));
onSnapshot(orderQuery, (snap) => {
    // အရင်အဟောင်းများကို ရှင်းထုတ်ရန်
    Object.values(markers.orders).forEach(m => adminMap.removeLayer(m));
    
    snap.forEach((doc) => {
        const order = doc.data();
        const pLoc = [order.pickup.lat, order.pickup.lng];
        const dLoc = [order.dropoff.lat, order.dropoff.lng];

        const pickupCircle = L.circleMarker(pLoc, { color: 'blue', radius: 7 }).bindPopup(`📦 Pickup: ${order.item}`);
        const dropoffCircle = L.circleMarker(dLoc, { color: 'red', radius: 7 }).bindPopup(`🏁 Dropoff: ${order.item}`);
        const connectionLine = L.polyline([pLoc, dLoc], { color: 'green', weight: 2, dashArray: '5, 5' });

        markers.orders[doc.id] = L.layerGroup([pickupCircle, dropoffCircle, connectionLine]).addTo(adminMap);
    });
});

