import { NextRequest, NextResponse } from 'next/server';
import { InlookConfig, InlookProgress } from '../../../../inlook-backend/types';

// Import the Inlook scraper
import { InlookScraper } from '../../../../inlook-backend/inlookScraper';

export async function POST(request: NextRequest) {
  try {
    const config: InlookConfig = await request.json();
    
    // Validate required fields
    if (!config.websiteUrl) {
      return NextResponse.json(
        { error: 'Website URL is required' },
        { status: 400 }
      );
    }

    if (!config.claudeApiKey && !process.env.CLAUDE_API_KEY) {
      return NextResponse.json(
        { error: 'Claude API key is required. Set CLAUDE_API_KEY environment variable or pass it in the request.' },
        { status: 400 }
      );
    }

    // Create a readable stream for server-sent events
    const stream = new ReadableStream({
      start(controller) {
        runInlookScraper(config, controller);
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function runInlookScraper(config: InlookConfig, controller: ReadableStreamDefaultController) {
  const encoder = new TextEncoder();
  let controllerClosed = false;
  let inlookScraper: InlookScraper | null = null;
  const startTime = Date.now();
  
  const sendEvent = (type: string, data: any) => {
    try {
      if (!controllerClosed) {
        const message = `data: ${JSON.stringify({ type, ...data })}\n\n`;
        controller.enqueue(encoder.encode(message));
        
        // Debug logging for critical events
        if (type === 'complete') {
          console.log(`Successfully sent '${type}' event to frontend with Inlook results`);
        }
      } else {
        console.log(`Attempted to send '${type}' event but controller is closed`);
      }
    } catch (error) {
      // Controller is already closed, mark it as closed to prevent further attempts
      controllerClosed = true;
      console.error(`Error sending '${type}' event:`, error);
    }
  };
  
  // Capture all console output and stream to frontend
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  
  // Override console.log to capture and stream all messages
  console.log = (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    // Send to frontend only if controller is still open
    if (!controllerClosed) {
      sendEvent('log', { message });
    }
    
    // Also call original console.log for server logs
    originalConsoleLog(...args);
  };
  
  // Override console.error to capture and stream all error messages
  console.error = (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    // Send to frontend with error styling only if controller is still open
    if (!controllerClosed) {
      sendEvent('log', { message: `ERROR: ${message}` });
    }
    
    // Also call original console.error for server logs
    originalConsoleError(...args);
  };

  try {
    console.log(`Starting Inlook scraper for: ${config.websiteUrl}`);
    
    // Create Inlook scraper with progress callback
    inlookScraper = new InlookScraper(config, (progress: InlookProgress) => {
      sendEvent('progress', { progress });
    });
    
    console.log('Inlook scraper initialized successfully');
    
    // Send initial progress
    sendEvent('progress', {
      progress: {
        status: 'starting',
        pagesCrawled: 0,
        currentPhase: 'Initializing Inlook scraper...'
      }
    });
    
    // Run the scraper
    const result = await inlookScraper.scrape();
    
    const totalTime = Math.floor((Date.now() - startTime) / 1000);
    
    console.log(`Inlook scraping completed successfully in ${totalTime}s`);
    console.log(`Found: ${result.office.name}`);
    console.log(`Data quality: ${result.office.dataQuality}`);
    console.log(`Pages analyzed: ${result.metadata.pagesAnalyzed}`);
    console.log(`Confidence: ${result.metadata.confidence}%`);
    
    // Send final results to frontend
    sendEvent('complete', { 
      result: {
        ...result,
        metadata: {
          ...result.metadata,
          totalTime
        }
      }
    });
    
    console.log('Inlook results sent to frontend successfully');
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    sendEvent('error', { error: errorMessage });
    console.error(`Inlook scraping failed:`, error);
  } finally {
    // Close scraper if it exists
    if (inlookScraper) {
      try {
        await inlookScraper.getWebScraper().close();
      } catch (closeError) {
        console.error('Error closing Inlook scraper:', closeError);
      }
    }
    
    // Mark controller as closed to prevent further attempts
    controllerClosed = true;
    
    // Restore original console functions
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    
    try {
      controller.close();
    } catch (error) {
      // Controller already closed, ignore
    }
  }
}
