import { SearchResult } from '../types';

// Serper is a Google Search API provider. It requires an API key.
// The app will try to use it if SERPER_API_KEY is available in the environment.
const SERPER_API_KEY = (process.env as any).SERPER_API_KEY;
const SERPER_API_URL = 'https://google.serper.dev/search';

// DuckDuckGo provides a free, but unofficial and limited, JSON API.
// It serves as a fallback if Serper is unavailable.
const DUCKDUCKGO_API_URL = 'https://api.duckduckgo.com/';

// == Serper API Types and Parser ==
interface SerperResult {
  title: string;
  link: string;
  snippet: string;
}

interface SerperResponse {
  organic: SerperResult[];
}

function parseSerperResponse(data: SerperResponse, page: number): SearchResult[] {
    if (!data.organic || data.organic.length === 0) {
        return [];
    }

    return data.organic
        .filter(result => result.link && result.title)
        .map((result, index): SearchResult => ({
            id: `${result.link}-${page}-${index}`,
            url: result.link,
            title: result.title,
            snippet: result.snippet || 'No snippet available.',
            isExplicit: false,
        }));
}

// == DuckDuckGo API Types and Parser ==
interface DuckDuckGoTopic {
    Result: string;
    FirstURL: string;
    Text: string;
}

interface DuckDuckGoResponse {
    Abstract: string;
    AbstractText: string;
    AbstractSource: string;
    AbstractURL: string;
    Heading: string;
    RelatedTopics: DuckDuckGoTopic[];
}

function parseDuckDuckGoResponse(data: DuckDuckGoResponse, page: number): SearchResult[] {
    const results: SearchResult[] = [];

    // Check for a primary "Abstract" result (like a Wikipedia summary) on the first page
    if (page === 1 && data.AbstractURL && data.Heading && data.AbstractText) {
        results.push({
            id: `${data.AbstractURL}-${page}-abstract`,
            url: data.AbstractURL,
            title: `${data.Heading} (${data.AbstractSource})`,
            snippet: data.AbstractText,
            isExplicit: false,
        });
    }
    
    // DDG nests results in RelatedTopics. We only want topics that are actual results (have a FirstURL)
    const topics = data.RelatedTopics?.filter(topic => topic.FirstURL) || [];

    topics.forEach((result, index) => {
        // The 'Text' field often contains "Title - Snippet". We split it.
        const textParts = result.Text.split(' - ');
        const title = textParts[0];
        const snippet = textParts.length > 1 ? textParts.slice(1).join(' - ') : 'No snippet available.';

        // Avoid duplicates if the abstract was already added
        if (!results.some(r => r.url === result.FirstURL)) {
             results.push({
                id: `${result.FirstURL}-${page}-${index}`,
                url: result.FirstURL,
                title: title,
                snippet: snippet,
                isExplicit: false,
            });
        }
    });
    
    return results;
}


export const fetchResults = async (query: string, page: number = 1): Promise<SearchResult[]> => {
  // --- Primary: Try Serper API if key is available ---
  if (SERPER_API_KEY) {
    console.log(`Fetching web results from Serper for: "${query}", page: ${page}`);
    try {
      const response = await fetch(SERPER_API_URL, {
        method: 'POST',
        headers: {
          'X-API-KEY': SERPER_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          q: query,
          page: page
        })
      });
      
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Serper API request failed with status ${response.status}: ${errorBody}`);
      }
      
      const data: SerperResponse = await response.json();
      return parseSerperResponse(data, page);

    } catch (error) {
      console.warn("Serper API call failed, falling back to DuckDuckGo.", error);
      // Fall through to DuckDuckGo
    }
  }

  // --- Fallback: Use DuckDuckGo API ---
  // Note: DDG's API does not support pagination. 'page' param > 1 will return the same results.
  if (page > 1) {
    console.log("DuckDuckGo API does not support pagination, returning empty results for subsequent pages.");
    return [];
  }

  console.log(`Fetching web results from DuckDuckGo for: "${query}"`);
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    t: 'nexus-search-app', // per DDG API docs, good practice to set a user agent
  });
  
  try {
    const response = await fetch(`${DUCKDUCKGO_API_URL}?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`DuckDuckGo API request failed with status ${response.status}`);
    }
    
    const data: DuckDuckGoResponse = await response.json();
    return parseDuckDuckGoResponse(data, page);

  } catch (error) {
    console.error("Error fetching web search results from DuckDuckGo:", error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error("Network error or CORS issue connecting to the DuckDuckGo API. The service may be temporarily down.");
    }
    throw new Error("Failed to fetch web search results from all available APIs.");
  }
};