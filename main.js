function abrirModalQR() {
    const urlActual = window.location.href;
    document.getElementById("urlActual").textContent = urlActual;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(urlActual)}`;
    document.getElementById("qrImage").src = qrUrl;
    document.getElementById("qrModal").style.display = "flex";
}

function cerrarModalQRDirecto() { document.getElementById("qrModal").style.display = "none"; }
function cerrarModalQR(event) { if (event.target.id === "qrModal") document.getElementById("qrModal").style.display = "none"; }

const brokerHost = "broker.hivemq.com";
const brokerPort = 8884;
const clientId   = "AgroClientHTTPS-" + Math.random().toString(16).substring(2, 8);

const topicSoil      = "esp32/riego/suelo";
const topicPump      = "esp32/riego/bomba";
const topicStatus    = "esp32/riego/status";
const topicUmbralOn  = "esp32/riego/umbral_on";
const topicUmbralOff = "esp32/riego/umbral_off";

let client = new Paho.MQTT.Client(brokerHost, Number(brokerPort), clientId);

const ctx = document.getElementById('humidityChart').getContext('2d');
const humidityChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Humedad (%)',
            data: [],
            borderColor: '#059669',
            backgroundColor: 'rgba(5, 150, 105, 0.1)',
            borderWidth: 2,
            tension: 0.3,
            fill: true,
            pointRadius: 2
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: { min: 0, max: 100, grid: { color: '#f1f5f9' }, ticks: { color: '#64748b' } },
            x: { grid: { display: false }, ticks: { color: '#64748b', maxTicksLimit: 6 } }
        },
        plugins: { legend: { display: false } }
    }
});

function log(texto) {
    const box = document.getElementById("logBox");
    if (!box) return;
    box.innerHTML += `[${new Date().toLocaleTimeString()}] ${texto}<br>`;
    box.scrollTop = box.scrollHeight;
}

function setConexion(status) {
    const dot = document.getElementById("statusDot");
    const text = document.getElementById("statusText");
    if(!dot || !text) return;
    if(status) {
        dot.classList.add("online");
        text.textContent = "CONECTADO SEGURO";
    } else {
        dot.classList.remove("online");
        text.textContent = "DESCONECTADO";
    }
}

client.onConnectionLost = () => { setConexion(false); setTimeout(conectar, 5000); };

client.onMessageArrived = (msg) => {
    setConexion(true);
    const top = msg.destinationName;
    const val = msg.payloadString;

    if (top === topicSoil) {
        let hum = parseInt(val);
        document.getElementById("humedadVal").textContent = hum;
        document.getElementById("gaugeBar").style.transform = `rotate(${(hum / 100) * 180 - 90}deg)`;

        let estadoTxt = document.getElementById("estadoSueloTxt");
        let condTxt = document.getElementById("conductividadTxt");
        if (hum < 30) {
            estadoTxt.textContent = "Seco (Requiere Riego)";
            estadoTxt.style.color = "var(--danger)";
            condTxt.textContent = "Resistencia Alta";
        } else if (hum <= 70) {
            estadoTxt.textContent = "Humedad Óptima";
            estadoTxt.style.color = "var(--primary)";
            condTxt.textContent = "Estable";
        } else {
            estadoTxt.textContent = "Saturado / Agua";
            estadoTxt.style.color = "var(--secondary)";
            condTxt.textContent = "Conductiva";
        }

        let hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        if (humidityChart.data.labels.length >= 15) {
            humidityChart.data.labels.shift();
            humidityChart.data.datasets[0].data.shift();
        }
        humidityChart.data.labels.push(hora);
        humidityChart.data.datasets[0].data.push(hum);
        humidityChart.update('none');
    }
    else if (top === topicPump) {
        let box = document.getElementById("pumpBox");
        let text = document.getElementById("pumpStateText");
        if (val === "ON") {
            box.classList.add("active");
            text.textContent = "💧 BOMBA ACTIVA";
            log("Bomba encendida");
        } else {
            box.classList.remove("active");
            text.textContent = "⛔ BOMBA INACTIVA";
            log("Bomba apagada");
        }
    }
    else if (top === topicStatus) {
        setConexion(val === "ONLINE");
    }
};

function conectar() {
    client.connect({
        useSSL: true,
        onSuccess: () => {
            client.subscribe(topicSoil);
            client.subscribe(topicPump);
            client.subscribe(topicStatus);
            log("Conectado vía HTTPS/WSS.");
        },
        onFailure: () => { setConexion(false); setTimeout(conectar, 5000); }
    });
}

function enviarComando(cmd) {
    if (!client.isConnected()) { alert("Sin conexión."); return; }
    client.send(new Paho.MQTT.Message(cmd), topicPump);
    log(`Comando: ${cmd}`);
}

function guardarUmbrales() {
    if (!client.isConnected()) { alert("Sin conexión."); return; }
    let umbralOn = document.getElementById("rangeOn").value;
    let umbralOff = document.getElementById("rangeOff").value;
    client.send(new Paho.MQTT.Message(umbralOn), topicUmbralOn);
    client.send(new Paho.MQTT.Message(umbralOff), topicUmbralOff);
    log(`Umbrales -> Encender: <${umbralOn}% | Apagar: >=${umbralOff}%`);
    alert("¡Umbrales actualizados!");
}

conectar();