const axios = require('axios');
const xlsx = require('xlsx');
const { dbUtils, dbReady } = require('../database/database');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const API_URL = 'http://localhost:5000/api';

async function login(username, password) {
    try {
        const response = await axios.post(`${API_URL}/auth/login`, { username, password });
        return response.data.token;
    } catch (error) {
        console.error('Login failed:', error.response ? error.response.data : error.message);
        throw error;
    }
}

async function createDummyExcel() {
    const wb = xlsx.utils.book_new();
    const data = [
        { Description: 'Fournitures de bureau', Montant: 500, Classification: 'Fonctionnement' },
        { Description: 'Carburant', Montant: 1200, Classification: 'Transport' },
        { Description: 'Maintenance IT', Montant: 800, Classification: 'IT' }
    ];
    const ws = xlsx.utils.json_to_sheet(data);
    xlsx.utils.book_append_sheet(wb, ws, 'Budget');
    return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

async function runTest() {
    console.log('🚀 Test Import Budget (Role Analyste)...');
    
    // 1. Login as Analyst
    // Note: ensure seed data exists (analyste / password123)
    // We might need to re-seed if db was reset without reseeding users.
    // The reset_db script KEPT users. So we are good.
    
    try {
        const token = await login('analyste', 'password123');
        console.log('✅ Login Analyste OK');

        // 2. Prepare Excel
        const buffer = await createDummyExcel();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        // Axios with FormData (need 'form-data' lib for node, or construct it)
        const FormData = require('form-data');
        const form = new FormData();
        form.append('file', buffer, 'test_budget.xlsx');
        form.append('mois', '2026-03');
        form.append('annee', '2026');

        // 3. Upload
        const response = await axios.post(`${API_URL}/budgets/import`, form, {
            headers: {
                ...form.getHeaders(),
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('✅ Import Response:', response.data);

        if (response.data.success && response.data.count === 3) {
            console.log('🎉 Test SUCCESS: Analyste can import budget.');
        } else {
            console.error('❌ Test FAILED: Unexpected response format.');
        }

    } catch (error) {
        if (error.response) {
            console.error('❌ Request failed:', error.response.status, error.response.data);
        } else {
            console.error('❌ Error:', error.message);
        }
    }
}

// Check if server is running? We assume yes.
runTest();
