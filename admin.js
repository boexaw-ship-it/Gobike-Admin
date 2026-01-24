import { db } from './firebase-config.js';
import { 
    collection, onSnapshot, query, doc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const adminMap = L.map('admin-map', { zoomControl: false }).setView([16.8661, 96.1951], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(adminMap);

let riderMarkers = {};
let orderLayers = {}; 

// --- ၁။ Global Cancel Function ---
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

// --- ၂။ Rider Monitoring (Riders: နေရာအတွက်) ---
onSnapshot(collection(db, "active_riders"), (snap) => {
    document.getElementById('rider-count').innerText = snap.size;
    snap.docChanges().forEach((change) => {
        const data = change.doc.data();
        const id = change.doc.id;
        if (change.type === "added" || change.type === "modified") {
            if (riderMarkers[id]) {
                riderMarkers[id].setLatLng([data.lat, data.lng]);
            } else {
                const riderIcon = L.icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/3198/3198336.png', iconSize: [35, 35] });
                riderMarkers[id] = L.marker([data.lat, data.lng], { icon: riderIcon }).addTo(adminMap);
            }
        }
    });
});

// --- ၃။ User Monitoring (Users: နေရာအတွက် - customers collection ကိုသုံးမည်) ---
onSnapshot(collection(db, "customers"), (snap) => {
    const userCountElement = document.getElementById('user-count');
    if (userCountElement) {
        userCountElement.innerText = snap.size; // customers collection ထဲက အရေအတွက်ကို ပြမည်
    }
});

// --- ၄။ Order Monitoring (Orders: နေရာအတွက်) ---
const orderQuery = query(collection(db, "orders"));
onSnapshot(orderQuery, (snap) => {
    const activeOrders = snap.docs.filter(d => d.data().status !== "completed");
    document.getElementById('order-count').innerText = activeOrders.length;
    
    snap.docChanges().forEach((change) => {
        const order = change.doc.data();
        const id = change.doc.id;

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
    });
});
