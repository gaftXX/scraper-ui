// Simple test script for the translation API
// Run with: node test-translation.js

const testTranslation = async () => {
  const testText = "Esta es una empresa de arquitectura especializada en diseño sostenible y construcción moderna.";
  
  try {
    const response = await fetch('http://localhost:3000/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: testText,
        sourceLanguage: 'spanish',
        targetLanguage: 'english'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('Translation Test Results:');
    console.log('Original:', result.originalText);
    console.log('Translated:', result.translatedText);
    console.log('Source Language:', result.sourceLanguage);
    console.log('Target Language:', result.targetLanguage);
    console.log('Confidence:', result.confidence);
    
  } catch (error) {
    console.error('Translation test failed:', error.message);
  }
};

// Test health check endpoint
const testHealthCheck = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/translate', {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('Health Check Results:');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Health check failed:', error.message);
  }
};

// Run tests
console.log('Testing Translation API...\n');
testHealthCheck().then(() => {
  console.log('\n' + '='.repeat(50) + '\n');
  testTranslation();
});
