import { NextRequest, NextResponse } from 'next/server';

interface InputAnalysisRequest {
  officeId: string;
  inputText: string;
  officeName: string;
  officeAddress?: string;
  country?: string;
}

interface ProjectData {
  name: string;
  size?: string;
  location?: string;
  useCase?: string;
  description?: string;
  status?: 'completed' | 'in-progress' | 'planning';
}

interface TeamData {
  teamSize?: string;
  numberOfPeople?: number;
  specificArchitects?: string[];
  roles?: string[];
}

interface RelationsData {
  constructionCompanies?: string[];
  otherArchOffices?: string[];
  partners?: string[];
  collaborators?: string[];
}

interface FundingData {
  budget?: string;
  fundingSources?: string[];
  financialInfo?: string;
  investmentDetails?: string;
}

interface ClientData {
  pastClients?: string[];
  presentClients?: string[];
  clientTypes?: string[];
  clientIndustries?: string[];
}

interface InputAnalysisResult {
  projects: ProjectData[];
  team: TeamData;
  relations: RelationsData;
  funding: FundingData;
  clients: ClientData;
  confidence: number;
  analysisNotes?: string;
  originalLanguage?: string;
  translatedText?: string;
}

// Validation and cleaning functions
function isValidProject(project: any): boolean {
  if (!project || typeof project !== 'object') return false;
  
  // Must have at least a name or description
  const hasName = project.name && typeof project.name === 'string' && project.name.trim().length > 0;
  const hasDescription = project.description && typeof project.description === 'string' && project.description.trim().length > 0;
  
  // Must have at least one meaningful field
  const hasSize = project.size && typeof project.size === 'string' && project.size.trim().length > 0;
  const hasLocation = project.location && typeof project.location === 'string' && project.location.trim().length > 0;
  const hasUseCase = project.useCase && typeof project.useCase === 'string' && project.useCase.trim().length > 0;
  const hasStatus = project.status && typeof project.status === 'string' && project.status.trim().length > 0;
  
  return (hasName || hasDescription) && (hasSize || hasLocation || hasUseCase || hasStatus);
}

function isValidTeamData(team: any): boolean {
  if (!team || typeof team !== 'object') return false;
  
  const hasTeamSize = team.teamSize && typeof team.teamSize === 'string' && team.teamSize.trim().length > 0;
  const hasNumberOfPeople = team.numberOfPeople && typeof team.numberOfPeople === 'number' && team.numberOfPeople > 0;
  const hasArchitects = team.specificArchitects && Array.isArray(team.specificArchitects) && team.specificArchitects.length > 0;
  const hasRoles = team.roles && Array.isArray(team.roles) && team.roles.length > 0;
  
  return hasTeamSize || hasNumberOfPeople || hasArchitects || hasRoles;
}

function isValidRelationsData(relations: any): boolean {
  if (!relations || typeof relations !== 'object') return false;
  
  const hasConstruction = relations.constructionCompanies && Array.isArray(relations.constructionCompanies) && relations.constructionCompanies.length > 0;
  const hasArchOffices = relations.otherArchOffices && Array.isArray(relations.otherArchOffices) && relations.otherArchOffices.length > 0;
  const hasPartners = relations.partners && Array.isArray(relations.partners) && relations.partners.length > 0;
  const hasCollaborators = relations.collaborators && Array.isArray(relations.collaborators) && relations.collaborators.length > 0;
  
  return hasConstruction || hasArchOffices || hasPartners || hasCollaborators;
}

function isValidFundingData(funding: any): boolean {
  if (!funding || typeof funding !== 'object') return false;
  
  const hasBudget = funding.budget && typeof funding.budget === 'string' && funding.budget.trim().length > 0;
  const hasFundingSources = funding.fundingSources && Array.isArray(funding.fundingSources) && funding.fundingSources.length > 0;
  const hasFinancialInfo = funding.financialInfo && typeof funding.financialInfo === 'string' && funding.financialInfo.trim().length > 0;
  const hasInvestmentDetails = funding.investmentDetails && typeof funding.investmentDetails === 'string' && funding.investmentDetails.trim().length > 0;
  
  return hasBudget || hasFundingSources || hasFinancialInfo || hasInvestmentDetails;
}

