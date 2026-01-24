import { db } from './firebase-config.js';
import { 
    collection, onSnapshot, query, where, doc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- ၁။ Map Setup ---
const adminMap = L.map('admin-map').setView([16.8661, 96.1951], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(adminMap);

let riderMarkers = {};
let orderLayers = {}; 
let firstLoad = true;
const alertSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

// --- ၂။ Global Cancel Function (သေချာအောင် အပေါ်ဆုံးမှာ ထားပါမယ်) ---
window.cancelOrder = async (id) => {
    // နှိပ်လိုက်တာနဲ့ ဒီ message တက်လာရပါမယ်
    const result = await Swal.fire({
        title: 'အော်ဒါဖျက်မှာလား?',
        text: "Database ထဲမှ အပြီးဖျက်ထုတ်ပါမည်။",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'ဖျက်မည်',
        cancelButtonText: 'မဖျက်တော့ပါ'
    });

    if (result.isConfirmed) {
        try {
            await deleteDoc(doc(db, "orders", id));
            Swal.fire('Deleted!', 'အော်ဒါကို ဖျက်ပြီးပါပြီ။', 'success');
        } catch (error) {
            console.error("Delete error:", error);
            Swal.fire('Error', 'ဖျက်လို့မရပါ- ' + error.message, 'error');
        }
    }
};

// --- ၃။ Rider Live Monitoring ---
onSnapshot(collection(db, "active_riders"), (snap) => {
    snap.docChanges().forEach((change) => {
        const data = change.doc.data();
        const id = change.doc.id;
        if (change.type === "added" || change.type === "modified") {
            if (data.lat && data.lng) {
                if (riderMarkers[id]) {
                    riderMarkers[id].setLatLng([data.lat, data.lng]);
                } else {
                    const riderIcon = L.icon({
                        iconUrl: 'https://cdn-icons-png.flaticon.com/512/3198/3198336.png',
                        iconSize: [35, 35]
                    });
                    riderMarkers[id] = L.marker([data.lat, data.lng], { icon: riderIcon }).addTo(adminMap);
                }
            }
        }
    });
});

// --- ၄။ Order Monitoring ---
const orderQuery = query(collection(db, "orders"), where("status", "!=", "completed"));
onSnapshot(orderQuery, (snap) => {
    // အသံပေးခြင်း
    if (!firstLoad && snap.docChanges().some(c => c.type === "added")) {
        alertSound.play().catch(() => {});
    }
    firstLoad = false;

    snap.docChanges().forEach((change) => {
        const order = change.doc.data();
        const id = change.doc.id;

        if (change.type === "added" || change.type === "modified") {
            if (orderLayers[id]) adminMap.removeLayer(orderLayers[id]);

            if (order.pickup?.lat && order.dropoff?.lat) {
                const pLoc = [order.pickup.lat, order.pickup.lng];
                const dLoc = [order.dropoff.lat, order.dropoff.lng];

                const pMarker = L.circleMarker(pLoc, { color: 'blue', radius: 8 }).bindPopup(`
                    <div style="min-width:140px; color:#000; font-family:sans-serif;">
                        <b>📦 Item: ${order.item}</b><br>
                        💰 Fee: ${order.deliveryFee} KS<br><br>
                        <button onclick="window.cancelOrder('${id}')" 
                            style="background:#ff4757; color:white; border:none; padding:8px 12px; border-radius:5px; cursor:pointer; width:100%; font-weight:bold;">
                            ❌ Cancel Order
                        </button>
                    </div>
                `);

                const dMarker = L.circleMarker(dLoc, { color: 'red', radius: 8 });
                const line = L.polyline([pLoc, dLoc], { color: 'orange', weight: 2, dashArray: '5, 10' });

                orderLayers[id] = L.layerGroup([pMarker, dMarker, line]).addTo(adminMap);
            }
        }
        if (change.type === "removed") {
            if (orderLayers[id]) {
                adminMap.removeLayer(orderLayers[id]);
                delete orderLayers[id];
            }
        }
    });
});
