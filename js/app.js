/**
 * SMART MAINTENANCE APP - BUNDLED SCRIPT
 * Merged for local execution without server (file:// protocol compatibility)
 */

// ==========================================
// CONFIGURATION
// ==========================================
const SENSOR_CONFIG = {
    'temp': { label: 'Temperatura', unit: '°C', min: -30, max: 150, color: '#f97316' },
    'power': { label: 'Potência', unit: 'kW', min: 0, max: 100, color: '#ef4444' },
    'voltage': { label: 'Tensão', unit: 'V', min: 0, max: 400, color: '#eab308' }, // Yellow/Gold
    'rpm': { label: 'Rotação', unit: 'RPM', min: 0, max: 3500, color: '#3b82f6' },
    'current': { label: 'Corrente', unit: 'A', min: 0, max: 100, color: '#a855f7' } // Purple
};

// Global Alerts Store for Checklists (Persistent)
let CHECKLIST_ALERTS = JSON.parse(localStorage.getItem('checklist_alerts') || '[]');

// ==========================================
// 1. IOT MODULE (Simulated)
// ==========================================
class IOTManager {
    constructor() {
        this.sensors = new Map(); // id -> { equipmentId, type, value, topic, history: [] }
        this.subscribers = [];
        this.isSimulating = false;
        this.brokerConfig = {
            url: localStorage.getItem('mqtt_broker_url') || 'wss://broker.emqx.io:8084/mqtt',
            port: localStorage.getItem('mqtt_broker_port') || '8084',
            clientId: localStorage.getItem('mqtt_client_id') || `drivetech_${Math.random().toString(16).slice(2, 8)}`
        };
    }

    connect(config = {}) {
        this.brokerConfig = { ...this.brokerConfig, ...config };
        console.log(`[IOT] Connecting to broker at ${this.brokerConfig.url}...`);
        this.isSimulating = true;
        this.startSimulation();
    }

    subscribe(sensorId, callback) {
        this.subscribers.push({ sensorId, callback });
    }

    startSimulation() {
        if (this.simInterval) clearInterval(this.simInterval);
        this.simInterval = setInterval(() => {
            if (!this.isSimulating) return;

            this.sensors.forEach((sensor, id) => {
                const config = SENSOR_CONFIG[sensor.type] || SENSOR_CONFIG['temp'];
                const range = config.max - config.min;
                const fluctuation = (Math.random() - 0.5) * (range * 0.02);
                let newValue = sensor.value + fluctuation;

                newValue = Math.max(config.min, Math.min(config.max, newValue));
                sensor.value = parseFloat(newValue.toFixed(1));
                sensor.history.push({ time: new Date(), value: sensor.value });
                if (sensor.history.length > 50) sensor.history.shift();

                this.notify(id, sensor.value);
            });
        }, 2000);
    }

    notify(sensorId, value) {
        this.subscribers.forEach(sub => {
            if (sub.sensorId === sensorId) {
                sub.callback(sensorId, value);
            }
        });
    }

    registerSensor(id, equipmentId, type, initialValue, topic) {
        this.sensors.set(id, {
            equipmentId,
            type,
            topic: topic || `drivetech/equip/${equipmentId}/${type}`,
            value: initialValue || 0,
            history: [{ time: new Date(), value: initialValue || 0 }]
        });
    }

    getHistory(sensorId) {
        return this.sensors.get(sensorId)?.history || [];
    }

    getAllSensors() {
        return Array.from(this.sensors.entries()).map(([id, data]) => ({ id, ...data }));
    }
}

class GaugeRenderer {
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
        const cy = (h / 2) + 10; // Shift down slightly to make room for unit/label above

        ctx.clearRect(0, 0, w, h);

        let color = '#f97316';
        if (value > this.max * 0.9) color = '#ef4444';
        else if (value < this.min + (Math.abs(this.min) * 0.1)) color = '#f59e0b';
        else color = '#22c55e';

        // 1. UNIT (Top Right Corner)
        ctx.save();
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.fillStyle = '#dcc8bb';
        ctx.textAlign = 'right';
        ctx.fillText(this.unit, w - 10, 20);
        ctx.restore();

