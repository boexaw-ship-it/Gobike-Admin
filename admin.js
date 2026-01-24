import { db } from './firebase-config.js';
import { 
    collection, onSnapshot, query, doc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- ၁။ မြေပုံတည်ဆောက်ခြင်း ---
const adminMap = L.map('admin-map', { zoomControl: false }).setView([16.8661, 96.1951], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(adminMap);

let riderMarkers = {};
let orderLayers = {}; 

// --- ၂။ Global Cancel Function (အော်ဒါဖျက်ရန်) ---
window.cancelOrder = async (id) => {
    const result = await Swal.fire({
        title: 'Order ကို ဖျက်မှာလား?',
        text: "ဒီအော်ဒါကို စနစ်ထဲက အပြီးဖျက်ပါမယ်။",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'ဖျက်မည်',
        cancelButtonText: 'မဖျက်တော့ပါ'
    });

    if (result.isConfirmed) {
        try {
            await deleteDoc(doc(db, "orders", id));
            Swal.fire('Deleted!', 'အောင်မြင်စွာ ဖျက်ပြီးပါပြီ။', 'success');
        } catch (e) { Swal.fire('Error', e.message, 'error'); }
    }
};

// --- ၃။ Riders Monitoring (active_riders collection) ---
onSnapshot(collection(db, "active_riders"), (snap) => {
    const riderCountEl = document.getElementById('rider-count');
    if (riderCountEl) riderCountEl.innerText = snap.size;
    
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
                    .bindPopup(`<b>🚴 Rider: ${data.name || 'Unknown'}</b>`);
            }
        }
        if (change.type === "removed") {
            if (riderMarkers[id]) { adminMap.removeLayer(riderMarkers[id]); delete riderMarkers[id]; }
        }
    });
});

// --- ၄။ Customers Monitoring (Users: အရေအတွက်အတွက်) ---
onSnapshot(collection(db, "customers"), (snap) => {
    const userCountEl = document.getElementById('user-count'); // HTML ထဲက ID နှင့် ကိုက်ညီအောင် ပြင်ထားသည်
    if (userCountEl) {
        userCountEl.innerText = snap.size;
    }
});

// --- ၅။ Orders Monitoring (orders collection + Map Markers) ---
onSnapshot(collection(db, "orders"), (snap) => {
    const activeOrders = snap.docs.filter(d => d.data().status !== "completed");
    const orderCountEl = document.getElementById('order-count');
    if (orderCountEl) orderCountEl.innerText = activeOrders.length;
    
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

                // Pickup Marker (အပြာစက်) + Cancel Button
                const pMarker = L.circleMarker(pLoc, { color: 'blue', radius: 8 }).bindPopup(`
                    <div style="text-align:center;">
                        <b>📦 ${order.item || 'Parcel'}</b><br>
                        <button onclick="cancelOrder('${id}')" 
                            style="background:#ff4757; color:white; border:none; padding:5px; border-radius:5px; margin-top:10px; cursor:pointer;">
                            Cancel Order
                        </button>
                    </div>
                `);

                // Dropoff Marker (အနီစက်)
                const dMarker = L.circleMarker(dLoc, { color: 'red', radius: 8 });

                // လမ်းကြောင်းမျဉ်း (Route)
                const line = L.polyline([pLoc, dLoc], { color: 'orange', weight: 2, dashArray: '5, 10' });

                orderLayers[id] = L.layerGroup([pMarker, dMarker, line]).addTo(adminMap);
            }
        }
        if (change.type === "removed") {
            if (orderLayers[id]) { adminMap.removeLayer(orderLayers[id]); delete orderLayers[id]; }
        }
    });
});

