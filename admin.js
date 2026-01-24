import { db } from './firebase-config.js';
import { 
    collection, onSnapshot, query, doc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- မြေပုံတည်ဆောက်ခြင်း ---
const adminMap = L.map('admin-map', { zoomControl: false }).setView([16.8661, 96.1951], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(adminMap);

let riderMarkers = {};
let orderLayers = {}; 

// --- ၁။ Riders Monitoring (active_riders collection) ---
onSnapshot(collection(db, "active_riders"), (snap) => {
    document.getElementById('rider-count').innerText = snap.size;
    
    snap.docChanges().forEach((change) => {
        const data = change.doc.data();
        const id = change.doc.id;

        if (change.type === "added" || change.type === "modified") {
            if (riderMarkers[id]) {
                riderMarkers[id].setLatLng([data.lat, data.lng]);
            } else {
                const riderIcon = L.icon({
                    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3198/3198336.png',
                    iconSize: [35, 35]
                });
                riderMarkers[id] = L.marker([data.lat, data.lng], { icon: riderIcon })
                    .addTo(adminMap)
                    .bindPopup(`<b>🚴 ${data.name || 'Rider'}</b>`);
            }
        }
        if (change.type === "removed") {
            if (riderMarkers[id]) { adminMap.removeLayer(riderMarkers[id]); delete riderMarkers[id]; }
        }
    });
});

// --- ၂။ Customers Monitoring (ပုံထဲက customers collection) ---
// ⚠️ ဤအပိုင်းက Users: 0 ဖြစ်နေတာကို ဖြေရှင်းပေးပါလိမ့်မည်
onSnapshot(collection(db, "customers"), (snap) => {
    const userCount = document.getElementById('user-count');
    if (userCount) {
        userCount.innerText = snap.size; // Customers အရေအတွက်ကို Users နေရာမှာပြမည်
    }
});

// --- ၃။ Orders Monitoring (orders collection) ---
onSnapshot(collection(db, "orders"), (snap) => {
    // Status မပြီးသေးတဲ့ Order တွေကိုပဲ ရေတွက်မယ်
    const activeOrders = snap.docs.filter(d => d.data().status !== "completed");
    document.getElementById('order-count').innerText = activeOrders.length;
    
    snap.docChanges().forEach((change) => {
        const order = change.doc.data();
        const id = change.doc.id;

        // Status ပြီးသွားရင် မြေပုံပေါ်ကဖယ်မယ်
        if (order.status === "completed") {
            if (orderLayers[id]) { adminMap.removeLayer(orderLayers[id]); delete orderLayers[id]; }
            return;
        }

        if (change.type === "added" || change.type === "modified") {
            if (orderLayers[id]) adminMap.removeLayer(orderLayers[id]);

            if (order.pickup?.lat && order.dropoff?.lat) {
                const pLoc = [order.pickup.lat, order.pickup.lng];
                const dLoc = [order.dropoff.lat, order.dropoff.lng];

                const pMarker = L.circleMarker(pLoc, { color: 'blue', radius: 8 });
                const dMarker = L.circleMarker(dLoc, { color: 'red', radius: 8 });
                const line = L.polyline([pLoc, dLoc], { color: 'orange', weight: 2, dashArray: '5, 10' });

                orderLayers[id] = L.layerGroup([pMarker, dMarker, line]).addTo(adminMap);
            }
        }
        if (change.type === "removed") {
            if (orderLayers[id]) { adminMap.removeLayer(orderLayers[id]); delete orderLayers[id]; }
        }
    });
});