function isValidClientData(clients: any): boolean {
  if (!clients || typeof clients !== 'object') return false;
  
  const hasPastClients = clients.pastClients && Array.isArray(clients.pastClients) && clients.pastClients.length > 0;
  const hasPresentClients = clients.presentClients && Array.isArray(clients.presentClients) && clients.presentClients.length > 0;
  const hasClientTypes = clients.clientTypes && Array.isArray(clients.clientTypes) && clients.clientTypes.length > 0;
  const hasClientIndustries = clients.clientIndustries && Array.isArray(clients.clientIndustries) && clients.clientIndustries.length > 0;
  
  return hasPastClients || hasPresentClients || hasClientTypes || hasClientIndustries;
}

function removeDuplicatesFromArray(arr: any[]): any[] {
  if (!Array.isArray(arr)) return [];
  
  const seen = new Set();
  return arr.filter(item => {
    if (typeof item === 'string') {
      const normalized = item.toLowerCase().trim();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    }
    return true; // Keep non-string items for now
  });
}

function validateAndCleanAnalysisResult(result: InputAnalysisResult): InputAnalysisResult {
  const cleaned: InputAnalysisResult = {
    projects: [],
    team: {},
    relations: {},
    funding: {},
    clients: {},
    confidence: result.confidence || 0,
    analysisNotes: result.analysisNotes || '',
    originalLanguage: result.originalLanguage,
    translatedText: result.translatedText
  };

  // Validate and clean projects
  if (Array.isArray(result.projects)) {
    cleaned.projects = result.projects
      .filter(isValidProject)
      .map(project => ({
        name: project.name?.trim() || '',
        size: project.size?.trim() || '',
        location: project.location?.trim() || '',
        useCase: project.useCase?.trim() || '',
        description: project.description?.trim() || '',
        status: project.status?.trim() || 'planning'
      }));
  }

  // Validate and clean team data
  if (isValidTeamData(result.team)) {
    cleaned.team = {
      teamSize: result.team.teamSize?.trim() || '',
      numberOfPeople: result.team.numberOfPeople || 0,
      specificArchitects: removeDuplicatesFromArray(result.team.specificArchitects || []),
      roles: removeDuplicatesFromArray(result.team.roles || [])
    };
  }

  // Validate and clean relations data
  if (isValidRelationsData(result.relations)) {
    cleaned.relations = {
      constructionCompanies: removeDuplicatesFromArray(result.relations.constructionCompanies || []),
      otherArchOffices: removeDuplicatesFromArray(result.relations.otherArchOffices || []),
      partners: removeDuplicatesFromArray(result.relations.partners || []),
      collaborators: removeDuplicatesFromArray(result.relations.collaborators || [])
    };
  }

  // Validate and clean funding data
  if (isValidFundingData(result.funding)) {
    cleaned.funding = {
      budget: result.funding.budget?.trim() || '',
      fundingSources: removeDuplicatesFromArray(result.funding.fundingSources || []),
      financialInfo: result.funding.financialInfo?.trim() || '',
      investmentDetails: result.funding.investmentDetails?.trim() || ''
    };
  }

  // Validate and clean client data
  if (isValidClientData(result.clients)) {
    cleaned.clients = {
      pastClients: removeDuplicatesFromArray(result.clients.pastClients || []),
      presentClients: removeDuplicatesFromArray(result.clients.presentClients || []),
      clientTypes: removeDuplicatesFromArray(result.clients.clientTypes || []),
      clientIndustries: removeDuplicatesFromArray(result.clients.clientIndustries || [])
    };
  }

  return cleaned;
}

