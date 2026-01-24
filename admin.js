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

// --- ၂။ Rider Monitoring (Live GPS) ---
onSnapshot(collection(db, "active_riders"), (snap) => {
    document.getElementById('rider-count').innerText = snap.size;
    
    snap.docChanges().forEach((change) => {
        const data = change.doc.data();
        const id = change.doc.id;

        if (change.type === "added" || change.type === "modified") {
            const isOnline = data.isOnline === true; 
            const statusColor = isOnline ? '#2ed573' : '#ff4757';
            const statusText = isOnline ? 'Online' : 'Offline';

            if (riderMarkers[id]) {
                riderMarkers[id].setLatLng([data.lat, data.lng]);
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

// --- ၃။ Order Monitoring (Logic မပျက်ဘဲ Index Error ကင်းဝေးစေသောနည်း) ---
// index error မတက်စေရန် ရိုးရိုး query ကိုပဲ သုံးပါမည်
const orderQuery = query(collection(db, "orders"));

onSnapshot(orderQuery, (snap) => {
    // completed မဟုတ်သော အော်ဒါများကိုသာ စစ်ထုတ်ပြီး အရေအတွက်ပြမည်
    const activeDocs = snap.docs.filter(d => d.data().status !== "completed");
    document.getElementById('order-count').innerText = activeDocs.length;
    
    snap.docChanges().forEach((change) => {
        const order = change.doc.data();
        const id = change.doc.id;

        // အကယ်၍ အော်ဒါ status က completed ဖြစ်သွားလျှင် မြေပုံပေါ်က ဖယ်ထုတ်မည်
        if (order.status === "completed") {
            if (orderLayers[id]) {
                adminMap.removeLayer(orderLayers[id]);
                delete orderLayers[id];
            }
            return;
        }

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
