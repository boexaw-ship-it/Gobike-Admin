import { db } from './firebase-config.js';
import { 
    collection, onSnapshot, query, where, doc, updateDoc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- ၁။ Map Setup ---
const adminMap = L.map('admin-map').setView([16.8661, 96.1951], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(adminMap);

// Marker တွေကို သိမ်းထားမယ့် object
let markers = { riders: {}, orders: {}, customers: {} };
let firstLoad = true;

// --- ၂။ Notification အသံဖိုင် ---
const alertSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

// --- ၃။ Rider Live Monitoring ---
onSnapshot(collection(db, "active_riders"), (snap) => {
    const riderCountElement = document.getElementById('rider-count');
    if (riderCountElement) riderCountElement.innerText = snap.size;

    snap.docChanges().forEach((change) => {
        const data = change.doc.data();
        const id = change.doc.id;

        if (data.lat && data.lng) {
            if (change.type === "added" || change.type === "modified") {
                // အဟောင်းရှိရင် ဖြုတ်တယ်
                if (markers.riders[id]) adminMap.removeLayer(markers.riders[id]);
                
                const riderIcon = L.icon({
                    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3198/3198336.png',
                    iconSize: [35, 35]
                });

                markers.riders[id] = L.marker([data.lat, data.lng], { icon: riderIcon })
                    .addTo(adminMap)
                    .bindPopup(`
                        <div style="text-align:center;">
                            <b>🚴 Rider: ${data.name || 'Rider'}</b><br>
                            📞 Phone: ${data.phone || 'N/A'}<br>
                            <span style="color: ${data.isOnline !== false ? '#2ecc71' : '#e74c3c'}">
                                ● ${data.isOnline !== false ? 'Online' : 'Offline'}
                            </span>
                        </div>
                    `);
            }
        }

        if (change.type === "removed") {
            if (markers.riders[id]) {
                adminMap.removeLayer(markers.riders[id]);
                delete markers.riders[id];
            }
        }
    });
});

// --- ၄။ Customer Live Monitoring ---
onSnapshot(collection(db, "customers"), (snap) => {
    const customerCountElement = document.getElementById('customer-count');
    if(customerCountElement) customerCountElement.innerText = snap.size;
    
    snap.docChanges().forEach((change) => {
        const data = change.doc.data();
        const id = change.doc.id;

        if (data.lat && data.lng) {
            if (change.type === "added" || change.type === "modified") {
                if (markers.customers[id]) adminMap.removeLayer(markers.customers[id]);
                
                const customerIcon = L.icon({
                    iconUrl: 'https://cdn-icons-png.flaticon.com/512/4140/4140048.png', 
                    iconSize: [30, 30]
                });

                markers.customers[id] = L.marker([data.lat, data.lng], { icon: customerIcon })
                    .addTo(adminMap)
                    .bindPopup(`<b>👤 Customer: ${data.name || 'User'}</b><br>📞 ${data.phone || 'N/A'}`);
            }
        }

        if (change.type === "removed") {
            if (markers.customers[id]) {
                adminMap.removeLayer(markers.customers[id]);
                delete markers.customers[id];
            }
        }
    });
});

// --- ၅။ Order Monitoring & Cancellation ---
const orderQuery = query(collection(db, "orders"), where("status", "!=", "completed"));
onSnapshot(orderQuery, (snap) => {
    const orderCountElement = document.getElementById('order-count');
    if (orderCountElement) orderCountElement.innerText = snap.size;

    // အသစ်တက်လာရင် အသံပေးမယ်
    if (!firstLoad && snap.docChanges().some(c => c.type === "added")) {
        alertSound.play().catch(e => console.log("Audio block: Tap map first"));
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

    // မြေပုံပေါ်က အော်ဒါ Marker ဟောင်းတွေကို အမြဲရှင်းတယ်
    Object.values(markers.orders).forEach(m => adminMap.removeLayer(m));
    markers.orders = {};

    snap.forEach((orderDoc) => {
        const order = orderDoc.data();
        const id = orderDoc.id;
        
        // Pickup နဲ့ Dropoff location နှစ်ခုလုံးရှိမှ မြေပုံပေါ်ဆွဲမယ်
        if (order.pickup?.lat && order.dropoff?.lat) {
            const pLoc = [order.pickup.lat, order.pickup.lng];
            const dLoc = [order.dropoff.lat, order.dropoff.lng];

            const pMarker = L.circleMarker(pLoc, { color: 'blue', radius: 8 }).bindPopup(`
                <div style="min-width:150px;">
                    <b style="color:#000;">📦 Item: ${order.item}</b><br>
                    👤 Name: ${order.customerName || 'N/A'}<br>
                    💰 Fee: ${order.deliveryFee || 0} KS<br><br>
                    <button onclick="window.cancelOrder('${id}')" 
                        style="background:#ff4757; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer; width:100%; font-weight:bold;">
                        ❌ Cancel Order
                    </button>
                </div>
            `);

            const dMarker = L.circleMarker(dLoc, { color: 'red', radius: 8 });
            const line = L.polyline([pLoc, dLoc], { color: 'orange', weight: 2, dashArray: '5, 10' });

            markers.orders[id] = L.layerGroup([pMarker, dMarker, line]).addTo(adminMap);
        }
    });
});

// --- ၆။ Global Cancel Function (သေချာစေရန် Window Object ထဲထည့်ခြင်း) ---
window.cancelOrder = async (orderId) => {
    const { isConfirmed } = await Swal.fire({
        title: 'အော်ဒါကို ပယ်ဖျက်မှာလား?',
        text: "ဤအော်ဒါကို Database ထဲမှ လုံးဝ ဖျက်ထုတ်ပါမည်။",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'ပယ်ဖျက်မည်',
        cancelButtonText: 'မလုပ်တော့ပါ',
        background: '#fff',
        color: '#000'
    });

    if (isConfirmed) {
        try {
            await deleteDoc(doc(db, "orders", orderId));
            Swal.fire('Deleted!', 'အော်ဒါကို ပယ်ဖျက်ပြီးပါပြီ။', 'success');
        } catch (error) {
            console.error("Delete Error:", error);
            Swal.fire('Error', 'ပယ်ဖျက်၍မရပါ- ' + error.message, 'error');
        }
    }
};