// Function to determine country based on office address
function determineCountryFromAddress(address: string, officeName: string): string {
  const addressLower = address.toLowerCase();
  const nameLower = officeName.toLowerCase();
  
  // Spanish cities and indicators
  const spanishIndicators = [
    'barcelona', 'madrid', 'valencia', 'sevilla', 'bilbao', 'zaragoza', 'málaga', 'malaga',
    'murcia', 'palma', 'las palmas', 'granada', 'alicante', 'córdoba', 'cordoba', 'valladolid',
    'vigo', 'gijón', 'gijon', 'hospitalet', 'coruña', 'coruna', 'vitoria', 'elche', 'oviedo',
    'santa cruz', 'badalona', 'cartagena', 'terrassa', 'jerez', 'sabadell', 'móstoles', 'mostoles',
    'alcalá', 'alcala', 'pamplona', 'fuenlabrada', 'almería', 'almeria', 'leganés', 'leganes',
    'santander', 'castellón', 'castellon', 'burgos', 'albacete', 'alcorcón', 'alcorcon', 'getafe',
    'salamanca', 'huelva', 'marbella', 'león', 'leon', 'tarragona', 'cádiz', 'cadiz', 'lugo',
    'linares', 'cáceres', 'caceres', 'lérida', 'lerida', 'mataró', 'mataro', 'santa coloma',
    'algeciras', 'jaén', 'jaen', 'ourense', 'reus', 'torrelavega', 'el ejido', 'mijas',
    'melilla', 'ceuta', 'spain', 'españa', 'españa', 'cataluña', 'catalunya', 'andalucía', 'andalucia',
    'galicia', 'castilla', 'valencia', 'murcia', 'extremadura', 'navarra', 'la rioja', 'cantabria',
    'asturias', 'aragón', 'aragon', 'islas baleares', 'islas canarias', 'país vasco', 'pais vasco'
  ];
  
  // Latvian cities and indicators
  const latvianIndicators = [
    'rīga', 'riga', 'daugavpils', 'liepāja', 'liepaja', 'jelgava', 'jūrmala', 'jurmala',
    'ventspils', 'rēzekne', 'rezekne', 'valmiera', 'jēkabpils', 'jekabpils', 'salaspils',
    'ogre', 'tukums', 'cēsis', 'cesis', 'kuldīga', 'kuldiga', 'sigulda', 'olaine',
    'bauska', 'līvāni', 'livani', 'gulbene', 'madona', 'limbaži', 'limbazi', 'alūksne', 'aluksne',
    'preiļi', 'preili', 'balvi', 'ludza', 'krāslava', 'kraslava', 'viļāni', 'vilani',
    'latvia', 'latvija', 'latvijas', 'latvijas republika'
  ];
  
  // Check for Spanish indicators
  for (const indicator of spanishIndicators) {
    if (addressLower.includes(indicator) || nameLower.includes(indicator)) {
      return 'spain';
    }
  }
  
  // Check for Latvian indicators
  for (const indicator of latvianIndicators) {
    if (addressLower.includes(indicator) || nameLower.includes(indicator)) {
      return 'latvia';
    }
  }
  
  // Default to Spain if no clear indicator found (since most offices are likely Spanish)
  return 'spain';
}

