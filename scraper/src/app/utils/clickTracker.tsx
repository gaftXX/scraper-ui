// Utility function for tracking website clicks
export interface ClickTrackingData {
  officeId: string;
  officeName: string;
  website: string;
  sessionId?: string;
}

// Generate a session ID for tracking unique sessions
export function generateSessionId(): string {
  const existingSessionId = sessionStorage.getItem('click_tracking_session_id');
  if (existingSessionId) {
    return existingSessionId;
  }
  
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  sessionStorage.setItem('click_tracking_session_id', sessionId);
  return sessionId;
}

// Track a website click
export async function trackWebsiteClick(data: ClickTrackingData): Promise<void> {
  try {
    const sessionId = generateSessionId();
    
    const response = await fetch('/api/track-click', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...data,
        sessionId
      })
    });

    if (!response.ok) {
      console.error('Failed to track website click:', response.statusText);
    } else {
      console.log('Website click tracked successfully');
    }
  } catch (error) {
    console.error('Error tracking website click:', error);
  }
}

// Create a clickable link with tracking
export function createTrackedLink(
  href: string,
  children: React.ReactNode,
  trackingData: ClickTrackingData,
  className?: string,
  target: string = '_blank',
  rel: string = 'noopener noreferrer'
): JSX.Element {
  const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Track the click
    await trackWebsiteClick(trackingData);
    
    // Open the link in a new tab
    window.open(href, target, 'noopener,noreferrer');
    
    // Prevent default link behavior since we're handling it manually
    e.preventDefault();
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      className={className}
      target={target}
      rel={rel}
      style={{ cursor: 'pointer' }}
    >
      {children}
    </a>
  );
}

// Get click statistics for an office
export async function getClickStats(officeId: string): Promise<any> {
  try {
    const response = await fetch(`/api/track-click?officeId=${officeId}`);
    
    if (!response.ok) {
      throw new Error('Failed to get click statistics');
    }
    
    const data = await response.json();
    return data.stats;
  } catch (error) {
    console.error('Error getting click statistics:', error);
    return null;
  }
}
