
// WARNING: Replace these with your actual project keys from Supabase Dashboard
const SUPABASE_URL = 'https://xpxqnctyaublqplhxekm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhweHFuY3R5YXVibHFwbGh4ZWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3MzU2NzgsImV4cCI6MjA4NDMxMTY3OH0.-AywFaZslhcQC1EXgYK3pNdCX0hJunw1Mqsu3oDz6do';

let supabaseClient = null;

if (typeof supabase !== 'undefined') {
    try {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("Supabase Client Initialized");
    } catch (e) {
        console.error("Failed to initialize Supabase:", e);
    }
}

window.SupaDB = {
    client: supabaseClient,

    getCurrentUser: async () => {
        if (!supabaseClient) return null;
        const { data: { user }, error } = await supabaseClient.auth.getUser();
        return error ? null : user;
    },

    getProfile: async (userId) => {
        if (!supabaseClient) return null;
        const { data, error } = await supabaseClient.from('profiles').select('*').eq('id', userId).single();
        return data;
    },

    equipments: {
        list: async () => await supabaseClient.from('equipments').select('*'),
        create: async (data) => await supabaseClient.from('equipments').insert(data),
        update: async (id, data) => await supabaseClient.from('equipments').update(data).eq('id', id),
        delete: async (id) => await supabaseClient.from('equipments').delete().eq('id', id)
    },

    sensors: {
        list: async (eqId) => await supabaseClient.from('iot_sensors').select('*').eq('equipment_id', eqId),
        listAll: async () => await supabaseClient.from('iot_sensors').select('*'),
        create: async (data) => await supabaseClient.from('iot_sensors').insert(data),
        deleteByEq: async (eqId) => await supabaseClient.from('iot_sensors').delete().eq('equipment_id', eqId)
    },

    settings: {
        get: async (key) => await supabaseClient.from('global_settings').select('value').eq('key', key).single(),
        set: async (key, value) => await supabaseClient.from('global_settings').upsert({ key, value, updated_at: new Date() })
    },

    alerts: {
        list: async () => await supabaseClient.from('alerts').select('*, equipments(name)').order('created_at', { ascending: false }),
        create: async (data) => await supabaseClient.from('alerts').insert(data)
    }
};
