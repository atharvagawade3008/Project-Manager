import prisma from '../../db.js';

export class SettingsService {
  public static async getAllSettings() {
    const settings = await prisma.systemSetting.findMany();
    const map: Record<string, string> = {};
    for (const s of settings) {
      map[s.key] = s.value;
    }
    return {
      ollama_endpoint: map['ollama_endpoint'] || 'http://127.0.0.1:11434',
      ollama_default_model: map['ollama_default_model'] || 'qwen2.5-coder:latest',
      theme: map['theme'] || 'dark',
      scan_exclusions: map['scan_exclusions'] || 'node_modules, .git, dist, build, coverage, .next, vendor, cache',
      max_file_size_kb: map['max_file_size_kb'] || '500',
    };
  }

  public static async updateSettings(updates: Record<string, string>) {
    for (const [key, value] of Object.entries(updates)) {
      await prisma.systemSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }
    return this.getAllSettings();
  }
}
