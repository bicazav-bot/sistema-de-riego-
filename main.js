function abrirModalQR() {
    const urlActual = window.location.href;
    document.getElementById("urlActual").textContent = urlActual;
    document.getElementById("qrImage").src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(urlActual)}`;
    document.getElementById("qrModal").style.display = "flex";
}
function cerrarModalQRDirecto() { document.getElementById("qrModal").style.display = "none"; }
function cerrarModalQR(event) { if (event.target.id === "qrModal") document.getElementById("qrModal").style.display = "none"; }

const brokerHost = "broker.hivemq.com";
const brokerPort = 8884;
const brokerPath = "/mqtt";
const clientId   = "AgroWeb-" + Math.random().toString(16).substring(2, 8);

const topicSoil      = "esp32/riego/suelo";
const topicPump      = "esp32/riego/bomba";
const topicStatus    = "esp32/riego/status";
const topicUmbralOff = "esp32/riego/umbral_off";
const topicModo      = "esp32/riego/modo";

let client = new Paho.MQTT.Client(brokerHost, Number(brokerPort), brokerPath, clientId);

const ctx = document.getElementById('humidityChart').getContext('2d');
const humidityChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Humedad (%)', data: [], borderColor: '#059669',
            backgroundColor: 'rgba(5, 150, 105, 0.1)', borderWidth: 2, tension: 0.3, fill: true, pointRadius: 2
        }]
    },
    options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
            y: { min: 0, max: 100, grid: { color: '#f1f5f9' }, ticks: { color: '#64748b' } },
            x: { grid: { display: false }, ticks: { color: '#64748b', maxTicksLimit: 6 } }
        },
        plugins: { legend: { display: false } }
    }
});

function setConexionESP32(estadoOnline) {
    const dot = document.getElementById("statusDot");
    const text = document.getElementById("statusText");
    if(!dot || !text) return;

    if(estadoOnline) {
        dot.classList.add("online"); 
        text.textContent = "CONECTADO"; 
    } else {
        dot.classList.remove("online"); 
        text.textContent = "DESCONECTADO"; 
    }
}

function actualizarInterfazRelé(textoEstado) {
    let box = document.getElementById("pumpBox");
    let text = document.getElementById("pumpStateText");
    if (!box || !text) return;

    text.textContent = textoEstado;

    if (textoEstado.includes("ENCENDIDO") || textoEstado.includes("FORZADO")) {
        if (textoEstado.includes("APAGADO")) {
            box.className = "pump-box inactive";
        } else if (textoEstado.includes("FORZADO")) {
            box.className = "pump-box warning"; 
        } else {
            box.className = "pump-box active";
        }
    } else {
        box.className = "pump-box inactive";
    }
}

client.onConnectionLost = (responseObject) => {
    setConexionESP32(false);
    setTimeout(conectar, 5000);
};

client.onMessageArrived = (msg) => {
    const top = msg.destinationName;
    const val = msg.payloadString;

    if (top === topicStatus) {
        setConexionESP32(val === "ONLINE");
    }
    else if (top === topicSoil) {
        let hum = parseInt(val);
        document.getElementById("humedadVal").textContent = hum;
        document.getElementById("gaugeBar").style.transform = `rotate(${((hum / 100) * 180) - 180}deg)`;

        let estadoTxt = document.getElementById("estadoSueloTxt");
        if (hum <= 30) {
            estadoTxt.textContent = "Suelo Seco";
            estadoTxt.style.color = "var(--danger)";
        } else {
            estadoTxt.textContent = "Humedad Adecuada";
            estadoTxt.style.color = "var(--primary)";
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
        actualizarInterfazRelé(val);
    }
};

function conectar() {
    client.connect({
        useSSL: true,
        onSuccess: () => {
            client.subscribe(topicSoil);
            client.subscribe(topicPump);
            client.subscribe(topicStatus);
        },
        onFailure: (err) => { 
            setConexionESP32(false); 
            setTimeout(conectar, 5000); 
        }
    });
}

function guardarUmbral() {
    let aviso = document.getElementById("statusCalibracion");
    let umbralOff = document.getElementById("rangeOff").value;

    aviso.textContent = "enviando...";
    aviso.className = "status-calib enviando";

    if (client && client.isConnected()) {
        let msgOff = new Paho.MQTT.Message(String(umbralOff));
        msgOff.destinationName = topicUmbralOff;
        client.send(msgOff);
    }

    setTimeout(() => {
        aviso.textContent = "actualizado";
        aviso.className = "status-calib actualizado";
        setTimeout(() => { aviso.className = "status-calib"; aviso.textContent = ""; }, 3000);
    }, 800);
}

function enviarModo(modo) {
    if (client && client.isConnected()) {
        let mensajeModo = new Paho.MQTT.Message(modo);
        mensajeModo.destinationName = topicModo;
        client.send(mensajeModo);
    } else {
        alert("No hay conexión con el servidor MQTT");
        conectar();
    }
}

conectar();
