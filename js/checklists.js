
export class ChecklistManager {
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
                    <button class="btn btn-secondary" onclick="document.dispatchEvent(new CustomEvent('close-checklist'))">Voltar</button>
                </div>
            `;
            return;
        }

        this.activeChecklist = items;

        let html = `
            <div class="checklist-execution" style="padding: 1rem; max-width: 800px; margin: 0 auto; text-align: left;">
                <div class="cl-header" style="margin-bottom: 2rem; border-bottom: 1px solid var(--border); padding-bottom: 1rem;">
                    <button class="btn btn-secondary" style="margin-bottom: 1rem;" onclick="document.dispatchEvent(new CustomEvent('close-checklist'))"><i class="fa-solid fa-arrow-left"></i> Voltar</button>
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

        // Handle Submit
        document.getElementById('checklist-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.processSubmission(new FormData(e.target), items);
        });
    }

    processSubmission(formData, items) {
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
            this.createAlerts(issues);
            alert(`⚠️ Atenção! Foram detectados ${issues.length} não conformidades no(a) ${this.currentEquipment.name}. Alertas foram gerados.`);
        } else {
            alert(`✅ Checklist do(a) ${this.currentEquipment.name} concluído com sucesso! Tudo em ordem.`);
        }

        // Return to list (dispatch event)
        document.dispatchEvent(new CustomEvent('close-checklist'));
    }

    createAlerts(issues) {
        console.log("Generating Alerts for:", issues);
        // In real app integration with Supabase...
        issues.forEach(issue => {
            console.log(`[ALERTA REGISTRADO] ${issue.equipment}: ${issue.alert}`);
        });
    }
}

export const checklistManager = new ChecklistManager();
