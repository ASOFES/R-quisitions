const http = require('http');

const BASE_URL = 'http://localhost:5000/api';

async function request(method, endpoint, token = null, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(BASE_URL + endpoint);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const json = body ? JSON.parse(body) : {};
                    resolve({ status: res.statusCode, body: json });
                } catch (e) {
                    resolve({ status: res.statusCode, body: body });
                }
            });
        });

        req.on('error', (e) => reject(e));

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function runTest() {
    console.log('🚀 Starting Profile API Test...');

    // 1. Login
    console.log('\n1. Logging in as admin...');
    const loginRes = await request('POST', '/auth/login', null, {
        username: 'admin',
        password: 'password123'
    });
    
    if (loginRes.status !== 200) {
        console.error('❌ Login failed:', loginRes.body);
        return;
    }
    console.log('✅ Login successful');
    const token = loginRes.body.token;

    // 2. Get Profile
    console.log('\n2. Getting Profile...');
    const profileRes = await request('GET', '/profile', token);
    if (profileRes.status !== 200) {
        console.error('❌ Get Profile failed:', profileRes.body);
        return;
    }
    console.log('✅ Profile fetched:', profileRes.body.username, profileRes.body.nom_complet);
    const originalName = profileRes.body.nom_complet;

    // 3. Update Name
    console.log('\n3. Updating Name to "Admin Updated"...');
    const updateRes = await request('PUT', '/profile', token, {
        nom_complet: 'Admin Updated'
    });
    if (updateRes.status !== 200) {
        console.error('❌ Update Profile failed:', updateRes.body);
        return;
    }
    console.log('✅ Profile updated');

    // 4. Verify Update
    console.log('\n4. Verifying Update...');
    const verifyRes = await request('GET', '/profile', token);
    if (verifyRes.body.nom_complet !== 'Admin Updated') {
        console.error('❌ Verification failed. Expected "Admin Updated", got:', verifyRes.body.nom_complet);
    } else {
        console.log('✅ Verification successful');
    }

    // 5. Change Password (Wrong Current)
    console.log('\n5. Testing Password Change (Wrong Current)...');
    const wrongPassRes = await request('PUT', '/profile', token, {
        password: 'wrongpassword',
        new_password: 'newpassword123'
    });
    if (wrongPassRes.status === 401) {
        console.log('✅ Correctly rejected wrong password');
    } else {
        console.error('❌ Failed. Expected 401, got:', wrongPassRes.status);
    }

    // 6. Change Password (Success)
    console.log('\n6. Changing Password to "newpassword123"...');
    const changePassRes = await request('PUT', '/profile', token, {
        password: 'password123',
        new_password: 'newpassword123'
    });
    if (changePassRes.status !== 200) {
        console.error('❌ Password change failed:', changePassRes.body);
        return;
    }
    console.log('✅ Password changed');

    // 7. Login with New Password
    console.log('\n7. Logging in with New Password...');
    const newLoginRes = await request('POST', '/auth/login', null, {
        username: 'admin',
        password: 'newpassword123'
    });
    if (newLoginRes.status !== 200) {
        console.error('❌ Login with new password failed:', newLoginRes.body);
    } else {
        console.log('✅ Login with new password successful');
    }

    // 8. Revert Changes
    console.log('\n8. Reverting Changes...');
    // Revert Name
    await request('PUT', '/profile', token, { nom_complet: originalName }); // Note: token is still valid
    // Revert Password
    // Need new token? Old token should still be valid unless we implement token revocation (which we probably didn't).
    // But to be safe let's use the new token.
    const newToken = newLoginRes.body.token;
    await request('PUT', '/profile', newToken, {
        password: 'newpassword123',
        new_password: 'password123'
    });
    console.log('✅ Changes reverted');
    
    console.log('\n🎉 Test Complete!');
}

runTest().catch(console.error);
