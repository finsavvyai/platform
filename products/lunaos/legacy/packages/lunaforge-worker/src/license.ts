import { nanoid } from "nanoid";

export interface LicenseRecord {
  key: string;
  plan: "free" | "pro" | "enterprise";
  email: string;
  expires: string | null;
  createdAt: string;
}

export class LicenseService {
  constructor(private env: any) {}

  async generateLicense(email: string, plan: string, expires: string | null) {
    const key = this.createKey(plan);

    const rec: LicenseRecord = {
      key,
      plan: plan as any,
      email,
      expires,
      createdAt: new Date().toISOString()
    };

    await this.env.LUNAFORGE_KV.put(`license:${key}`, JSON.stringify(rec));

    return rec;
  }

  async validateLicense(key: string) {
    const raw = await this.env.LUNAFORGE_KV.get(`license:${key}`);
    if (!raw) {
      return { valid: false, reason: "not_found" };
    }

    const license = JSON.parse(raw) as LicenseRecord;

    if (license.expires && new Date(license.expires) < new Date()) {
      return { valid: false, reason: "expired" };
    }

    return {
      valid: true,
      plan: license.plan,
      features: this.featuresForPlan(license.plan)
    };
  }

  featuresForPlan(plan: string) {
    if (plan === "enterprise") {
      return ["galaxy", "dream", "parallel-universe", "autopsy", "composer", "guardian"];
    }
    if (plan === "pro") {
      return ["galaxy", "dream", "composer"];
    }
    return [];
  }

  createKey(plan: string) {
    const segment = () => nanoid(5).toUpperCase();
    return `LF-${plan.toUpperCase()}-${segment()}-${segment()}-${segment()}`;
  }
}