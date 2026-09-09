import dotenv from 'dotenv';
dotenv.config();

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  provider: string;
  model: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export interface LLMClientOptions {
  provider?: 'gemini' | 'openai' | 'anthropic' | 'mock';
  apiKey?: string;
  model?: string;
}

export class LLMClient {
  private provider: 'gemini' | 'openai' | 'anthropic' | 'mock';
  private apiKey: string;
  private model: string;
  private typedMemberId = false;
  private submittedSearch = false;
  private selectedAccount = false;

  constructor(options: LLMClientOptions = {}) {
    if (options.provider) {
      this.provider = options.provider;
    } else if (process.env.GEMINI_API_KEY) {
      this.provider = 'gemini';
    } else if (process.env.OPENAI_API_KEY) {
      this.provider = 'openai';
    } else if (process.env.ANTHROPIC_API_KEY) {
      this.provider = 'anthropic';
    } else {
      this.provider = 'mock';
    }

    this.apiKey =
      options.apiKey ||
      process.env.GEMINI_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      '';

    if (options.model) {
      this.model = options.model;
    } else {
      switch (this.provider) {
        case 'gemini':
          this.model = 'gemini-2.5-flash';
          break;
        case 'openai':
          this.model = 'gpt-4o';
          break;
        case 'anthropic':
          this.model = 'claude-3-5-sonnet-20241022';
          break;
        case 'mock':
        default:
          this.model = 'offline-heuristic-engine';
          break;
      }
    }
  }

  public getProvider(): string {
    return this.provider;
  }

  public getModel(): string {
    return this.model;
  }

  public async complete(messages: LLMMessage[]): Promise<LLMResponse> {
    if (this.provider === 'gemini') {
      return this.completeGemini(messages);
    } else if (this.provider === 'openai') {
      return this.completeOpenAI(messages);
    } else if (this.provider === 'anthropic') {
      return this.completeAnthropic(messages);
    } else {
      return this.completeMock(messages);
    }
  }

  private async completeGemini(messages: LLMMessage[]): Promise<LLMResponse> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

    const systemInstruction = messages.find((m) => m.role === 'system')?.content;

    const body: any = {
      contents,
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    };

    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text || '{}';

