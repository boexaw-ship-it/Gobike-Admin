import { db } from './firebase-config.js';
import { 
    collection, onSnapshot, query, where, doc, updateDoc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- ၁။ Map Setup ---
const adminMap = L.map('admin-map').setView([16.8661, 96.1951], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(adminMap);

let markers = { riders: {}, orders: {} };
let firstLoad = true;

// --- ၂။ Notification အသံဖိုင် (အော်ဒါအသစ်တက်ရင် အသံမြည်ရန်) ---
const alertSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

// --- ၃။ Rider Live Monitoring & Details ---
onSnapshot(collection(db, "active_riders"), (snap) => {
    document.getElementById('rider-count').innerText = snap.size;
    snap.docChanges().forEach((change) => {
        const data = change.doc.data();
        const id = change.doc.id;

        if (change.type === "added" || change.type === "modified") {
            if (markers.riders[id]) adminMap.removeLayer(markers.riders[id]);
            
            const riderIcon = L.icon({
                iconUrl: 'https://cdn-icons-png.flaticon.com/512/3198/3198336.png',
                iconSize: [35, 35]
            });

            markers.riders[id] = L.marker([data.lat, data.lng], { icon: riderIcon })
                .addTo(adminMap)
                .bindPopup(`
                    <div style="text-align:center;">
                        <b>🚴 Rider: ${data.name}</b><br>
                        📞 <a href="tel:${data.phone}">${data.phone}</a><br>
                        <small>Status: ${data.isOnline ? '🟢 Online' : '🔴 Offline'}</small>
                    </div>
                `);
        }
    });
});

// --- ၄။ Order Monitoring & Cancellation ---
const orderQuery = query(collection(db, "orders"), where("status", "!=", "completed"));
onSnapshot(orderQuery, (snap) => {
    document.getElementById('order-count').innerText = snap.size;

    // အော်ဒါအသစ်တက်လာရင် Notification ပြပြီး အသံမြည်ရန်
    if (!firstLoad && snap.docChanges().some(c => c.type === "added")) {
        alertSound.play();
        Swal.fire({
            title: '🔔 Order အသစ်တက်လာပါပြီ!',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            icon: 'info'
        });
    }
    firstLoad = false;

    // Marker အဟောင်းများရှင်းရန်
    Object.values(markers.orders).forEach(m => adminMap.removeLayer(m));
    markers.orders = {};

    snap.forEach((orderDoc) => {
        const order = orderDoc.data();
        const id = orderDoc.id;
        const pLoc = [order.pickup.lat, order.pickup.lng];
        const dLoc = [order.dropoff.lat, order.dropoff.lng];

        const pMarker = L.circleMarker(pLoc, { color: 'blue', radius: 8 }).bindPopup(`
            <b>📦 ပစ္စည်း: ${order.item}</b><br>
            👤 Customer: ${order.customerName}<br>
            💰 တန်ဖိုး: ${order.deliveryFee} KS<br><br>
            <button onclick="cancelOrder('${id}')" style="background:#ff4757; color:white; border:none; padding:5px; border-radius:5px; cursor:pointer;">❌ Cancel Order</button>
        `);

        const dMarker = L.circleMarker(dLoc, { color: 'red', radius: 8 });
        const line = L.polyline([pLoc, dLoc], { color: 'orange', weight: 2, dashArray: '5, 10' });

        markers.orders[id] = L.layerGroup([pMarker, dMarker, line]).addTo(adminMap);
    });
});

// --- ၅။ Cancel Order Function (Global ဖြစ်အောင် window ထဲထည့်ပါ) ---
window.cancelOrder = async (orderId) => {
    const { isConfirmed } = await Swal.fire({
        title: 'အော်ဒါကို ပယ်ဖျက်မှာလား?',
        text: "ဤလုပ်ဆောင်ချက်ကို ပြန်ပြင်၍မရပါ!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'ပယ်ဖျက်မည်',
        cancelButtonText: 'မလုပ်တော့ပါ'
    });

    if (isConfirmed) {
        try {
            await deleteDoc(doc(db, "orders", orderId));
            Swal.fire('Deleted!', 'အော်ဒါကို ပယ်ဖျက်ပြီးပါပြီ။', 'success');
        } catch (error) {
            Swal.fire('Error', 'ပယ်ဖျက်၍မရပါ- ' + error.message, 'error');
        }
    }
};

