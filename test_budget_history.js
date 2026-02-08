
async function testBudgetHistory() {
    try {
        // Authenticate first
        const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'admin',
                password: 'password123'
            })
        });

        if (!loginResponse.ok) {
            throw new Error(`Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
        }

        const loginData = await loginResponse.json();
        const token = loginData.token;
        console.log('Login successful, token obtained');

        // Fetch budget history
        const historyResponse = await fetch('http://localhost:5000/api/budgets/history', {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!historyResponse.ok) {
            throw new Error(`History fetch failed: ${historyResponse.status} ${historyResponse.statusText}`);
        }

        const historyData = await historyResponse.json();
        console.log('Budget History Response:', JSON.stringify(historyData, null, 2));

        if (Array.isArray(historyData)) {
            console.log(`Found ${historyData.length} history items.`);
        } else {
            console.error('Response is not an array!');
        }

    } catch (error) {
        console.error('Error testing budget history:', error);
    }
}

testBudgetHistory();
