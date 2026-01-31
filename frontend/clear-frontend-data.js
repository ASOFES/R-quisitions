// Script pour effacer toutes les données du localStorage
console.log('Effacement des données du localStorage...');

// Effacer toutes les réquisitions
localStorage.removeItem('requisitions');
localStorage.removeItem('authToken');
localStorage.removeItem('user');

// Effacer d'autres données potentielles
Object.keys(localStorage).forEach(key => {
  if (key.includes('requisition') || key.includes('auth') || key.includes('user')) {
    localStorage.removeItem(key);
    console.log(`✅ ${key} effacé`);
  }
});

console.log('🎊 Toutes les données du localStorage ont été effacées !');
console.log('🔄 Rafraîchissez la page pour voir les changements.');
