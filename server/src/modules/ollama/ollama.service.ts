import prisma from '../../db.js';
import http from 'http';
import https from 'https';
import { URL } from 'url';

export class OllamaService {
  private static defaultEndpoint = 'http://127.0.0.1:11434';

  public static async getEndpoint(): Promise<string> {
    try {
      const setting = await prisma.systemSetting.findUnique({
        where: { key: 'ollama_endpoint' },
      });
      return setting?.value || this.defaultEndpoint;
    } catch {
      return this.defaultEndpoint;
    }
  }

  public static async setEndpoint(endpoint: string): Promise<void> {
    await prisma.systemSetting.upsert({
      where: { key: 'ollama_endpoint' },
      update: { value: endpoint },
      create: { key: 'ollama_endpoint', value: endpoint, description: 'Ollama local API endpoint' },
    });
  }

  public static async getSelectedModel(): Promise<string> {
    try {
      const setting = await prisma.systemSetting.findUnique({
        where: { key: 'ollama_default_model' },
      });
      return setting?.value || 'qwen2.5-coder:latest';
    } catch {
      return 'qwen2.5-coder:latest';
    }
  }

  public static async setSelectedModel(model: string): Promise<void> {
    await prisma.systemSetting.upsert({
      where: { key: 'ollama_default_model' },
      update: { value: model },
      create: { key: 'ollama_default_model', value: model, description: 'Default Ollama Model' },
    });
  }

  public static async checkStatus(): Promise<{
    online: boolean;
    endpoint: string;
    activeModel: string;
    effectiveModel: string;
    availableModels: string[];
    error?: string;
  }> {
    const endpoint = await this.getEndpoint();
    const activeModel = await this.getSelectedModel();

    try {
      const tagsData = await this.fetchJson(`${endpoint}/api/tags`, 2500);
      const models: string[] = (tagsData.models || []).map((m: any) => m.name || m.model);

      // The configured model may not be pulled; report the tag that will
      // actually be used so the UI never claims a missing model is active.
      const effectiveModel =
        models.find((m) => m === activeModel) ||
        models.find((m) => m.split(':')[0] === activeModel.split(':')[0]) ||
        models[0] ||
        activeModel;

      return {
        online: true,
        endpoint,
        activeModel,
        effectiveModel,
        availableModels: models,
      };
    } catch (err: any) {
      return {
        online: false,
        endpoint,
        activeModel,
        effectiveModel: activeModel,
        availableModels: [],
        error: `Ollama is not responding at ${endpoint}. Make sure 'ollama serve' is running. (${err.message || 'connection refused'})`,
      };
    }
  }

  public static async listModels(): Promise<any[]> {
    const endpoint = await this.getEndpoint();
    try {
      const tagsData = await this.fetchJson(`${endpoint}/api/tags`, 4000);
      return tagsData.models || [];
    } catch (err: any) {
      return [];
    }
  }

  private static modelCache: { at: number; models: string[] } | null = null;

  /**
   * The configured model may not be installed locally. Prefer it when present,
   * otherwise fall back to the closest installed tag so AI features still run.
   */
  private static async resolveModel(preferred?: string): Promise<string> {
    const wanted = preferred || (await this.getSelectedModel());
    const now = Date.now();

    if (!this.modelCache || now - this.modelCache.at > 30_000) {
      try {
        const models = await this.listModels();
        const names: string[] = (models || [])
          .map((m: any) => m.name || m.model)
          .filter((m: any) => typeof m === 'string' && m.length > 0);
        this.modelCache = { at: now, models: names };
      } catch {
        this.modelCache = { at: now, models: [] };
      }
    }

    const available = this.modelCache.models;
    if (available.length === 0) return wanted;

    const exact = available.find((m) => m === wanted);
    if (exact) return exact;

    const base = wanted.split(':')[0];
    const sameFamily = available.find((m) => m.split(':')[0] === base);
    return sameFamily || available[0];
  }

  public static async generateDetailed(
    prompt: string,
    model?: string,
    systemPrompt?: string,
    opts: { timeoutMs?: number; json?: boolean } = {}
  ): Promise<{ text: string; model: string }> {
    const endpoint = await this.getEndpoint();
    const targetModel = await this.resolveModel(model);

    const payload: any = {
      model: targetModel,
      prompt,
      system: systemPrompt,
      stream: false,
      options: {
        temperature: 0.2,
      },
    };

    // Ollama's JSON mode sharply improves structured plan output from small models.
    if (opts.json) payload.format = 'json';

    const response = await this.postJson(
      `${endpoint}/api/generate`,
      payload,
      opts.timeoutMs ?? 60000
    );

    return { text: response.response || '', model: targetModel };
  }

  public static async generate(prompt: string, model?: string, systemPrompt?: string): Promise<string> {
    const result = await this.generateDetailed(prompt, model, systemPrompt);
    return result.text;
  }

  private static fetchJson(urlStr: string, timeoutMs = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(urlStr);
      const client = parsed.protocol === 'https:' ? https : http;

      const req = client.get(
        urlStr,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: timeoutMs,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                resolve(JSON.parse(data));
              } else {
                reject(new Error(`HTTP ${res.statusCode}: ${data}`));
              }
            } catch (e) {
              reject(e);
            }
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Connection timed out'));
      });

      req.on('error', (err) => reject(err));
    });
  }

  private static postJson(urlStr: string, payload: any, timeoutMs = 60000): Promise<any> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(urlStr);
      const client = parsed.protocol === 'https:' ? https : http;
      const dataStr = JSON.stringify(payload);

      const req = client.request(
        urlStr,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(dataStr),
          },
          timeout: timeoutMs,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                resolve(JSON.parse(data));
              } else {
                reject(new Error(`HTTP ${res.statusCode}: ${data}`));
              }
            } catch (e) {
              reject(e);
            }
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });

      req.on('error', (err) => reject(err));
      req.write(dataStr);
      req.end();
    });
  }
}
