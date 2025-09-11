import { NextRequest, NextResponse } from 'next/server';

interface TranslationRequest {
  text: string;
  sourceLanguage?: string;
  targetLanguage?: string;
}

interface TranslationResponse {
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: TranslationRequest = await request.json();
    const { text, sourceLanguage = 'auto', targetLanguage = 'english' } = body;

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Text is required for translation' },
        { status: 400 }
      );
    }

    const claudeApiKey = process.env.ANTHROPIC_API_KEY;
    if (!claudeApiKey) {
      console.error('ANTHROPIC_API_KEY environment variable is not set');
      return NextResponse.json(
        { error: 'Claude API key not configured. Please set ANTHROPIC_API_KEY environment variable.' },
        { status: 500 }
      );
    }

    console.log('Translation request:', { 
      textLength: text.length, 
      sourceLanguage, 
      targetLanguage,
      hasApiKey: !!claudeApiKey 
    });

    // Create translation prompt
    const translationPrompt = `You are a professional translator. Your task is to translate the following text to English.

CRITICAL REQUIREMENTS:
1. ALWAYS translate to English, regardless of the source language
2. If the text is already in English, return it exactly as-is
3. Maintain the original meaning and context
4. Preserve technical terms, proper nouns, and company names
5. Keep the same formatting and structure
6. For architecture/construction terms, use standard English terminology
7. Preserve any HTML tags or markdown formatting if present
8. Do not add any explanations or notes - only provide the translation

TEXT TO TRANSLATE:
${text}

ENGLISH TRANSLATION:`;

    // Call Claude API
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: translationPrompt
          }
        ]
      })
    });

    if (!claudeResponse.ok) {
      const errorData = await claudeResponse.text();
      console.error('Claude API error:', errorData);
      return NextResponse.json(
        { error: 'Translation service unavailable' },
        { status: 500 }
      );
    }

    const claudeData = await claudeResponse.json();
    const translatedText = claudeData.content?.[0]?.text?.trim() || text;

    console.log('Claude response:', { 
      originalText: text.substring(0, 100) + '...', 
      translatedText: translatedText.substring(0, 100) + '...',
      responseLength: translatedText.length 
    });

    const response: TranslationResponse = {
      originalText: text,
      translatedText: translatedText,
      sourceLanguage: sourceLanguage,
      targetLanguage: targetLanguage,
      confidence: 0.95 // High confidence for Claude translations
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Translation API error:', error);
    return NextResponse.json(
      { error: 'Internal server error during translation' },
      { status: 500 }
    );
  }
}

// GET endpoint for health check
export async function GET() {
  return NextResponse.json({
    message: 'Translation API is running',
    supportedLanguages: ['english', 'spanish', 'french', 'german', 'italian', 'portuguese', 'auto'],
    endpoint: '/api/translate',
    method: 'POST'
  });
}
