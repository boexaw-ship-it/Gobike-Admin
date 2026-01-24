import { db } from './firebase-config.js';
import { 
    collection, onSnapshot, query, where, doc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- ၁။ Map Setup ---
const adminMap = L.map('admin-map').setView([16.8661, 96.1951], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(adminMap);

// GPS Live ဖြစ်ဖို့ Marker တွေကို ID အလိုက် သိမ်းထားမယ့် Object များ
let riderMarkers = {};
let customerMarkers = {};
let orderLayers = {}; // Order တစ်ခုချင်းစီရဲ့ (P, D, Line) ကို သိမ်းရန်

let firstLoad = true;
const alertSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

// --- ၂။ Rider Live Monitoring (GPS Live ပြင်ဆင်မှု) ---
onSnapshot(collection(db, "active_riders"), (snap) => {
    const riderCountElement = document.getElementById('rider-count');
    if (riderCountElement) riderCountElement.innerText = snap.size;

    snap.docChanges().forEach((change) => {
        const data = change.doc.data();
        const id = change.doc.id;

        if (change.type === "added" || change.type === "modified") {
            if (data.lat && data.lng) {
                if (riderMarkers[id]) {
                    // ✅ Marker ရှိပြီးသားဆိုလျှင် နေရာ (GPS) ကိုပဲ ရွှေ့မည်
                    riderMarkers[id].setLatLng([data.lat, data.lng]);
                } else {
                    // Marker အသစ်ဆွဲမည်
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

// --- ၃။ Customer Live Monitoring ---
onSnapshot(collection(db, "customers"), (snap) => {
    const customerCountElement = document.getElementById('customer-count');
    if(customerCountElement) customerCountElement.innerText = snap.size;
    
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
                    customerMarkers[id] = L.marker([data.lat, data.lng], { icon: customerIcon })
                        .addTo(adminMap)
                        .bindPopup(`<b>👤 Customer: ${data.name || 'User'}</b>`);
                }
            }
        }
        if (change.type === "removed") {
            if (customerMarkers[id]) {
                adminMap.removeLayer(customerMarkers[id]);
                delete customerMarkers[id];
            }
        }
    });
});

// --- ၄။ Order Monitoring & Cancellation ---
const orderQuery = query(collection(db, "orders"), where("status", "!=", "completed"));

onSnapshot(orderQuery, (snap) => {
    const orderCountElement = document.getElementById('order-count');
    if (orderCountElement) orderCountElement.innerText = snap.size;

    if (!firstLoad && snap.docChanges().some(c => c.type === "added")) {
        alertSound.play().catch(e => console.log("Sound error:", e));
    }
    firstLoad = false;

    snap.docChanges().forEach((change) => {
        const order = change.doc.data();
        const id = change.doc.id;

        if (change.type === "added" || change.type === "modified") {
            // အဟောင်းရှိရင် ရှင်းထုတ်ပြီး အသစ်ပြန်ဆွဲမည် (Status ပြောင်းနိုင်သောကြောင့်)
            if (orderLayers[id]) adminMap.removeLayer(orderLayers[id]);

            if (order.pickup?.lat && order.dropoff?.lat) {
                const pLoc = [order.pickup.lat, order.pickup.lng];
                const dLoc = [order.dropoff.lat, order.dropoff.lng];

                const pMarker = L.circleMarker(pLoc, { color: 'blue', radius: 8 }).bindPopup(`
                    <div style="min-width:150px; color:#000;">
                        <b>📦 Item: ${order.item}</b><br>
                        💰 Fee: ${order.deliveryFee || 0} KS<br>
                        📍 Status: ${order.status}<br><br>
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

// --- ၅။ Global Cancel Function (Window Object တွင် တိုက်ရိုက်ချိတ်ခြင်း) ---
window.cancelOrder = async (id) => {
    const result = await Swal.fire({
        title: 'သေချာပါသလား?',
        text: "ဤအော်ဒါကို Database ထဲမှ ဖျက်ပစ်ပါမည်။",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'ဖျက်မည်',
        cancelButtonText: 'မဖျက်တော့ပါ'
    });

    if (result.isConfirmed) {
        try {
            await deleteDoc(doc(db, "orders", id));
            Swal.fire('အောင်မြင်ပါသည်!', 'အော်ဒါကို ဖျက်လိုက်ပါပြီ။', 'success');
        } catch (error) {
            Swal.fire('မှားယွင်းမှု!', error.message, 'error');
        }
    }
};
