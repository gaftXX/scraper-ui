// Debug test script for the translation API
// Run with: node test-translation-debug.js

const testTranslationDebug = async () => {
  const testText = "Esta es una empresa de arquitectura especializada en diseño sostenible.";
  
  console.log('Testing Translation API Debug...');
  console.log('Original text:', testText);
  console.log('Expected: This is an architecture company specialized in sustainable design.');
  console.log('');

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

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return;
    }

    const result = await response.json();
    console.log('Translation Results:');
    console.log('Original:', result.originalText);
    console.log('Translated:', result.translatedText);
    console.log('Source Language:', result.sourceLanguage);
    console.log('Target Language:', result.targetLanguage);
    console.log('Confidence:', result.confidence);
    
    // Check if translation actually happened
    if (result.originalText === result.translatedText) {
      console.log('⚠️  WARNING: Original and translated text are identical!');
    } else {
      console.log('✅ Translation appears to have occurred');
    }
    
  } catch (error) {
    console.error('Translation test failed:', error.message);
  }
};

// Test with English text to see if it returns as-is
const testEnglishText = async () => {
  const englishText = "This is an architecture company.";
  
  console.log('\n' + '='.repeat(50));
  console.log('Testing with English text...');
  console.log('Text:', englishText);
  console.log('');

  try {
    const response = await fetch('http://localhost:3000/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: englishText,
        targetLanguage: 'english'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return;
    }

    const result = await response.json();
    console.log('Results:');
    console.log('Original:', result.originalText);
    console.log('Translated:', result.translatedText);
    
    if (result.originalText === result.translatedText) {
      console.log('✅ English text returned as-is (correct behavior)');
    } else {
      console.log('⚠️  English text was modified');
    }
    
  } catch (error) {
    console.error('English test failed:', error.message);
  }
};

// Run tests
testTranslationDebug().then(() => {
  testEnglishText();
});
