import { db } from './firebase-config.js';
import { 
    collection, onSnapshot, query, where, doc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- ၁။ Map Setup ---
const adminMap = L.map('admin-map', { zoomControl: false }).setView([16.8661, 96.1951], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(adminMap);

// Live Update အတွက် Marker များကို ID ဖြင့် သိမ်းထားရန် Object များ
let riderMarkers = {};
let customerMarkers = {};
let orderLayers = {}; 
let firstLoad = true;
const alertSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

// --- ၂။ Global Cancel Function (HTML Button မှ ခေါ်နိုင်ရန်) ---
window.cancelOrder = async (orderId) => {
    const result = await Swal.fire({
        title: 'အော်ဒါကို ဖျက်မှာလား?',
        text: "ဤအော်ဒါကို Database ထဲမှ အပြီးတိုင် ဖျက်ထုတ်ပါမည်။",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff4757',
        confirmButtonText: 'ဖျက်မည်',
        cancelButtonText: 'မဖျက်တော့ပါ'
    });

    if (result.isConfirmed) {
        try {
            await deleteDoc(doc(db, "orders", orderId));
            Swal.fire({
                title: 'Deleted!',
                text: 'အော်ဒါကို ဖျက်ပြီးပါပြီ။',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            });
        } catch (error) {
            Swal.fire('Error', 'ဖျက်၍မရပါ- ' + error.message, 'error');
        }
    }
};

// --- ၃။ Rider Live Monitoring (GPS Live ပြောင်းလဲမှု) ---
onSnapshot(collection(db, "active_riders"), (snap) => {
    document.getElementById('rider-count').innerText = snap.size;

    snap.docChanges().forEach((change) => {
        const data = change.doc.data();
        const id = change.doc.id;

        if (change.type === "added" || change.type === "modified") {
            if (data.lat && data.lng) {
                if (riderMarkers[id]) {
                    // GPS နေရာကိုပဲ ရွှေ့ပေးခြင်း
                    riderMarkers[id].setLatLng([data.lat, data.lng]);
                } else {
                    const riderIcon = L.icon({
                        iconUrl: 'https://cdn-icons-png.flaticon.com/512/3198/3198336.png',
                        iconSize: [35, 35]
                    });
                    riderMarkers[id] = L.marker([data.lat, data.lng], { icon: riderIcon })
                        .addTo(adminMap)
                        .bindPopup(`<b>🚴 Rider: ${data.name || 'Rider'}</b>`);
                }
            }
        }
        if (change.type === "removed") {
            if (riderMarkers[id]) {
                adminMap.removeLayer(riderMarkers[id]);
                delete riderMarkers[id];
            }
        }
    });
});

// --- ၄။ Customer Live Monitoring ---
onSnapshot(collection(db, "customers"), (snap) => {
    document.getElementById('customer-count').innerText = snap.size;
    snap.docChanges().forEach((change) => {
        const data = change.doc.data();
        const id = change.doc.id;
        if (change.type === "added" || change.type === "modified") {
            if (data.lat && data.lng) {
                if (customerMarkers[id]) {
                    customerMarkers[id].setLatLng([data.lat, data.lng]);
                } else {
                    const customerIcon = L.icon({
                        iconUrl: 'https://cdn-icons-png.flaticon.com/512/4140/4140048.png', 
                        iconSize: [30, 30]
                    });
                    customerMarkers[id] = L.marker([data.lat, data.lng], { icon: customerIcon }).addTo(adminMap);
                }
            }
        }
    });
});

// --- ၅။ Order Monitoring & UI Update ---
const orderQuery = query(collection(db, "orders"), where("status", "!=", "completed"));
onSnapshot(orderQuery, (snap) => {
    document.getElementById('order-count').innerText = snap.size;
    
    if (!firstLoad && snap.docChanges().some(c => c.type === "added")) {
        alertSound.play().catch(e => console.log("Sound interaction needed"));
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
                    <div style="min-width:140px; color:#000;">
                        <b>📦 Item: ${order.item}</b><br>
                        💰 Fee: ${order.deliveryFee} KS<br><br>
                        <button onclick="window.cancelOrder('${id}')" 
                            style="background:#ff4757; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer; width:100%; font-weight:bold;">
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

