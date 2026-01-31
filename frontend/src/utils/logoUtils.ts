import api from '../services/api';
import { API_BASE_URL } from '../config';

export const getLogoBase64 = async (): Promise<string | null> => {
  try {
    // 1. Get logo URL from settings
    const response = await api.get('/settings/logo');
    if (!response.data.url) return null;

    const logoUrl = `${API_BASE_URL}${response.data.url}`;

    // 2. Fetch the image
    const imageResponse = await fetch(logoUrl);
    const blob = await imageResponse.blob();

    // 3. Convert to Base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error fetching logo:', error);
    return null;
  }
};