    return {
      content: text,
      provider: 'gemini',
      model: this.model,
      usage: data.usageMetadata
    };
  }

  private async completeOpenAI(messages: LLMMessage[]): Promise<LLMResponse> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return {
      content: data.choices?.[0]?.message?.content || '{}',
      provider: 'openai',
      model: this.model,
      usage: data.usage
    };
  }

  private async completeAnthropic(messages: LLMMessage[]): Promise<LLMResponse> {
    const system = messages.find((m) => m.role === 'system')?.content;
    const userMessages = messages.filter((m) => m.role !== 'system');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.model,
        system,
        messages: userMessages.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: 2048,
        temperature: 0.1
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return {
      content: data.content?.[0]?.text || '{}',
      provider: 'anthropic',
      model: this.model
    };
  }

  /**
   * Offline intelligent heuristic engine for zero-cost testing and automated verification.
   */
  private async completeMock(messages: LLMMessage[]): Promise<LLMResponse> {
    const lastUser = messages[messages.length - 1]?.content || '';

    // 1. If an interstitial is active on the page
    if (lastUser.includes('System Notice: Scheduled Maintenance') || lastUser.includes('Acknowledge & Dismiss')) {
      return {
        content: JSON.stringify({
          thought: 'Detected a blocking maintenance interstitial dialog. I must acknowledge and dismiss it to proceed with the member search.',
          action: 'CLICK',
          target: {
            strategy: 'accessibility',
            role: 'button',
            name: 'Acknowledge & Dismiss'
          },
          intent: 'Dismiss maintenance interstitial alert'
        }),
        provider: 'mock',
        model: 'offline-heuristic-engine'
      };
    }

    // 2. On Dashboard -> Navigate to Member Search
    if (lastUser.includes('CURRENT URL: http') && (lastUser.includes('/dashboard') || !lastUser.includes('/members'))) {
      return {
        content: JSON.stringify({
          thought: 'Currently on the main dashboard. Navigating to the Member Search directory.',
          action: 'CLICK',
          target: {
            strategy: 'accessibility',
            role: 'link',
            name: 'Member Search'
          },
          intent: 'Navigate to Member Search directory'
        }),
        provider: 'mock',
        model: 'offline-heuristic-engine'
      };
    }

    // 3. In Member Search -> If member ID not yet entered, type 10042
    if (lastUser.includes('/members') && !lastUser.includes('/members/') && !lastUser.includes('Sarah Connor') && !this.typedMemberId) {
      this.typedMemberId = true;
      return {
        content: JSON.stringify({
          thought: 'On the Member Search directory. Locating the Member ID search input and entering member ID 10042.',
          action: 'TYPE',
          target: {
            strategy: 'accessibility',
            role: 'textbox',
            name: 'Member ID or SSN'
          },
          value: '10042',
          intent: 'Input member ID into search field'
        }),
        provider: 'mock',
        model: 'offline-heuristic-engine'
      };
    }

    // 4. In Member Search -> If typed but not yet submitted
    if (lastUser.includes('/members') && !lastUser.includes('/members/') && !lastUser.includes('Sarah Connor') && this.typedMemberId && !this.submittedSearch) {
      this.submittedSearch = true;
      return {
        content: JSON.stringify({
          thought: 'Submitting the search query by clicking Search Directory.',
          action: 'CLICK',
          target: {
            strategy: 'accessibility',
            role: 'button',
            name: 'Search Directory'
          },
          intent: 'Submit member search form'
        }),
        provider: 'mock',
        model: 'offline-heuristic-engine'
      };
    }

    // 5. On Search Results -> Click View Accounts
    if (lastUser.includes('Sarah Connor') && !lastUser.includes('/members/10042') && (lastUser.includes('View Accounts') || lastUser.includes('Search Results'))) {
      return {
        content: JSON.stringify({
          thought: 'Member 10042 found in search results. Clicking View Accounts to open member profile.',
          action: 'CLICK',
          target: {
            strategy: 'accessibility',
            role: 'link',
            name: 'View Accounts'
          },
          intent: 'Select member from results and open account list'
        }),
        provider: 'mock',
        model: 'offline-heuristic-engine'
      };
    }

    // 6. In Member Profile (/members/10042) -> Select Savings Account
    if (lastUser.includes('/members/10042') && !lastUser.includes('/accounts/SAV-3021') && !this.selectedAccount) {
      this.selectedAccount = true;
      return {
        content: JSON.stringify({
          thought: 'Viewing member accounts for Sarah Connor. Locating High-Yield Member Savings (SAV-3021) and opening details.',
          action: 'CLICK',
          target: {
            strategy: 'accessibility',
            role: 'link',
            name: 'Inspect High-Yield Member Savings details'
          },
          intent: 'Open Savings Account ledger detail'
        }),
        provider: 'mock',
        model: 'offline-heuristic-engine'
      };
    }

    // 7. On Savings Ledger (/accounts/SAV-3021) -> Extract outputs and finish
    if (lastUser.includes('/accounts/SAV-3021') || lastUser.includes('Current Ledger Balance') || lastUser.includes('Account Ledger: High-Yield Member Savings')) {
      return {
        content: JSON.stringify({
          thought: 'Successfully reached the savings account detail ledger. Extracting current balance, available balance, and status.',
          action: 'EXTRACT',
          outputs: {
            member_id: '10042',
            member_name: 'Sarah Connor',
            account_id: 'SAV-3021',
            savings_balance: 18450.25,
            available_balance: 18250.25,
            account_status: 'ACTIVE'
          },
          is_goal_met: true,
          intent: 'Extract member savings balance and finalize capability'
        }),
        provider: 'mock',
        model: 'offline-heuristic-engine'
      };
    }

    return {
      content: JSON.stringify({
        thought: 'Default step completion.',
        action: 'WAIT',
        intent: 'Observe page state'
      }),
      provider: 'mock',
      model: 'offline-heuristic-engine'
    };
  }
}
