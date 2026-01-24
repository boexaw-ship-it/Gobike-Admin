import { db } from './firebase-config.js';
import { 
    collection, onSnapshot, query, where, doc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const adminMap = L.map('admin-map', { zoomControl: false }).setView([16.8661, 96.1951], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(adminMap);

let riderMarkers = {};
let orderLayers = {}; 
let firstLoad = true;

// --- ၁။ Global Cancel Function (HTML ကနေ ခေါ်လို့ရအောင် window ထဲထည့်ခြင်း) ---
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

// --- ၂။ Rider Monitoring (Live GPS + Online/Offline Status) ---
onSnapshot(collection(db, "active_riders"), (snap) => {
    document.getElementById('rider-count').innerText = snap.size;
    
    snap.docChanges().forEach((change) => {
        const data = change.doc.data();
        const id = change.doc.id;

        if (change.type === "added" || change.type === "modified") {
            // Online ဖြစ်မဖြစ် စစ်ဆေးခြင်း (isOnline က true/false ဖြစ်ရမယ်)
            const isOnline = data.isOnline === true; 
            const statusColor = isOnline ? '#2ed573' : '#ff4757';
            const statusText = isOnline ? 'Online' : 'Offline';

            if (riderMarkers[id]) {
                riderMarkers[id].setLatLng([data.lat, data.lng]);
                // Popup content ကိုပါ update လုပ်မယ် (Online/Offline သိရအောင်)
                riderMarkers[id].setPopupContent(`<b>🚴 ${data.name}</b><br><span style="color:${statusColor}">● ${statusText}</span>`);
            } else {
                const riderIcon = L.icon({
                    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3198/3198336.png',
                    iconSize: [35, 35]
                });
                riderMarkers[id] = L.marker([data.lat, data.lng], { icon: riderIcon })
                    .addTo(adminMap)
                    .bindPopup(`<b>🚴 ${data.name || 'Rider'}</b><br><span style="color:${statusColor}">● ${statusText}</span>`);
            }
        }
        if (change.type === "removed") {
            if (riderMarkers[id]) { adminMap.removeLayer(riderMarkers[id]); delete riderMarkers[id]; }
        }
    });
});

// --- ၃။ Order Monitoring (With Fixed Cancel Button) ---
const orderQuery = query(collection(db, "orders"), where("status", "!=", "completed"));
onSnapshot(orderQuery, (snap) => {
    document.getElementById('order-count').innerText = snap.size;
    
    snap.docChanges().forEach((change) => {
        const order = change.doc.data();
        const id = change.doc.id;

        if (change.type === "added" || change.type === "modified") {
            if (orderLayers[id]) adminMap.removeLayer(orderLayers[id]);

            if (order.pickup?.lat && order.dropoff?.lat) {
                const pLoc = [order.pickup.lat, order.pickup.lng];
                const dLoc = [order.dropoff.lat, order.dropoff.lng];

                const pMarker = L.circleMarker(pLoc, { color: 'blue', radius: 8 }).bindPopup(`
                    <div style="text-align:center;">
                        <b style="color:black;">📦 ${order.item}</b><br>
                        <button onclick="cancelOrder('${id}')" 
                            style="background:#ff4757; color:white; border:none; padding:5px 10px; border-radius:5px; margin-top:10px; cursor:pointer;">
                            Cancel Order
                        </button>
                    </div>
                `);

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

