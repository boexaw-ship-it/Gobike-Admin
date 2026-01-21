import { db } from './firebase-config.js';
import { 
    collection, onSnapshot, query, where, doc, updateDoc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- ၁။ Map Setup ---
const adminMap = L.map('admin-map').setView([16.8661, 96.1951], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(adminMap);

let markers = { riders: {}, orders: {}, customers: {} };
let firstLoad = true;

// --- ၂။ Notification အသံဖိုင် ---
const alertSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

// --- ၃။ Rider Live Monitoring (Phone Bug Fixed) ---
onSnapshot(collection(db, "active_riders"), (snap) => {
    document.getElementById('rider-count').innerText = snap.size;
    snap.docChanges().forEach((change) => {
        const data = change.doc.data();
        const id = change.doc.id;

        if (change.type === "added" || change.type === "modified") {
            if (markers.riders[id]) adminMap.removeLayer(markers.riders[id]);
            
            // Database ထဲက phone ကို သေချာဆွဲထုတ်ခြင်း
            const riderPhone = data.phone || "N/A";

            const riderIcon = L.icon({
                iconUrl: 'https://cdn-icons-png.flaticon.com/512/3198/3198336.png',
                iconSize: [35, 35]
            });

            markers.riders[id] = L.marker([data.lat, data.lng], { icon: riderIcon })
                .addTo(adminMap)
                .bindTooltip(`Rider: ${data.name}<br>📞 ${riderPhone}`, { permanent: true, direction: 'bottom' })
                .bindPopup(`
                    <div style="text-align:center;">
                        <b>🚴 Rider: ${data.name}</b><br>
                        📞 <a href="tel:${riderPhone}">${riderPhone}</a><br>
                        <small>Status: ${data.isOnline ? '🟢 Online' : '🔴 Offline'}</small>
                    </div>
                `);
        } else if (change.type === "removed") {
            if (markers.riders[id]) adminMap.removeLayer(markers.riders[id]);
        }
    });
});

// --- ၄။ Customer Live Monitoring (Phone Bug Fixed) ---
onSnapshot(collection(db, "customers"), (snap) => {
    if(document.getElementById('customer-count')) {
        document.getElementById('customer-count').innerText = snap.size;
    }
    
    snap.docChanges().forEach((change) => {
        const data = change.doc.data();
        const id = change.doc.id;

        if (change.type === "added" || change.type === "modified") {
            if (markers.customers[id]) adminMap.removeLayer(markers.customers[id]);
            
            // Customer ဖုန်းနံပါတ်ကို သေချာဆွဲထုတ်ခြင်း
            const customerPhone = data.phone || "N/A";

            const customerIcon = L.icon({
                iconUrl: 'https://cdn-icons-png.flaticon.com/512/4140/4140048.png',
                iconSize: [30, 30]
            });

            markers.customers[id] = L.marker([data.lat, data.lng], { icon: customerIcon })
                .addTo(adminMap)
                .bindTooltip(`User: ${customerPhone}`, { permanent: true, direction: 'top' })
                .bindPopup(`
                    <div style="text-align:center;">
                        <b>👤 Customer: ${data.name || 'အမည်မသိ'}</b><br>
                        📞 <a href="tel:${customerPhone}">${customerPhone}</a>
                    </div>
                `);
        } else if (change.type === "removed") {
            if (markers.customers[id]) adminMap.removeLayer(markers.customers[id]);
        }
    });
});

// --- ၅။ Order Monitoring & Cancellation ---
const orderQuery = query(collection(db, "orders"), where("status", "!=", "completed"));
onSnapshot(orderQuery, (snap) => {
    document.getElementById('order-count').innerText = snap.size;

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

    Object.values(markers.orders).forEach(m => adminMap.removeLayer(m));
    markers.orders = {};

    snap.forEach((orderDoc) => {
        const order = orderDoc.data();
        const orderId = orderDoc.id;
        const oPhone = order.customerPhone || order.phone || "N/A";
        const pLoc = [order.pickup.lat, order.pickup.lng];
        const dLoc = [order.dropoff.lat, order.dropoff.lng];

        const pMarker = L.circleMarker(pLoc, { color: 'blue', radius: 8 })
            .bindTooltip(`📦 ${order.item}<br>📞 ${oPhone}`, { permanent: false })
            .bindPopup(`
                <div style="line-height: 1.6;">
                    <b>📦 ပစ္စည်း: ${order.item}</b><br>
                    👤 Customer: ${order.customerName}<br>
                    📞 ဖုန်း: <a href="tel:${oPhone}">${oPhone}</a><br>
                    💰 Delivery: ${order.deliveryFee} KS<br>
                    <hr>
                    <button onclick="cancelOrder('${orderId}')" style="background:#ff4757; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer; width:100%;">❌ Cancel Order</button>
                </div>
            `);

        const dMarker = L.circleMarker(dLoc, { color: 'red', radius: 8 });
        const line = L.polyline([pLoc, dLoc], { color: 'orange', weight: 2, dashArray: '5, 10' });

        markers.orders[orderId] = L.layerGroup([pMarker, dMarker, line]).addTo(adminMap);
    });
});

// --- ၆။ Global Cancel Function ---
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

