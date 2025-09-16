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

// Function to process database editing instructions from input text
async function processDatabaseEditInstructions(inputText: string, officeId: string, officeName: string, officeAddress?: string): Promise<{ success: boolean; instructions: string[]; results: any[] }> {
  const instructions: string[] = [];
  const results: any[] = [];
  
  // Extract instructions wrapped in // text //
  const instructionRegex = /\/\/\s*([^\/]+?)\s*\/\//g;
  let match;
  
  while ((match = instructionRegex.exec(inputText)) !== null) {
    const instruction = match[1].trim();
    if (instruction) {
      instructions.push(instruction);
    }
  }
  
  if (instructions.length === 0) {
    return { success: true, instructions: [], results: [] };
  }
  
  console.log('Found database edit instructions:', instructions);
  
  try {
    const { FirebaseService } = await import('../../../../scraper-backend/services/firebaseService');
    
    const firebaseService = new FirebaseService({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
      privateKey: process.env.NEXT_PUBLIC_FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      clientEmail: process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL!,
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
    });
    
    // Process each instruction
    for (const instruction of instructions) {
      try {
        const result = await executeDatabaseInstruction(instruction, officeId, officeName, officeAddress, firebaseService);
        results.push({ instruction, result, success: true });
        console.log(`Executed instruction: ${instruction}`, result);
      } catch (error) {
        console.error(`Failed to execute instruction: ${instruction}`, error);
        results.push({ 
          instruction, 
          result: null, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
    
    return { success: true, instructions, results };
  } catch (error) {
    console.error('Error processing database edit instructions:', error);
    return { 
      success: false, 
      instructions, 
      results: [{ 
        instruction: 'Initialization failed', 
        result: null, 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }] 
    };
  }
}

// Function to execute individual database instructions
async function executeDatabaseInstruction(instruction: string, officeId: string, officeName: string, officeAddress: string | undefined, firebaseService: any): Promise<any> {
  const lowerInstruction = instruction.toLowerCase().trim();
  
  // Parse instruction types
  if (lowerInstruction.includes('delete project') || lowerInstruction.includes('remove project')) {
    return await handleDeleteProject(instruction, officeId, firebaseService);
  } else if (lowerInstruction.includes('update project') || lowerInstruction.includes('modify project')) {
    return await handleUpdateProject(instruction, officeId, firebaseService);
  } else if (lowerInstruction.includes('add project') || lowerInstruction.includes('create project')) {
    return await handleAddProject(instruction, officeId, firebaseService);
  } else if (lowerInstruction.includes('update office') || lowerInstruction.includes('modify office')) {
    return await handleUpdateOffice(instruction, officeId, firebaseService);
  } else if (lowerInstruction.includes('delete office') || lowerInstruction.includes('remove office')) {
    return await handleDeleteOffice(instruction, officeId, firebaseService);
  } else {
    throw new Error(`Unknown instruction type: ${instruction}`);
  }
}

// Handle delete project instruction
async function handleDeleteProject(instruction: string, officeId: string, firebaseService: any): Promise<any> {
  // Extract project name from instruction
  const projectNameMatch = instruction.match(/(?:delete|remove)\s+project\s+["']?([^"']+)["']?/i);
  if (!projectNameMatch) {
    throw new Error('Project name not found in delete instruction');
  }
  
  const projectName = projectNameMatch[1].trim();
  
  // Get current analysis data
  const currentAnalysis = await firebaseService.getLatestOfficeAnalysis(officeId, 'spain');
  if (!currentAnalysis || !currentAnalysis.projects) {
    throw new Error('No analysis data found for office');
  }
  
  // Find and remove the project
  const updatedProjects = currentAnalysis.projects.filter((project: any) => 
    project.name?.toLowerCase().trim() !== projectName.toLowerCase().trim()
  );
  
  if (updatedProjects.length === currentAnalysis.projects.length) {
    throw new Error(`Project "${projectName}" not found`);
  }
  
  // Update the analysis with removed project
  const updatedAnalysis = {
    ...currentAnalysis,
    projects: updatedProjects,
    lastUpdated: new Date()
  };
  
  await firebaseService.saveOfficeAnalysis(officeId, updatedAnalysis, 'spain');
  
  return {
    action: 'delete_project',
    projectName,
    removed: true,
    remainingProjects: updatedProjects.length
  };
}

// Handle update project instruction
async function handleUpdateProject(instruction: string, officeId: string, firebaseService: any): Promise<any> {
  // Extract project name and updates from instruction
  const updateMatch = instruction.match(/(?:update|modify)\s+project\s+["']?([^"']+)["']?\s+(.+)/i);
  if (!updateMatch) {
    throw new Error('Project name and updates not found in update instruction');
  }
  
  const projectName = updateMatch[1].trim();
  const updates = updateMatch[2].trim();
  
  // Get current analysis data
  const currentAnalysis = await firebaseService.getLatestOfficeAnalysis(officeId, 'spain');
  if (!currentAnalysis || !currentAnalysis.projects) {
    throw new Error('No analysis data found for office');
  }
  
  // Find the project to update
  const projectIndex = currentAnalysis.projects.findIndex((project: any) => 
    project.name?.toLowerCase().trim() === projectName.toLowerCase().trim()
  );
  
  if (projectIndex === -1) {
    throw new Error(`Project "${projectName}" not found`);
  }
  
  // Parse updates (simple key:value format)
  const updatePairs = updates.split(',').map(pair => pair.trim());
  const updateData: any = {};
  
  for (const pair of updatePairs) {
    const [key, value] = pair.split(':').map(s => s.trim());
    if (key && value) {
      updateData[key] = value;
    }
  }
  
  // Update the project
  const updatedProjects = [...currentAnalysis.projects];
  updatedProjects[projectIndex] = {
    ...updatedProjects[projectIndex],
    ...updateData
  };
  
  // Update the analysis
  const updatedAnalysis = {
    ...currentAnalysis,
    projects: updatedProjects,
    lastUpdated: new Date()
  };
  
  await firebaseService.saveOfficeAnalysis(officeId, updatedAnalysis, 'spain');
  
  return {
    action: 'update_project',
    projectName,
    updates: updateData,
    updated: true
  };
}

// Handle add project instruction
async function handleAddProject(instruction: string, officeId: string, firebaseService: any): Promise<any> {
  // Extract project details from instruction
  const addMatch = instruction.match(/(?:add|create)\s+project\s+["']?([^"']+)["']?\s+(.+)/i);
  if (!addMatch) {
    throw new Error('Project name and details not found in add instruction');
  }
  
  const projectName = addMatch[1].trim();
  const details = addMatch[2].trim();
  
  // Get current analysis data
  const currentAnalysis = await firebaseService.getLatestOfficeAnalysis(officeId, 'spain');
  if (!currentAnalysis) {
    throw new Error('No analysis data found for office');
  }
  
  // Parse project details
  const detailPairs = details.split(',').map(pair => pair.trim());
  const projectData: any = { name: projectName, status: 'planning' };
  
  for (const pair of detailPairs) {
    const [key, value] = pair.split(':').map(s => s.trim());
    if (key && value) {
      projectData[key] = value;
    }
  }
  
  // Add the new project
  const updatedProjects = [...(currentAnalysis.projects || []), projectData];
  
  // Update the analysis
  const updatedAnalysis = {
    ...currentAnalysis,
    projects: updatedProjects,
    lastUpdated: new Date()
  };
  
  await firebaseService.saveOfficeAnalysis(officeId, updatedAnalysis, 'spain');
  
  return {
    action: 'add_project',
    projectName,
    projectData,
    added: true,
    totalProjects: updatedProjects.length
  };
}

// Handle update office instruction
async function handleUpdateOffice(instruction: string, officeId: string, firebaseService: any): Promise<any> {
  // Extract office updates from instruction
  const updateMatch = instruction.match(/(?:update|modify)\s+office\s+(.+)/i);
  if (!updateMatch) {
    throw new Error('Office updates not found in update instruction');
  }
  
  const updates = updateMatch[1].trim();
  
  // Get current analysis data
  const currentAnalysis = await firebaseService.getLatestOfficeAnalysis(officeId, 'spain');
  if (!currentAnalysis) {
    throw new Error('No analysis data found for office');
  }
  
  // Parse updates
  const updatePairs = updates.split(',').map(pair => pair.trim());
  const updateData: any = {};
  
  for (const pair of updatePairs) {
    const [key, value] = pair.split(':').map(s => s.trim());
    if (key && value) {
      updateData[key] = value;
    }
  }
  
  // Update the analysis
  const updatedAnalysis = {
    ...currentAnalysis,
    ...updateData,
    lastUpdated: new Date()
  };
  
  await firebaseService.saveOfficeAnalysis(officeId, updatedAnalysis, 'spain');
  
  return {
    action: 'update_office',
    updates: updateData,
    updated: true
  };
}

// Handle delete office instruction
async function handleDeleteOffice(instruction: string, officeId: string, firebaseService: any): Promise<any> {
  // Delete the entire office analysis
  await firebaseService.deleteOfficeAnalysis(officeId, 'analysis_' + Date.now(), 'spain');
  
  return {
    action: 'delete_office',
    officeId,
    deleted: true
  };
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
        max_tokens: 4000,
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

IMPORTANT: This text may contain structured project data with clear sections like CLIENT/OWNER, LOCATION, AREA, INTERVENTION COST, ARCHITECTS, WORK DONE, CAPACITY, DATE, etc. Extract ALL projects from this data, even if they are in a structured format.

Please analyze and categorize the information into these sections:

1. PROJECTS: Extract project information including:
   - Project names (look for project titles in ALL CAPS or clearly marked sections)
   - Project sizes (square meters, area, etc. - look for AREA fields)
   - Project locations (look for LOCATION fields)
   - Use cases (residential, commercial, sports, cultural, etc.)
   - Project descriptions (combine WORK DONE and other descriptive text)
   - Project status (completed, in-progress, planning - infer from dates)
   - Budget/cost information (look for INTERVENTION COST fields)
   - Client information (look for CLIENT/OWNER fields)

2. TEAM: Extract team information including:
   - Team size (number of people, small/medium/large)
   - Specific architect names (look for ARCHITECTS fields)
   - Roles and positions
   - Team structure

3. RELATIONS: Extract relationship information including:
   - Construction companies they work with
   - Other architecture offices they collaborate with
   - Partners and collaborators
   - Business relationships

4. FUNDING: Extract financial information including:
   - Budget information (look for INTERVENTION COST fields)
   - Funding sources
   - Financial details
   - Investment information

5. CLIENTS: Extract client information including:
   - Past clients (look for CLIENT/OWNER fields)
   - Present clients
   - Client types
   - Client industries

CRITICAL: If you see structured data with clear project sections, extract EVERY project as a separate entry. Do not skip any projects. Each project should have its own entry in the projects array.

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
        max_tokens: 4000,
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

    // Process database editing instructions from the input text
    const databaseEditResult = await processDatabaseEditInstructions(processedText, officeId, officeName, officeAddress);

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
      feedback: saveResult?.feedback,
      databaseEditResult
    });

    } catch (error) {
      console.error('Input Analysis error:', error);
      return NextResponse.json(
        { error: 'Failed to analyze office data', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  }
