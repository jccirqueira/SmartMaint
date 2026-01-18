/**
 * IOT Simulation Module
 * Handles mock MQTT connection and Canvas rendering for gauges/charts
 */

export class IOTManager {
    constructor() {
        this.sensors = new Map(); // id -> { type, value, history: [] }
        this.subscribers = [];
        this.isSimulating = false;
    }

    // Mock MQTT Broker Connection
    connect(brokerUrl) {
        console.log(`Connecting to MQTT broker at ${brokerUrl}...`);
        // In a real app, use Paho MQTT or similar. Here we simulate.
        this.isSimulating = true;
        this.startSimulation();
    }

    subscribe(equipmentId, callback) {
        this.subscribers.push({ equipmentId, callback });
    }

    startSimulation() {
        setInterval(() => {
            if (!this.isSimulating) return;

            // Generate random updates for registered sensors
            this.sensors.forEach((sensor, id) => {
                const fluctuation = (Math.random() - 0.5) * 2; // -1 to 1
                let newValue = sensor.value + fluctuation;

                // Constraints based on type
                if (sensor.type === 'temp') {
                    // Keep between -25 and -15 for freezers, or 0-10 for fridges
                    // For demo, just drift around the initial value
                    if (Math.abs(newValue - sensor.targetValue) > 5) newValue = sensor.targetValue;
                }

                sensor.value = parseFloat(newValue.toFixed(1));
                sensor.history.push({ time: new Date(), value: sensor.value });
                if (sensor.history.length > 50) sensor.history.shift(); // Keep last 50 points

                // Notify subscribers
                this.notify(id, sensor.value);
            });
        }, 2000); // Update every 2s
    }

    notify(sensorId, value) {
        this.subscribers.forEach(sub => {
            if (sub.equipmentId === this.sensors.get(sensorId).equipmentId) {
                sub.callback(sensorId, value);
            }
        });
    }

    registerSensor(id, equipmentId, type, initialValue) {
        this.sensors.set(id, {
            equipmentId,
            type,
            value: initialValue,
            targetValue: initialValue,
            history: []
        });
    }

    getHistory(sensorId) {
        return this.sensors.get(sensorId)?.history || [];
    }
}

// Simple Canvas Gauge Renderer
export class GaugeRenderer {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.min = options.min || -30;
        this.max = options.max || 30;
        this.label = options.label || 'Temp';
        this.unit = options.unit || '°C';
    }

    draw(value) {
        if (!this.ctx) return;
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const cx = w / 2;
        const cy = h * 0.8;
        const radius = Math.min(w, h) * 0.7;

        // Clear
        ctx.clearRect(0, 0, w, h);

        // Background Arc
        ctx.beginPath();
        ctx.arc(cx, cy, radius, Math.PI, 2 * Math.PI); // Half circle top? No, gauges usually mimic speedometers
        // Let's do a 220 degree arc
        const startFn = Math.PI * 0.8;
        const endFn = Math.PI * 2.2;

        ctx.arc(cx, cy, radius, 0.8 * Math.PI, 2.2 * Math.PI);
        ctx.lineWidth = 15;
        ctx.strokeStyle = '#334155'; // Dark border
        ctx.stroke();

        // Color Zones (Simple)
        // We can draw colored segments on top

        // Value Arc
        // Map value to angle
        // Range = max - min
        // Angle Range = 2.2PI - 0.8PI = 1.4PI
        const range = this.max - this.min;
        const percent = Math.max(0, Math.min(1, (value - this.min) / range));
        const angle = 0.8 * Math.PI + (percent * 1.4 * Math.PI);

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0.8 * Math.PI, angle);

        // Color based on value logic (hardcoded for demo)
        let color = '#3b82f6'; // Blue
        if (value > -5 && value < 0) color = '#f59e0b'; // Warning
        if (value >= 0) color = '#ef4444'; // Danger (for a freezer)

        ctx.strokeStyle = color;
        ctx.stroke();

        // Text
        ctx.font = 'bold 24px Inter';
        ctx.fillStyle = '#f8fafc';
        ctx.textAlign = 'center';
        ctx.fillText(`${value}${this.unit}`, cx, cy - 10);

        ctx.font = '14px Inter';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(this.label, cx, cy + 20);
    }
}

// Simple Canvas Sparkline/Chart Renderer
export class ChartRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
    }

    draw(dataPoints) {
        if (!this.ctx || dataPoints.length < 2) return;
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const pad = 5;

        ctx.clearRect(0, 0, w, h);

        // Find min/max for scaling
        const values = dataPoints.map(d => d.value);
        let min = Math.min(...values);
        let max = Math.max(...values);

        // Add padding to range
        const range = max - min || 1;
        min -= range * 0.1;
        max += range * 0.1;

        ctx.beginPath();
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;

        const stepX = (w - pad * 2) / (dataPoints.length - 1);

        dataPoints.forEach((point, i) => {
            const x = pad + i * stepX;
            // Invert Y because canvas 0 is top
            const y = h - (pad + ((point.value - min) / (max - min)) * (h - pad * 2));

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        ctx.stroke();
    }
}

export const iotManager = new IOTManager();