export async function POST(request: NextRequest) {
  try {
    const { officeId, inputText, officeName, officeAddress, country }: InputAnalysisRequest = await request.json();

    if (!inputText || !officeName) {
      return NextResponse.json(
        { error: 'Missing required fields: inputText and officeName' },
        { status: 400 }
      );
    }

    // Step 1: Detect language and translate if needed
    let processedText = inputText;
    let originalLanguage = 'en';
    let translatedText: string | undefined;

    // Detect language and translate if Spanish
    const languageDetectionResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.CLAUDE_API_KEY!,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: `Determine if the following text is in Spanish or English. Respond with only "spanish" or "english".\n\nText: ${inputText.substring(0, 500)}`
          }
        ]
      })
    });

    if (languageDetectionResponse.ok) {
      const detectionData = await languageDetectionResponse.json();
      const detectedLanguage = detectionData.content[0]?.text?.toLowerCase().trim();
      
      if (detectedLanguage === 'spanish') {
        originalLanguage = 'es';
        
        // Translate to English using Anthropic
        const translationResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': process.env.CLAUDE_API_KEY!,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 2000,
            messages: [
              {
                role: 'user',
                content: `Translate the following Spanish text to English while preserving all technical terms, names, and specific details. Maintain the original structure and formatting.\n\nSpanish text:\n${inputText}`
              }
            ]
          })
        });

        if (translationResponse.ok) {
          const translationData = await translationResponse.json();
          translatedText = translationData.content[0]?.text;
          processedText = translatedText || inputText;
        }
      }
    }

    // Step 2: Input Analysis prompt
    const analysisPrompt = `
Analyze the following text about the architecture office "${officeName}"${officeAddress ? ` located at ${officeAddress}` : ''} and extract structured information into the specified categories.

Input text:
${processedText}

Please analyze and categorize the information into these sections:

1. PROJECTS: Extract project information including:
   - Project names
   - Project sizes (square meters, area, etc.)
   - Project locations
   - Use cases (residential, commercial, etc.)
   - Project descriptions
   - Project status (completed, in-progress, planning)

2. TEAM: Extract team information including:
   - Team size (number of people, small/medium/large)
   - Specific architect names
   - Roles and positions
   - Team structure

3. RELATIONS: Extract relationship information including:
   - Construction companies they work with
   - Other architecture offices they collaborate with
   - Partners and collaborators
   - Business relationships

4. FUNDING: Extract financial information including:
   - Budget information
   - Funding sources
   - Financial details
   - Investment information

5. CLIENTS: Extract client information including:
   - Past clients
   - Present clients
   - Client types
   - Client industries

Return the analysis as a JSON object with this exact structure:
{
  "projects": [
    {
      "name": "Project Name",
      "size": "Size information",
      "location": "Location",
      "useCase": "Use case",
      "description": "Description",
      "status": "completed"
    }
  ],
  "team": {
    "teamSize": "Team size description",
    "numberOfPeople": number,
    "specificArchitects": ["Architect Name 1", "Architect Name 2"],
    "roles": ["Role 1", "Role 2"]
  },
  "relations": {
    "constructionCompanies": ["Company 1", "Company 2"],
    "otherArchOffices": ["Office 1", "Office 2"],
    "partners": ["Partner 1", "Partner 2"],
    "collaborators": ["Collaborator 1", "Collaborator 2"]
  },
  "funding": {
    "budget": "Budget information",
    "fundingSources": ["Source 1", "Source 2"],
    "financialInfo": "Financial details",
    "investmentDetails": "Investment information"
  },
  "clients": {
    "pastClients": ["Client 1", "Client 2"],
    "presentClients": ["Client 1", "Client 2"],
    "clientTypes": ["Type 1", "Type 2"],
    "clientIndustries": ["Industry 1", "Industry 2"]
  },
  "confidence": 85,
  "analysisNotes": "Additional notes about the analysis"
}

If information is not available for a category, use empty arrays or null values. Be thorough but only extract information that is clearly stated in the text.
`;

    // Call Anthropic API for analysis
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.CLAUDE_API_KEY!,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: `You are an expert data analyst specializing in architecture office information. Extract and categorize information accurately and comprehensively.\n\n${analysisPrompt}`
          }
        ]
      })
    });

    if (!anthropicResponse.ok) {
      throw new Error(`Anthropic API error: ${anthropicResponse.status}`);
    }

    const anthropicData = await anthropicResponse.json();
    const analysisText = anthropicData.content[0]?.text;

    if (!analysisText) {
      throw new Error('No analysis received from Anthropic');
    }

    // Parse the JSON response
    let analysisResult: InputAnalysisResult;
    try {
      // Extract JSON from the response (in case there's additional text)
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Error parsing input analysis:', parseError);
      console.error('Raw response:', analysisText);
      
      // Fallback: create a basic structure
      analysisResult = {
        projects: [],
        team: {},
        relations: {},
        funding: {},
        clients: {},
        confidence: 0,
        analysisNotes: 'Error parsing input analysis response'
      };
    }

    // Add translation information to the result
    analysisResult.originalLanguage = originalLanguage;
    if (translatedText) {
      analysisResult.translatedText = translatedText;
    }

    // Validate and clean the analysis result
    analysisResult = validateAndCleanAnalysisResult(analysisResult);

    // Determine country based on office address
    const officeCountry = determineCountryFromAddress(officeAddress || '', officeName);

    // Save the analysis to Firebase
    let firebaseSaveSuccess = false;
    let firebaseError = null;
    let saveResult: any = null;
    
    try {
      console.log('Starting Firebase save for officeId:', officeId);
      const { FirebaseService } = await import('../../../../scraper-backend/services/firebaseService');
      
      const firebaseService = new FirebaseService({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
        privateKey: process.env.NEXT_PUBLIC_FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        clientEmail: process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL!,
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
      });

      console.log('Firebase service initialized, saving analysis data...');
      console.log('Office ID:', officeId);
      console.log('Office Address:', officeAddress);
      console.log('Determined Country:', officeCountry);
      console.log('Analysis data to save:', JSON.stringify(analysisResult, null, 2));
      
      // Save the analyzed data with the office's country
      saveResult = await firebaseService.saveOfficeAnalysis(officeId, {
        ...analysisResult,
        originalText: inputText,
        analyzedAt: new Date(),
        officeName,
        officeAddress
      }, officeCountry);
      
      console.log(`Data saved to Firebase path: ${officeCountry}-analyses/${officeId}`);
      
      console.log('Firebase save completed successfully');
      firebaseSaveSuccess = saveResult.success;

    } catch (error) {
      console.error('Error saving analysis to Firebase:', error);
      firebaseError = error instanceof Error ? error.message : 'Unknown Firebase error';
      // Continue with response even if Firebase save fails
    }

    return NextResponse.json({
      success: true,
      analysis: analysisResult,
      officeId,
      firebaseSaveSuccess,
      firebaseError,
      feedback: saveResult?.feedback
    });

    } catch (error) {
      console.error('Input Analysis error:', error);
      return NextResponse.json(
        { error: 'Failed to analyze office data', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  }
