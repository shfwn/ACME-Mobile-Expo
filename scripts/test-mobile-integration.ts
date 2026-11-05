import { ApiClient } from '../src/services/api.client';
import { AuthStorage } from '../src/services/auth.storage';
import { User } from '../src/types/auth.types';

async function runSmokeTest() {
  console.log('=== SMOKE TEST: Mobile ApiClient & Auth Storage Integration ===');

  // 1. Uji coba AuthStorage lokal
  console.log('\n[1] Testing AuthStorage token and user persistence:');
  const dummyToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy-token-payload';
  const dummyUser: User = {
    id: 'u-milt',
    name: 'Owner ACME',
    email: 'owner@company.com',
    role: 'OWNER',
    avatarUrl: null,
    weeklyCapacityHours: 40,
  };

  await AuthStorage.saveToken(dummyToken);
  await AuthStorage.saveUser(dummyUser);

  const token = await AuthStorage.getToken();
  const user = await AuthStorage.getUser<User>();

  console.log('Retrieved token:', token ? 'Token exists and verified' : 'No token');
  console.log('Retrieved user:', user);

  if (token !== dummyToken || user?.email !== 'owner@company.com' || user?.role !== 'OWNER') {
    throw new Error('AuthStorage failed to save and retrieve authentication data');
  }
  console.log('✔ AuthStorage persistent data verification passed!');

  // 2. Uji coba format API Client
  console.log('\n[2] Testing ApiClient endpoint configuration:');
  console.log('Default Base URL:', ApiClient.getBaseUrl());
  ApiClient.setBaseUrl('http://192.168.1.100:3000');
  console.log('Custom Base URL:', ApiClient.getBaseUrl());
  if (ApiClient.getBaseUrl() !== 'http://192.168.1.100:3000') {
    throw new Error('Failed to update Base URL');
  }
  ApiClient.setBaseUrl('http://localhost:3000');
  console.log('Restored Base URL:', ApiClient.getBaseUrl());
  console.log('✔ ApiClient Base URL management passed!');

  // 3. Uji coba pembersihan sesi (Logout)
  console.log('\n[3] Testing AuthStorage session clearing (logout):');
  await AuthStorage.clearAll();
  const clearedToken = await AuthStorage.getToken();
  const clearedUser = await AuthStorage.getUser<User>();
  console.log('Cleared token status:', clearedToken);
  console.log('Cleared user status:', clearedUser);
  if (clearedToken !== null || clearedUser !== null) {
    throw new Error('Failed to cleanly purge authentication storage');
  }
  console.log('✔ Session purge / logout passed!');

  console.log('\n=== ALL PHASE 1 MOBILE CLIENT TESTS PASSED! ===');
}

runSmokeTest().catch((err) => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
