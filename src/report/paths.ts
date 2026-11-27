import { isAbsolute, join, resolve } from "node:path";

export type RunPaths = {
  reportDir: string;
  configFile: string;
  indexFile: string;
  summaryFile: string;
  markdownFile: string;
};

export function resolveRunPaths(cwd: string, reportDir: string): RunPaths {
  const resolvedReportDir = isAbsolute(reportDir) ? reportDir : resolve(cwd, reportDir);

  return {
    reportDir: resolvedReportDir,
    configFile: join(resolvedReportDir, "fuzzingclient.json"),
    indexFile: join(resolvedReportDir, "servers", "index.json"),
    summaryFile: join(resolvedReportDir, "summary.json"),
    markdownFile: join(resolvedReportDir, "summary.md"),
  };
}
