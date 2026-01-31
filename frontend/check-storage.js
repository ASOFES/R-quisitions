// Script pour vérifier l'état du localStorage
console.log('=== Vérification du localStorage ===');

// Vérifier les réquisitions
const requisitions = localStorage.getItem('requisitions');
if (requisitions) {
  const parsedRequisitions = JSON.parse(requisitions);
  console.log('📋 Réquisitions trouvées:', parsedRequisitions.length);
  console.log('📊 Détails:', parsedRequisitions);
} else {
  console.log('❌ Aucune réquisition trouvée dans le localStorage');
}

// Vérifier les autres clés
console.log('\n🔑 Autres clés du localStorage:');
Object.keys(localStorage).forEach(key => {
  console.log(`- ${key}: ${localStorage.getItem(key)}`);
});

console.log('\n=== Fin de la vérification ===');