        // 2. BIG VALUE (Centered)
        const fontSize = Math.floor(h * 0.45); // Slightly smaller to ensure fit
        ctx.font = `bold ${fontSize}px "Orbitron", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.fillText(value, cx, cy);
        ctx.shadowBlur = 0;

        // 3. Small Label (Bottom)
        ctx.font = '10px Inter, sans-serif';
        ctx.fillStyle = '#dcc8bb';
        ctx.fillText(this.label, cx, h - 10);
    }
}

class ChartRenderer {
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

        const values = dataPoints.map(d => d.value);
        let min = Math.min(...values);
        let max = Math.max(...values);
        const range = max - min || 1;
        min -= range * 0.1;
        max += range * 0.1;

        ctx.beginPath();
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;

        const stepX = (w - pad * 2) / (dataPoints.length - 1);

        dataPoints.forEach((point, i) => {
            const x = pad + i * stepX;
            const y = h - (pad + ((point.value - min) / (max - min)) * (h - pad * 2));
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        ctx.stroke();
    }
}

const MOCK_MAINTENANCE_LOGS = [
    { id: '1', equipmentId: '1', description: 'Troca de óleo e filtros', date: '2025-12-15', cost: 450.00, company: 'TechFix Pro', nextDate: '2026-06-15' },
    { id: '2', equipmentId: '2', description: 'Ajuste de correias', date: '2026-01-05', cost: 120.00, company: 'Manutenge Express', nextDate: '2026-04-05' }
];

const iotManager = new IOTManager();


// ==========================================
// 2. CHECKLIST MODULE
class ChecklistManager {
    constructor() {
        this.activeChecklist = null;
        this.currentEquipment = null;
    }

    renderChecklist(equipment, container) {
        if (!equipment) return;

        this.currentEquipment = equipment;
        const items = equipment.inspectionItems ? equipment.inspectionItems.split(';').map(i => i.trim()).filter(i => i !== '') : [];

        if (items.length === 0) {
            container.innerHTML = `
                <div style="padding: 2rem; text-align: center;">
                    <p>Este equipamento não possui itens de inspeção cadastrados.</p>
                    <button class="btn btn-secondary" id="btn-back-no-items">Voltar</button>
                </div>
            `;
            setTimeout(() => {
                document.getElementById('btn-back-no-items')?.addEventListener('click', () => {
                    document.dispatchEvent(new CustomEvent('close-checklist'));
                });
            }, 0);
            return;
        }

        this.activeChecklist = items;

        let html = `
            <div class="checklist-execution" style="padding: 1rem; max-width: 800px; margin: 0 auto; text-align: left;">
                <div class="cl-header" style="margin-bottom: 2rem; border-bottom: 1px solid var(--border); padding-bottom: 1rem;">
                    <button class="btn btn-secondary" style="margin-bottom: 1rem;" id="btn-back-checklist"><i class="fa-solid fa-arrow-left"></i> Voltar</button>
                    <h2>Inspeção: ${equipment.name}</h2>
                    <p style="color: var(--text-secondary);">${equipment.model}</p>
                </div>
                <form id="checklist-form">
        `;

        items.forEach((item, index) => {
            html += `
                <div class="question-card" style="background: var(--bg-card); padding: 1.5rem; border-radius: 12px; margin-bottom: 1rem; border: 1px solid var(--border);">
                    <p class="question-text" style="font-weight: bold; margin-bottom: 1rem;">${item}</p>
                    <div class="options" style="display: flex; gap: 1rem;">
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="radio" name="q_${index}" value="yes" required style="width: 20px; height: 20px;">
                            <span style="color: var(--success); font-weight: bold;">Sim</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="radio" name="q_${index}" value="no" style="width: 20px; height: 20px;">
                            <span style="color: var(--danger); font-weight: bold;">Não</span>
                        </label>
                    </div>
                </div>
            `;
        });

        html += `
                <div class="form-actions" style="margin-top: 2rem;">
                    <button type="submit" class="btn btn-primary" style="width: 100%; padding: 1rem;">Finalizar e Salvar Checklist</button>
                </div>
                </form>
            </div>
        `;

        container.innerHTML = html;

        // Listeners for dynamic content MUST be attached after innerHTML set
        setTimeout(() => {
            document.getElementById('btn-back-checklist')?.addEventListener('click', () => {
                document.dispatchEvent(new CustomEvent('close-checklist'));
            });

            document.getElementById('checklist-form')?.addEventListener('submit', (e) => {
                e.preventDefault();
                this.processSubmission(new FormData(e.target), items);
            });
        }, 0);
    }

    async processSubmission(formData, items) {
        const issues = [];
        items.forEach((item, index) => {
            const answer = formData.get(`q_${index}`);
            if (answer === 'no') {
                issues.push({
                    equipment: this.currentEquipment.name,
                    item: item,
                    alert: `Falha na inspeção do item: ${item}`
                });
            }
        });

        if (issues.length > 0) {
            await this.createAlerts(issues);
            if (confirm(`⚠️ Atenção! Foram detectadas ${issues.length} não conformidades no(a) ${this.currentEquipment.name}.\n\nDeseja ir ao Dashboard para notificar o responsável via WhatsApp?`)) {
                // Return to dashboard
                document.dispatchEvent(new CustomEvent('close-checklist', { detail: { target: 'dashboard' } }));
                return;
            }
        } else {
            alert(`✅ Checklist do(a) ${this.currentEquipment.name} concluído com sucesso! Tudo em ordem.`);
        }
        document.dispatchEvent(new CustomEvent('close-checklist', { detail: { target: 'checklists' } }));
    }

    async createAlerts(issues) {
        issues.forEach(issue => {
            CHECKLIST_ALERTS.push({
                id: `check_${Date.now()}_${Math.random().toString(16).slice(2, 5)}`,
                name: issue.equipment,
                message: issue.alert,
                type: 'crit'
            });
        });
        localStorage.setItem('checklist_alerts', JSON.stringify(CHECKLIST_ALERTS));

        // Sync to Supabase if available
        if (window.SupaDB && window.SupaDB.client) {
            await window.SupaDB.settings.set('checklist_alerts', CHECKLIST_ALERTS);
        }

        alert(`🚨 SISTEMA: ${issues.length} não conformidade(s) registrada(s)!\n\nAs falhas foram enviadas para a Visão Geral (Dashboard).`);
    }
}
const checklistManager = new ChecklistManager();


// ==========================================
// 3. MAIN APP LOGIC
// ==========================================

// Data Store - Initially Mocks, then synced with Supabase
let MOCK_EQUIPMENTS = [
    {
        id: '1', name: 'Freezer Horizontal', brand: 'Consul', model: 'CHB42', status: 'Ativo',
        sensors: [
            { id: 's1_temp', type: 'temp', mqttId: 'FZ-01-T', topic: 'cafeteria/freezer/1/temp', initialValue: -18 }
        ],
        inspectionItems: 'Temperatura < 10°C; Portas vedando; Limpeza interna'
    },
    {
        id: '2', name: 'Máquina Espresso', brand: 'La Marzocco', model: 'Linea Mini', status: 'Manutenção',
        sensors: [
            { id: 's2_volt', type: 'voltage', mqttId: 'LM-02-V', topic: 'cafeteria/coffee/2/volt', initialValue: 220 },
            { id: 's2_temp', type: 'temp', mqttId: 'LM-02-T', topic: 'cafeteria/coffee/2/temp', initialValue: 92 }
        ],
        inspectionItems: 'Pressão 9 bar; Purga realizada; Moagem OK'
    },
    {
        id: '3', name: 'Fritadeira Elétrica', brand: 'Vulcan', model: 'LG300', status: 'Ativo',
        sensors: [
            { id: 's3_pwr', type: 'power', mqttId: 'FR-03-P', topic: 'cafeteria/fryer/3/pwr', initialValue: 4.5 }
        ],
        inspectionItems: 'Óleo limpo; Cesto íntegro; Resistência OK'
    }
];

document.addEventListener('DOMContentLoaded', () => {
    console.log('App Initialized (Bundled Mode)');

    // 1. Sync Data from Supabase (if available)
    const syncDataFromSupabase = async () => {
        if (!window.SupaDB || !window.SupaDB.client) {
            console.log('Supabase not configured, using mock data.');
            return;
        }

        try {
            const { data: equips, error: eqErr } = await window.SupaDB.equipments.list();
            if (eqErr) throw eqErr;

            const { data: allSensors, error: sErr } = await window.SupaDB.sensors.listAll();
            if (sErr) throw sErr;

            // Merge data
            MOCK_EQUIPMENTS = equips.map(eq => ({
                ...eq,
                sensors: allSensors.filter(s => s.equipment_id === eq.id).map(s => ({
                    id: s.id,
                    type: s.sensor_type,
                    mqttId: s.mqtt_id,
                    topic: s.topic,
                    initialValue: 0 // Will be updated by simulation
                }))
            }));

            console.log('Data synced from Supabase:', MOCK_EQUIPMENTS);

            // Sync checklist alerts
            const { data: storedAlerts } = await window.SupaDB.settings.get('checklist_alerts');
            if (storedAlerts && Array.isArray(storedAlerts)) {
                CHECKLIST_ALERTS = storedAlerts;
                localStorage.setItem('checklist_alerts', JSON.stringify(CHECKLIST_ALERTS));
            }

            initIOT();

            // Re-render current view if possible to show fresh data
            const currentViewHeader = mainContent.querySelector('.view-header h2, .dashboard-header h2')?.innerText;
            if (currentViewHeader === 'Equipamentos') renderEquipments();
            else if (currentViewHeader === 'Visão Geral') renderDashboard();
            else if (currentViewHeader === 'Monitoramento IOT') renderIOTMonitor();
        } catch (err) {
            console.error('Error syncing from Supabase:', err);
        }
    };

    // 2. Initialize IOT based on Equipments
    iotManager.connect();
    const initIOT = () => {
        iotManager.sensors.clear();
        MOCK_EQUIPMENTS.forEach(eq => {
            if (eq.sensors) {
                eq.sensors.forEach(s => {
                    iotManager.registerSensor(s.id, eq.id, s.type, s.initialValue, s.topic);
                });
            }
        });
    };

    // Perform initial sync
    syncDataFromSupabase();
    initIOT();

    // UI Elements
    const loginOverlay = document.getElementById('login-overlay');
    const mainContent = document.getElementById('view-container');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const toggleAuth = document.querySelectorAll('.toggle-auth');

    // Stable Equipment Modal Elements
    const equipModal = document.getElementById('equip-modal');
    const equipForm = document.getElementById('equip-form');
    const modalTitle = document.getElementById('modal-title');
    const btnCloseModal = document.getElementById('btn-close-modal');

    // Photo Elements
    const equipPhotoInput = document.getElementById('equip-photo');
    const photoPreviewContainer = document.getElementById('photo-preview');
    const imgPreview = document.getElementById('img-preview');
    const btnRemovePhoto = document.getElementById('btn-remove-photo');
    let currentPhotoBase64 = null;

    let isAuthenticated = false;

    // ... (Login Handlers kept concise) ...
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = loginForm.querySelector('button');
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const originalText = btn.innerText;

            if (!window.SupaDB || !window.SupaDB.client) {
                alert('Erro: Supabase não configurado corretamente.');
                return;
            }

            btn.innerText = 'Autenticando...';
            btn.disabled = true;

            try {
                const { data, error } = await window.SupaDB.client.auth.signInWithPassword({ email, password });
                if (error) throw error;

                isAuthenticated = true;
                loginOverlay.classList.add('hidden');

                // Fetch profiles for the name
                const profile = await window.SupaDB.getProfile(data.user.id);
                if (profile) document.getElementById('user-name').innerText = profile.full_name || email;

                await syncDataFromSupabase();
                loadView('dashboard');
            } catch (err) {
                alert('Erro no login: ' + err.message);
                console.error(err);
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = registerForm.querySelector('button');
            const name = document.getElementById('reg-name').value;
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;
            const role = document.getElementById('reg-role').value;
            const originalText = btn.innerText;

            btn.innerText = 'Cadastrando...';
            btn.disabled = true;

            try {
                const { data, error } = await window.SupaDB.client.auth.signUp({
                    email,
                    password,
                    options: { data: { full_name: name, role: role } }
                });
                if (error) throw error;

                alert('Cadastro realizado! Verifique seu email ou tente fazer login.');
                loginForm.classList.remove('hidden');
                registerForm.classList.add('hidden');
            } catch (err) {
                alert('Erro no cadastro: ' + err.message);
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        });
    }

    // Photo Handling logic
    equipPhotoInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                currentPhotoBase64 = event.target.result;
                imgPreview.src = currentPhotoBase64;
                photoPreviewContainer.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }
    });

    btnRemovePhoto?.addEventListener('click', () => {
        currentPhotoBase64 = null;
        equipPhotoInput.value = '';
        photoPreviewContainer.classList.add('hidden');
        imgPreview.src = '';
    });

    // Modal Lifecycle
    const openEquipModal = (mode, id = null) => {
        if (!equipModal || !equipForm) return;
        equipForm.reset();
        document.getElementById('edit-id').value = id || '';
        currentPhotoBase64 = null;
        if (photoPreviewContainer) photoPreviewContainer.classList.add('hidden');
        if (imgPreview) imgPreview.src = '';

        const sensorContainer = document.getElementById('sensor-list-container');
        if (sensorContainer) sensorContainer.innerHTML = '';

        const addSensorRow = (data = {}) => {
            const row = document.createElement('div');
            row.className = 'sensor-row';
            row.style = 'display: grid; grid-template-columns: 1fr 1fr 1fr 30px; gap: 0.5rem; align-items: end; background: rgba(255,255,255,0.05); padding: 0.5rem; border-radius: 6px;';
            row.innerHTML = `
                <div class="input-group" style="margin:0;">
                    <label style="font-size:0.7rem;">Tipo</label>
                    <select class="sensor-type" style="padding: 4px; font-size: 0.8rem; height: 32px;">
                        <option value="temp" ${data.type === 'temp' ? 'selected' : ''}>Temp</option>
                        <option value="voltage" ${data.type === 'voltage' ? 'selected' : ''}>Tensão</option>
                        <option value="power" ${data.type === 'power' ? 'selected' : ''}>Potência</option>
                        <option value="rpm" ${data.type === 'rpm' ? 'selected' : ''}>RPM</option>
                        <option value="current" ${data.type === 'current' ? 'selected' : ''}>Corrente</option>
                    </select>
                </div>
                <div class="input-group" style="margin:0;">
                    <label style="font-size:0.7rem;">MQTT ID</label>
                    <input type="text" class="sensor-mqtt-id" value="${data.mqttId || ''}" placeholder="Ex: S-01" style="padding: 4px; font-size: 0.8rem; height: 32px;">
                </div>
                <div class="input-group" style="margin:0;">
                    <label style="font-size:0.7rem;">Tópico</label>
                    <input type="text" class="sensor-topic" value="${data.topic || ''}" placeholder="equip/1/temp" style="padding: 4px; font-size: 0.8rem; height: 32px;">
                </div>
                <button type="button" class="btn-remove-sensor" style="height:32px; background:none; border:none; color:#ef4444; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
            `;
            row.querySelector('.btn-remove-sensor').onclick = () => row.remove();
            sensorContainer.appendChild(row);
        };

        const btnAddSensor = document.getElementById('btn-add-sensor-row');
        if (btnAddSensor) {
            btnAddSensor.onclick = (e) => {
                e.preventDefault();
                addSensorRow();
            };
        }

        if (mode === 'edit' && id) {
            const eq = MOCK_EQUIPMENTS.find(e => e.id === id);
            if (eq) {
                modalTitle.innerText = 'Editar Equipamento';
                equipForm.name.value = eq.name;
                equipForm.model.value = eq.model;
                equipForm.status.value = eq.status;
                equipForm.inspectionItems.value = eq.inspectionItems || '';

                if (eq.sensors) {
                    eq.sensors.forEach(s => addSensorRow(s));
                }

                if (eq.photo) {
                    currentPhotoBase64 = eq.photo;
                    imgPreview.src = eq.photo;
                    photoPreviewContainer.classList.remove('hidden');
                }
            }
        } else {
            modalTitle.innerText = 'Novo Equipamento';
            addSensorRow(); // Add one row by default for new equipment
        }
        equipModal.classList.remove('hidden');
    };

    const closeEquipModal = () => equipModal?.classList.add('hidden');

    if (btnCloseModal) btnCloseModal.addEventListener('click', closeEquipModal);

    if (equipForm) {
        equipForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(equipForm);
            const id = fd.get('id');

            // Collect Sensors
            const sensorRows = document.querySelectorAll('.sensor-row');
            const sensors = Array.from(sensorRows).map(row => ({
                id: `s_${Math.random().toString(16).slice(2, 8)}`,
                type: row.querySelector('.sensor-type').value,
                mqttId: row.querySelector('.sensor-mqtt-id').value,
                topic: row.querySelector('.sensor-topic').value,
                initialValue: SENSOR_CONFIG[row.querySelector('.sensor-type').value]?.min || 0
            }));

            const equipData = {
                name: fd.get('name'),
                model: fd.get('model'),
                status: fd.get('status'),
                inspection_items: fd.get('inspectionItems'),
                photo: currentPhotoBase64,
                brand: 'Genérica'
            };

            const useSupa = window.SupaDB && window.SupaDB.client;

            if (id) {
                // Edit
                if (useSupa) {
                    try {
                        await window.SupaDB.equipments.update(id, equipData);
                        await window.SupaDB.sensors.deleteByEq(id);
                        for (const s of sensors) {
                            await window.SupaDB.sensors.create({
                                equipment_id: id,
                                sensor_type: s.type,
                                mqtt_id: s.mqttId,
                                topic: s.topic
                            });
                        }
                    } catch (err) { console.error('Supabase update error:', err); }
                }

                const idx = MOCK_EQUIPMENTS.findIndex(e => e.id === id);
                if (idx !== -1) {
                    MOCK_EQUIPMENTS[idx] = { ...MOCK_EQUIPMENTS[idx], ...equipData, sensors, inspectionItems: equipData.inspection_items };
                }
            } else {
                // Add
                let newId = String(Date.now());
                if (useSupa) {
                    try {
                        const { data, error } = await window.SupaDB.equipments.create(equipData).select().single();
                        if (error) throw error;
                        if (data) {
                            newId = data.id;
                            for (const s of sensors) {
                                const { error: sErr } = await window.SupaDB.sensors.create({
                                    equipment_id: newId,
                                    sensor_type: s.type,
                                    mqtt_id: s.mqttId,
                                    topic: s.topic
                                });
                                if (sErr) throw sErr;
                            }
                        }
                    } catch (err) {
                        alert('Erro ao salvar no Supabase: ' + err.message);
                        console.error('Supabase insert error:', err);
                        return; // Stop execution, don't show success
                    }
                }

                const newEq = { id: newId, ...equipData, sensors, inspectionItems: equipData.inspection_items };
                MOCK_EQUIPMENTS.push(newEq);
            }

            initIOT();
            closeEquipModal();
            renderEquipments();
            alert('Dados salvos com sucesso!');
        });
    }

    const deleteEquipment = async (id) => {
        if (confirm('Tem certeza que deseja excluir este equipamento?')) {
            if (window.SupaDB && window.SupaDB.client) {
                try {
                    await window.SupaDB.equipments.delete(id);
                } catch (err) { console.error('Supabase delete error:', err); }
            }

            const idx = MOCK_EQUIPMENTS.findIndex(e => e.id === id);
            if (idx !== -1) {
                MOCK_EQUIPMENTS.splice(idx, 1);
                // Clean up IOT Manager
                initIOT();
                renderEquipments();
            }
        }
    };

    // Navigation
    const navLinks = document.querySelectorAll('.sidebar li');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            const target = link.getAttribute('data-target');
            if (link.id === 'logout-btn') { isAuthenticated = false; loginOverlay.classList.remove('hidden'); return; }
            if (target) {
                document.querySelectorAll('.sidebar li').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                loadView(target);
            }
        });
    });

    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    if (sidebarToggle) sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('open'));

    toggleAuth.forEach(btn => btn.addEventListener('click', () => { loginForm.classList.toggle('hidden'); registerForm.classList.toggle('hidden'); }));
    document.addEventListener('close-checklist', (e) => loadView(e.detail?.target || 'checklists'));

    /* View Rendering */
    async function loadView(viewName) {
        mainContent.innerHTML = `<div class="loading-spinner">Carregando...</div>`;
        // Small delay to allow CSS transitions
        await new Promise(r => setTimeout(r, 150));

        switch (viewName) {
            case 'dashboard': await renderDashboard(); break;
            case 'equipments': await renderEquipments(); break;
            case 'iot-monitor': await renderIOTMonitor(); break;
            case 'checklists': await renderChecklists(); break;
            case 'maintenance': await renderMaintenance(); break;
            case 'help': await renderHelp(); break;
            case 'settings': await renderSettings(); break;
            case 'reports': await renderReports(); break;
            default: await renderDashboard();
        }
    }

    async function renderSettings() {
        const isLight = document.body.classList.contains('light-mode');

        // Fetch from Supabase with localStorage as fallback
        let phone = localStorage.getItem('alert_phone') || '';
        let mqttUrl = localStorage.getItem('mqtt_broker_url') || 'wss://broker.emqx.io:8084/mqtt';
        let mqttPort = localStorage.getItem('mqtt_broker_port') || '8084';
        let mqttClientId = localStorage.getItem('mqtt_client_id') || iotManager.brokerConfig.clientId;

        if (window.SupaDB && window.SupaDB.client) {
            try {
                const { data: p } = await window.SupaDB.settings.get('alert_phone');
                if (p) phone = p.value;
                const { data: m } = await window.SupaDB.settings.get('mqtt_config');
                if (m) {
                    mqttUrl = m.value.url;
                    mqttPort = m.value.port;
                    mqttClientId = m.value.clientId;
                }
            } catch (err) { console.warn('Supabase settings fetch error:', err); }
        }

        mainContent.innerHTML = `
            <div class="view-header"><h2>Configurações</h2></div>
            <div class="card-list" style="max-width: 800px; margin: 0 auto;">
                <div class="card" style="padding: 1.5rem; background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border); margin-bottom: 1rem;">
                    <h3><i class="fa-solid fa-palette"></i> Temas</h3>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top:1rem;">
                        <span>Modo Escuro</span>
                        <label class="switch"><input type="checkbox" id="theme-toggle" ${!isLight ? 'checked' : ''}><span class="slider round"></span></label>
                    </div>
                </div>
                <div class="card" style="padding: 1.5rem; background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border); margin-bottom: 1rem;">
                    <h3><i class="fa-brands fa-whatsapp"></i> Alertas</h3>
                    <div style="margin-top:1rem;">
                        <input type="text" id="alert-phone" class="input-light" value="${phone}" placeholder="Ex: 5511999999999" style="width: 100%; padding: 0.8rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-dark); color: var(--text-primary);">
                        <button class="btn btn-primary" id="btn-save-phone" style="width: 100%; margin-top: 0.5rem;">Salvar Telefone</button>
                    </div>
                </div>
                <div class="card" style="padding: 1.5rem; background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border);">
                    <h3><i class="fa-solid fa-server"></i> Broker MQTT</h3>
                    <div style="display: grid; grid-template-columns: 1fr 100px; gap: 0.5rem; margin-top:1rem;">
                        <input type="text" id="mqtt-url" value="${mqttUrl}" placeholder="URL Broker" style="padding: 0.8rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-dark); color: var(--text-primary);">
                        <input type="text" id="mqtt-port" value="${mqttPort}" placeholder="Porta" style="padding: 0.8rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-dark); color: var(--text-primary);">
                    </div>
                    <input type="text" id="mqtt-client-id" value="${mqttClientId}" placeholder="Client ID" style="width: 100%; margin-top: 0.5rem; padding: 0.8rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-dark); color: var(--text-primary);">
                    <button class="btn btn-primary" id="btn-save-mqtt" style="width: 100%; margin-top: 0.5rem;">Salvar Rede MQTT</button>
                </div>
                <div class="card" style="padding: 1.5rem; background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border); margin-top: 2rem; border-color: var(--danger);">
                    <h3 style="color: var(--danger);"><i class="fa-solid fa-trash-can"></i> Zona de Perigo</h3>
                    <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0.5rem 0;">Se os alertas não estiverem aparecendo, use o botão abaixo para limpar o cache local.</p>
                    <button class="btn btn-danger" id="btn-reset-app" style="width: 100%; background: #ef4444; color: white; border: none; padding: 0.8rem; border-radius: 8px; cursor: pointer; font-weight: bold;">Limpar Cache e Alertas</button>
                </div>
            </div>`;

        document.getElementById('btn-reset-app')?.addEventListener('click', () => {
            if (confirm('Isso limpará todos os alertas locais e configurações. Deseja continuar?')) {
                localStorage.clear();
                window.location.reload();
            }
        });

        document.getElementById('theme-toggle')?.addEventListener('change', (e) => {
            if (!e.target.checked) document.body.classList.add('light-mode');
            else document.body.classList.remove('light-mode');
        });

        document.getElementById('btn-save-phone')?.addEventListener('click', async () => {
            const val = document.getElementById('alert-phone').value;
            localStorage.setItem('alert_phone', val);
            if (window.SupaDB && window.SupaDB.client) {
                await window.SupaDB.settings.set('alert_phone', val);
            }
            alert('Telefone salvo!');
        });

        document.getElementById('btn-save-mqtt')?.addEventListener('click', async () => {
            const url = document.getElementById('mqtt-url').value;
            const port = document.getElementById('mqtt-port').value;
            const cid = document.getElementById('mqtt-client-id').value;
            localStorage.setItem('mqtt_broker_url', url);
            localStorage.setItem('mqtt_broker_port', port);
            localStorage.setItem('mqtt_client_id', cid);

            if (window.SupaDB && window.SupaDB.client) {
                await window.SupaDB.settings.set('mqtt_config', { url, port, clientId: cid });
            }

            iotManager.connect({ url, port, clientId: cid });
            alert('Configuração MQTT aplicada!');
        });
    }

    async function renderDashboard() {
        // Force sync from localStorage at every render to avoid stale data
        const stored = localStorage.getItem('checklist_alerts');
        CHECKLIST_ALERTS = JSON.parse(stored || '[]');
        console.log('Rendering Dashboard. Local Alerts:', CHECKLIST_ALERTS.length);

        // Collect active alerts from sensors
        const alerts = [...CHECKLIST_ALERTS];
        iotManager.sensors.forEach((sensor, id) => {
            const config = SENSOR_CONFIG[sensor.type] || SENSOR_CONFIG['temp'];
            // Use loose equality in case IDs are mixed string/number from Supabase
            const eq = MOCK_EQUIPMENTS.find(e => String(e.id) === String(sensor.equipmentId));
            const name = eq ? eq.name : 'Equipamento';

            // Alerts should show if value is > 90% of max OR < 10% above min
            if (sensor.value > config.max * 0.9) {
                alerts.push({ id, name, message: `Valor crítico: ${sensor.value}${config.unit}`, type: 'crit', value: sensor.value, unit: config.unit });
            } else if (sensor.value < config.min + (Math.abs(config.min) * 0.1)) {
                alerts.push({ id, name, message: `Valor baixo: ${sensor.value}${config.unit}`, type: 'low', value: sensor.value, unit: config.unit });
            }
        });

        let alertsHtml = '';
        if (alerts.length > 0) {
            alertsHtml = alerts.map(a => {
                const isChecklistAlert = String(a.id).startsWith('check_');

                // Comprehensive escaping for safety in innerHTML and data attributes
                const nameStr = String(a.name || 'Equipamento');
                const msgStr = String(a.message || '');
                const safeName = nameStr.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                const safeMsg = msgStr.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

                return `
                <div class="list-item alert-item" style="border-left: 4px solid #ef4444; margin-bottom: 0.5rem; padding: 0.8rem; display: flex; justify-content: space-between; align-items: center; background: rgba(239, 68, 68, 0.05); border-radius: 0 8px 8px 0; gap: 10px;">
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: bold; color: #ef4444; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${safeName}</div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">${safeMsg}</div>
                    </div>
                    <div style="display: flex; gap: 8px; flex-shrink: 0; align-items: center;">
                        ${isChecklistAlert ? `<button class="btn btn-sm btn-resolve" data-id="${a.id}" style="background: #64748b; color: white; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; display: flex; align-items: center;" title="Resolver Alerta"><i class="fa-solid fa-check"></i></button>` : ''}
                        <button class="btn btn-sm btn-whatsapp" data-name="${safeName}" data-msg="${safeMsg}" style="background: #25d366 !important; color: white !important; border: none !important; padding: 8px 12px !important; border-radius: 6px !important; cursor: pointer !important; display: flex !important; align-items: center !important; gap: 5px !important; white-space: nowrap !important; font-weight: 700 !important; font-size: 0.85rem !important; box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;">
                            <i class="fa-brands fa-whatsapp"></i> Notificar
                        </button>
                    </div>
                </div>
            `;
            }).join('');
        } else {
            alertsHtml = '<p style="color: var(--text-secondary); font-size: 0.9rem;">Nenhum alerta ativo no momento.</p>';
        }

        mainContent.innerHTML = `
            <div class="dashboard-header">
                <h2>Visão Geral</h2>
                <div class="date-display">${new Date().toLocaleDateString('pt-BR')}</div>
            </div>
            <div class="dashboard-grid">
                <div class="stat-card alert" style="flex-direction: column; align-items: flex-start; gap: 1rem; grid-column: span 2;">
                    <div class="stat-info" style="width: 100%; display: flex; justify-content: space-between; align-items: center;">
                        <h3>Alertas Ativos</h3>
                        <div class="value" style="font-size: 1.2rem; background: #ef4444; color: white; padding: 2px 10px; border-radius: 12px;">${alerts.length}</div>
                    </div>
                    <div class="alert-details-list" style="width: 100%;">
                        ${alertsHtml}
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-info">
                        <h3>Equipamentos</h3>
                        <div class="value">${MOCK_EQUIPMENTS.length}</div>
                    </div>
                    <div class="stat-icon"><i class="fa-solid fa-industry"></i></div>
                </div>
            </div>`;

        setTimeout(() => {
            document.querySelectorAll('.btn-whatsapp').forEach(btn => {
                btn.addEventListener('click', () => {
                    const phone = localStorage.getItem('alert_phone') || localStorage.getItem('mqtt_alert_phone'); // check both fallbacks
                    if (!phone) {
                        alert('Por favor, cadastre um telefone nas Configurações primeiro!');
                        loadView('settings');
                        return;
                    }
                    const name = btn.getAttribute('data-name');
                    const msg = btn.getAttribute('data-msg');
                    const text = encodeURIComponent(`*[ALERTA MANUTENÇÃO]*\n\n🚨 *Equipamento:* ${name}\n⚠️ *Detalhe:* ${msg}\n🕒 *Horário:* ${new Date().toLocaleTimeString('pt-BR')}\n\n_Favor verificar imediatamente._`);
                    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
                });
            });

            document.querySelectorAll('.btn-resolve').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-id');
                    CHECKLIST_ALERTS = CHECKLIST_ALERTS.filter(a => a.id !== id);
                    localStorage.setItem('checklist_alerts', JSON.stringify(CHECKLIST_ALERTS));

                    // Sync to Supabase if available
                    if (window.SupaDB && window.SupaDB.client) {
                        await window.SupaDB.settings.set('checklist_alerts', CHECKLIST_ALERTS);
                    }

                    renderDashboard();
                });
            });
        }, 0);
    }

    function renderEquipments() {
        let html = `
            <div class="view-header">
                <h2>Equipamentos</h2>
                <button class="btn btn-primary" id="btn-add-equip-trigger">Novo Equipamento</button>
            </div>
            <div class="equipment-grid">
        `;

        MOCK_EQUIPMENTS.forEach(eq => {
            const config = SENSOR_CONFIG[eq.sensorType] || SENSOR_CONFIG['temp'];
            html += `
                <div class="equipment-card">
                    ${eq.photo ? `<img src="${eq.photo}" class="equipment-card-photo" alt="${eq.name}">` : `<div class="equip-icon"><i class="fa-solid fa-industry"></i></div>`}
                    <div class="equip-info">
                        <h3>${eq.name}</h3><p>${eq.model}</p>
                        <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:0.2rem;">Sensor: ${config.label}</div>
                        <span class="status-badge ${eq.status === 'Ativo' ? 'active' : 'maintenance'}">${eq.status}</span>
                    </div>
                    <div class="equip-actions" style="margin-top: auto; display: flex; gap: 0.5rem; padding-top: 1rem;">
                        <button class="btn btn-sm btn-edit" data-id="${eq.id}" style="flex:1; background: #3b82f6; color: white; border:none; padding: 4px; border-radius:4px; font-size:0.7rem;"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-sm btn-delete" data-id="${eq.id}" style="flex:1; background: #ef4444; color: white; border:none; padding: 4px; border-radius:4px; font-size:0.7rem;"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>`;
        });
        html += `</div>`;
        mainContent.innerHTML = html;

        // Trigger logic
        setTimeout(() => {
            document.getElementById('btn-add-equip-trigger')?.addEventListener('click', () => openEquipModal('add'));
            document.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', () => openEquipModal('edit', btn.getAttribute('data-id'))));
            document.querySelectorAll('.btn-delete').forEach(btn => btn.addEventListener('click', () => deleteEquipment(btn.getAttribute('data-id'))));
        }, 0);
    }

    function renderIOTMonitor() {
        mainContent.innerHTML = `<div class="view-header" style="padding: 0 2rem;"><h2>Monitoramento IOT</h2></div><div class="iot-grid" style="padding: 0 2rem;"></div>`;
        const grid = mainContent.querySelector('.iot-grid');
        const allSensors = iotManager.getAllSensors();

        if (allSensors.length === 0) {
            grid.innerHTML = '<p>Nenhum sensor ativo no momento.</p>';
            return;
        }

        const eqGroups = {};
        allSensors.forEach(s => {
            if (!eqGroups[s.equipmentId]) eqGroups[s.equipmentId] = [];
            eqGroups[s.equipmentId].push(s);
        });

        const renderers = [];

        Object.keys(eqGroups).forEach(eqId => {
            const eq = MOCK_EQUIPMENTS.find(e => e.id === eqId);
            const eqName = eq ? eq.name : 'Equipamento';
            const sensors = eqGroups[eqId];

            const eqCard = document.createElement('div');
            eqCard.className = 'card';
            eqCard.style = 'margin-bottom: 2rem; padding: 1.5rem; background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border);';
            eqCard.innerHTML = `<h3 style="margin-bottom: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;"><i class="fa-solid fa-industry"></i> ${eqName}</h3>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;"></div>`;
            const sensorGrid = eqCard.querySelector('div');

            sensors.forEach(s => {
                const config = SENSOR_CONFIG[s.type] || SENSOR_CONFIG['temp'];
                const panel = document.createElement('div');
                panel.className = 'iot-panel';
                panel.style = 'background: var(--bg-dark); padding: 1rem; border-radius: 8px; border: 1px solid var(--border); text-align: center;';
                panel.innerHTML = `
                <div style="font-size: 0.75rem; color: var(--primary); font-weight: bold; margin-bottom: 0.5rem;">${config.label}</div>
                <div class="gauge-container"><canvas id="gauge-${s.id}" width="180" height="120"></canvas></div>
                <div style="font-size: 0.6rem; color: var(--text-secondary); margin-bottom: 0.5rem; font-family: monospace;">${s.topic}</div>
                <div class="chart-container"><canvas id="chart-${s.id}" width="210" height="70"></canvas></div>
            `;
                sensorGrid.appendChild(panel);
                renderers.push({ id: s.id, type: s.type, config });
            });
            grid.appendChild(eqCard);
        });

        requestAnimationFrame(() => {
            iotManager.subscribers = [];
            renderers.forEach(r => {
                const g = new GaugeRenderer(`gauge-${r.id}`, { min: r.config.min, max: r.config.max, unit: r.config.unit, label: r.config.label });
                const c = new ChartRenderer(`chart-${r.id}`);
                const currentS = iotManager.sensors.get(r.id);
                if (currentS) {
                    g.draw(currentS.value);
                    c.draw(currentS.history);
                }
                iotManager.subscribe(r.id, (id, val) => {
                    g.draw(val);
                    c.draw(iotManager.getHistory(id));
                });
            });
        });
    }

    function renderChecklists() {
        let optionsHtml = MOCK_EQUIPMENTS.map(eq => `<option value="${eq.id}">${eq.name} - ${eq.model}</option>`).join('');

        mainContent.innerHTML = `
            <div class="view-header"><h2>Checklists de Inspeção</h2></div>
            <div class="card" style="padding: 2rem; max-width: 600px; margin: 0 auto; background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border); text-align: left;">
                <h3 style="margin-bottom: 1.5rem; color: var(--text-primary);"><i class="fa-solid fa-clipboard-check"></i> Iniciar Nova Vistoria</h3>
                <p style="margin-bottom: 0.5rem; color: var(--text-secondary);">Selecione o equipamento que deseja inspecionar agora:</p>
                
                <div class="form-group" style="margin-bottom: 1.5rem;">
                    <select id="select-equipment-checklist" style="width: 100%; padding: 1rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-dark); color: var(--text-primary); font-size: 1rem;">
                        <option value="">-- Selecione um Equipamento --</option>
                        ${optionsHtml}
                    </select>
                </div>
                
                <button id="btn-start-checklist" class="btn btn-primary" style="width: 100%; padding: 1rem; font-weight: bold;">
                    Começar Inspeção
                </button>
            </div>
        `;

        document.getElementById('btn-start-checklist').addEventListener('click', () => {
            const select = document.getElementById('select-equipment-checklist');
            const eqId = select.value;
            if (!eqId) {
                alert('Por favor, selecione um equipamento primeiro.');
                return;
            }
            const eq = MOCK_EQUIPMENTS.find(e => e.id === eqId);
            checklistManager.renderChecklist(eq, mainContent);
        });
    }

    function renderMaintenance() {
        let optionsHtml = MOCK_EQUIPMENTS.map(eq => `<option value="${eq.id}">${eq.name}</option>`).join('');

        mainContent.innerHTML = `
            <div class="view-header" style="padding: 0 2rem; max-width: 900px;">
                <h2>Log de Manutenções</h2>
                <button class="btn btn-primary" id="btn-new-maintenance"><i class="fa-solid fa-plus"></i> Registrar Manutenção</button>
            </div>
            
            <div id="maintenance-form-container" class="card hidden" style="margin: 0 2rem 2rem 2rem; padding: 1.5rem; background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; max-width: 836px;">
                <h3 style="margin-bottom: 1.5rem;">Nova Entrada de Manutenção</h3>
                <form id="maintenance-form" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group" style="grid-column: span 2;">
                        <label>Equipamento</label>
                        <select name="equipmentId" required style="width: 100%; padding: 0.8rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-dark); color: var(--text-primary);">
                            ${optionsHtml}
                        </select>
                    </div>
                    <div class="form-group" style="grid-column: span 2;">
                        <label>Descrição do Serviço</label>
                        <textarea name="description" required placeholder="Ex: Troca de rolamentos e lubrificação" style="width: 100%; padding: 0.8rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-dark); color: var(--text-primary); min-height: 80px;"></textarea>
                    </div>
                    <div class="form-group">
                        <label>Data da Realização</label>
                        <input type="date" name="date" required style="width: 100%; padding: 0.8rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-dark); color: var(--text-primary);">
                    </div>
                    <div class="form-group">
                        <label>Custo (R$)</label>
                        <input type="number" step="0.01" name="cost" required placeholder="0,00" style="width: 100%; padding: 0.8rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-dark); color: var(--text-primary);">
                    </div>
                    <div class="form-group">
                        <label>Empresa Executora</label>
                        <input type="text" name="company" required placeholder="Nome da empresa" style="width: 100%; padding: 0.8rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-dark); color: var(--text-primary);">
                    </div>
                    <div class="form-group">
                        <label>Próxima Revisão</label>
                        <input type="date" name="nextDate" required style="width: 100%; padding: 0.8rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-dark); color: var(--text-primary);">
                    </div>
                    <div style="grid-column: span 2; display: flex; gap: 1rem; margin-top: 1rem;">
                        <button type="submit" class="btn btn-primary" style="flex: 1;">Salvar Registro</button>
                        <button type="button" id="btn-cancel-maintenance" class="btn btn-secondary" style="flex: 1;">Cancelar</button>
                    </div>
                </form>
            </div>

            <div class="maintenance-history" style="padding: 0 2rem; max-width: 900px; text-align: left;">
                <h3 style="margin-bottom: 1rem; color: var(--text-secondary);">Histórico Recente</h3>
                <div id="maintenance-list" class="card-list">
                    <!-- Logs will be injected here -->
                </div>
            </div>
        `;

        const renderLogs = () => {
            const list = document.getElementById('maintenance-list');
            if (!list) return;

            if (MOCK_MAINTENANCE_LOGS.length === 0) {
                list.innerHTML = '<p style="padding: 2rem; text-align: center; color: var(--text-secondary);">Nenhuma manutenção registrada.</p>';
                return;
            }

            list.innerHTML = MOCK_MAINTENANCE_LOGS.sort((a, b) => new Date(b.date) - new Date(a.date)).map(log => {
                const eq = MOCK_EQUIPMENTS.find(e => e.id === log.equipmentId);
                return `
                    <div class="list-item" style="display: flex; flex-direction: column; gap: 0.8rem; padding: 1.5rem; background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 1rem; text-align: left;">
                        <div style="border-bottom: 1px solid var(--border); padding-bottom: 0.8rem; margin-bottom: 0.2rem;">
                            <span style="font-size: 0.75rem; color: var(--primary); font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">${eq ? eq.name : 'Equipamento'}</span>
                            <h4 style="margin: 0.3rem 0; font-size: 1.1rem; color: var(--text-primary);">${log.description}</h4>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; font-size: 0.9rem; color: var(--text-secondary);">
                            <div>
                                <i class="fa-solid fa-calendar-day" style="width: 20px; color: var(--primary);"></i> 
                                <strong>Realizado em:</strong> ${new Date(log.date).toLocaleDateString('pt-BR')}
                            </div>
                            <div>
                                <i class="fa-solid fa-money-bill-wave" style="width: 20px; color: var(--danger);"></i> 
                                <strong>Custo:</strong> <span style="color: var(--danger); font-weight: bold;">R$ ${parseFloat(log.cost).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div>
                                <i class="fa-solid fa-building" style="width: 20px; color: var(--primary);"></i> 
                                <strong>Empresa:</strong> ${log.company}
                            </div>
                            <div>
                                <i class="fa-solid fa-calendar-check" style="width: 20px; color: var(--warning);"></i> 
                                <strong>Próx. Revisão:</strong> ${new Date(log.nextDate).toLocaleDateString('pt-BR')}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        };

        renderLogs();

        // Event Handlers
        const formContainer = document.getElementById('maintenance-form-container');
        const form = document.getElementById('maintenance-form');

        document.getElementById('btn-new-maintenance')?.addEventListener('click', () => {
            formContainer.classList.remove('hidden');
        });

        document.getElementById('btn-cancel-maintenance')?.addEventListener('click', () => {
            formContainer.classList.add('hidden');
            form.reset();
        });

        form?.addEventListener('submit', (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            const newLog = {
                id: String(Date.now()),
                equipmentId: fd.get('equipmentId'),
                description: fd.get('description'),
                date: fd.get('date'),
                cost: fd.get('cost'),
                company: fd.get('company'),
                nextDate: fd.get('nextDate')
            };
            MOCK_MAINTENANCE_LOGS.push(newLog);
            formContainer.classList.add('hidden');
            form.reset();
            renderLogs();
            alert('Manutenção registrada com sucesso!');
        });
    }

    function renderReports() {
        mainContent.innerHTML = `
            <div class="view-header" style="padding: 0 2rem; max-width: 900px;">
                <h2>Relatórios</h2>
                <button class="btn btn-primary" id="btn-export-pdf"><i class="fa-solid fa-file-pdf"></i> Exportar Geral</button>
            </div>
            <div class="reports-container" style="padding: 1rem 2rem; max-width: 900px; text-align: left;">
                <p style="margin-bottom: 1.5rem; color: var(--text-secondary);">Acesse e baixe os documentos técnicos consolidados da sua operação.</p>
                <div class="card-list">
                    <div class="list-item" style="display: flex; justify-content: space-between; align-items: center; padding: 1.5rem; background: var(--bg-card); border-radius: 12px; margin-bottom: 1rem; border: 1px solid var(--border);">
                        <div>
                            <div style="font-weight: bold; font-size: 1.1rem; color: var(--text-primary); margin-bottom: 0.2rem;">Inventário de Equipamentos</div>
                            <div style="font-size: 0.85rem; color: var(--text-secondary);"><i class="fa-solid fa-industry"></i> Lista consolidada e status</div>
                        </div>
                        <button class="btn btn-sm btn-secondary btn-download-report" data-type="inventory" style="padding: 0.6rem 1.2rem; border-radius: 8px;">Gerar</button>
                    </div>
                    <div class="list-item" style="display: flex; justify-content: space-between; align-items: center; padding: 1.5rem; background: var(--bg-card); border-radius: 12px; margin-bottom: 1rem; border: 1px solid var(--border);">
                        <div>
                            <div style="font-weight: bold; font-size: 1.1rem; color: var(--text-primary); margin-bottom: 0.2rem;">Histórico de Manutenções</div>
                            <div style="font-size: 0.85rem; color: var(--text-secondary);"><i class="fa-solid fa-hammer"></i> Registros técnicos de reparos</div>
                        </div>
                        <button class="btn btn-sm btn-secondary btn-download-report" data-type="maintenance" style="padding: 0.6rem 1.2rem; border-radius: 8px;">Gerar</button>
                    </div>
                </div>
            </div>
        `;

        const generatePDF = (type) => {
            const printArea = document.getElementById('print-report-area');
            let content = '';
            const today = new Date().toLocaleDateString('pt-BR');

            if (type === 'inventory' || type === 'full') {
                content += `
                    <div class="report-header">
                        <h1 style="margin:0;">RELATÓRIO DE INVENTÁRIO TÉCNICO</h1>
                        <p style="margin:5px 0;">Emissão: ${today} | Sistema: Smart Maintenance</p>
                    </div>
                    <h3>Lista de Ativos</h3>
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th>Equipamento</th>
                                <th>Modelo</th>
                                <th>Marca</th>
                                <th>Status</th>
                                <th>Sensores</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${MOCK_EQUIPMENTS.map(eq => `
                                <tr>
                                    <td>${eq.name}</td>
                                    <td>${eq.model}</td>
                                    <td>${eq.brand}</td>
                                    <td>${eq.status}</td>
                                    <td>${(eq.sensors || []).length} sensores</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            }

            if (type === 'maintenance' || type === 'full') {
                content += `
                    <div class="report-header" style="${type === 'full' ? 'margin-top:40px;' : ''}">
                        <h1 style="margin:0;">HISTÓRICO DE MANUTENÇÕES</h1>
                        ${type !== 'full' ? `<p style="margin:5px 0;">Emissão: ${today}</p>` : ''}
                    </div>
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Equipamento</th>
                                <th>Descrição do Serviço</th>
                                <th>Empresa</th>
                                <th>Custo (R$)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${MOCK_MAINTENANCE_LOGS.map(log => {
                    const eq = MOCK_EQUIPMENTS.find(e => String(e.id) === String(log.equipmentId)) || { name: 'N/A' };
                    return `
                                <tr>
                                    <td>${new Date(log.date).toLocaleDateString('pt-BR')}</td>
                                    <td>${eq.name}</td>
                                    <td>${log.description}</td>
                                    <td>${log.company}</td>
                                    <td>${parseFloat(log.cost).toFixed(2)}</td>
                                </tr>`;
                }).join('')}
                        </tbody>
                    </table>
                `;
            }

            content += `
                <div class="report-footer">
                    <p>Documento gerado eletronicamente por Smart Maintenance System</p>
                    <p>© 2026 | Cacir Soluções Tecnológicas</p>
                </div>
            `;

            printArea.innerHTML = content;

            // Give the browser a moment to render the content before opening the print dialog
            setTimeout(() => {
                window.print();
                printArea.innerHTML = ''; // Clean up after
            }, 250);
        };

        document.getElementById('btn-export-pdf')?.addEventListener('click', () => generatePDF('full'));
        document.querySelectorAll('.btn-download-report').forEach(btn => {
            btn.addEventListener('click', () => generatePDF(btn.dataset.type));
        });
    }

    function renderHelp() {
        mainContent.innerHTML = `
            <div class="view-header">
                <h2>Guia de Ajuda</h2>
            </div>
            <div class="help-section" style="padding: 1rem; max-width: 800px;">
                <div class="card" style="background: var(--bg-card); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border); margin-bottom: 1.5rem;">
                    <h3 style="color: var(--primary); margin-bottom: 1rem;"><i class="fa-solid fa-gauge-high"></i> Painel de Controle (Dashboard)</h3>
                    <p style="margin-bottom: 0.5rem;">A tela inicial oferece uma visão rápida do status da sua operação:</p>
                    <ul style="margin-left: 1.5rem; color: var(--text-secondary);">
                        <li><strong>Alertas Ativos:</strong> Resumo de todas as ocorrências que demandam atenção imediata.</li>
                    </ul>
                </div>

                <div class="card" style="background: var(--bg-card); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border); margin-bottom: 1.5rem;">
                    <h3 style="color: var(--primary); margin-bottom: 1rem;"><i class="fa-solid fa-industry"></i> Gestão de Equipamentos</h3>
                    <p style="margin-bottom: 0.5rem;">Cadastre e gerencie sua frota de máquinas:</p>
                    <ul style="margin-left: 1.5rem; color: var(--text-secondary);">
                        <li><strong>Fotos:</strong> Adicione imagens dos equipamentos para fácil identificação visual.</li>
                        <li><strong>Multi-Sensores:</strong> Configure múltiplos indicadores (ex: Vibração e RPM) no mesmo motor usando o botão "+ Sensor".</li>
                        <li><strong>Tópicos MQTT:</strong> Defina o endereço exato de comunicação para cada sensor individualmente.</li>
                    </ul>
                </div>

                <div class="card" style="background: var(--bg-card); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border); margin-bottom: 1.5rem;">
                    <h3 style="color: var(--primary); margin-bottom: 1rem;"><i class="fa-solid fa-microchip"></i> Monitoramento IOT</h3>
                    <p style="margin-bottom: 0.5rem;">Acompanhe os dados ao vivo agrupados por máquina:</p>
                    <ul style="margin-left: 1.5rem; color: var(--text-secondary);">
                        <li><strong>Visão por Máquina:</strong> Todos os sensores de um equipamento agora aparecem juntos e organizados.</li>
                        <li><strong>Estado em Tempo Real:</strong> Cores Verde (OK), Laranja (Aviso) e Vermelho (Crítico) indicam a saúde do ativo.</li>
                        <li><strong>Gráficos:</strong> Histórico recente para análise de tendências de cada sensor.</li>
                    </ul>
                </div>

                <div class="card" style="background: var(--bg-card); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border); margin-bottom: 1.5rem;">
                    <h3 style="color: var(--primary); margin-bottom: 1rem;"><i class="fa-solid fa-clipboard-check"></i> Checklists</h3>
                    <p style="margin-bottom: 0.5rem;">Garanta que a manutenção preventiva seja executada:</p>
                    <ul style="margin-left: 1.5rem; color: var(--text-secondary);">
                        <li>Selecione um checklist (como "Forno Industrial") e siga os passos guiados.</li>
                        <li>Gere evidências de conformidade para relatórios futuros.</li>
                    </ul>
                </div>

                <div class="card" style="background: var(--bg-card); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border); margin-bottom: 1.5rem;">
                    <h3 style="color: var(--primary); margin-bottom: 1rem;"><i class="fa-solid fa-gear"></i> Configurações</h3>
                    <p style="margin-bottom: 0.5rem;">Personalize sua experiência e infraestrutura:</p>
                    <ul style="margin-left: 1.5rem; color: var(--text-secondary);">
                        <li><strong>Modo Escuro:</strong> Alterne entre o tema "Espresso" (escuro) e "Latte" (claro).</li>
                        <li><strong>Broker MQTT:</strong> Configure os dados de conexão (URL, Porta, ClientID) para o seu servidor.</li>
                        <li><strong>Telefone WhatsApp:</strong> Configure o número que receberá os alertas do sistema.</li>
                    </ul>
                </div>

                <div class="card" style="background: var(--bg-card); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border);">
                    <h3 style="color: #25d366; margin-bottom: 1rem;"><i class="fa-brands fa-whatsapp"></i> Notificações WhatsApp</h3>
                    <p style="margin-bottom: 0.5rem;">Como usar o sistema de alertas em tempo real:</p>
                    <ol style="margin-left: 1.5rem; color: var(--text-secondary); line-height: 1.6;">
                        <li><strong>Configuração:</strong> Primeiro, acesse a aba <em>Configurações</em> e cadastre o número do telefone com DDD e código do país (ex: 5511999999999).</li>
                        <li><strong>Monitoramento:</strong> O sistema detecta automaticamente valores críticos nos sensores (ex: Temperatura > 90% do limite).</li>
                        <li><strong>Envio:</strong> No Dashboard, clique no botão <strong>"Notificar"</strong> ao lado do alerta. Isso abrirá seu WhatsApp com uma mensagem técnica completa já preenchida e pronta para envio.</li>
                    </ol>
                </div>
            </div>
        `;
    }

    // Init
    loadView('dashboard');
});
