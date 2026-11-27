export type SuiteServer = {
  agent: string;
  url: string;
};

export type SuiteConfig = {
  outdir: string;
  servers: SuiteServer[];
  cases: string[];
  "exclude-cases": string[];
  "exclude-agent-cases": Record<string, string[]>;
};

export type SuiteConfigInput = {
  url: string;
  agent: string;
  cases: string[];
  excludeCases: string[];
};

export function buildSuiteConfig(input: SuiteConfigInput): SuiteConfig {
  return {
    outdir: "/reports/servers",
    servers: [{ agent: input.agent, url: input.url }],
    cases: [...input.cases],
    "exclude-cases": [...input.excludeCases],
    "exclude-agent-cases": {},
  };
}

export function serializeSuiteConfig(config: SuiteConfig): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}
