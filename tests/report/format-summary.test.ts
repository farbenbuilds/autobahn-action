import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { classifyReport } from "../../src/report/classify.ts";
import { buildSummaryDocument, formatSummaryMarkdown } from "../../src/report/format-summary.ts";

import type { FailurePolicy, ReportCase } from "../../src/domain/autobahn.ts";
import type { SummaryDocument } from "../../src/report/format-summary.ts";

const AGENT = "autobahn-action";
const GENERATED_AT = "2026-11-28T12:00:00.000Z";

function createCase(
  id: string,
  behavior: string,
  behaviorClose: string | undefined = undefined,
  reportFile: string | undefined = undefined,
): ReportCase {
  return {
    id,
    behavior,
    behaviorClose,
    durationMs: undefined,
    remoteCloseCode: undefined,
    reportFile,
  };
}

function createDocument(cases: ReportCase[], policy: FailurePolicy = "failed"): SummaryDocument {
  return buildSummaryDocument(classifyReport(cases, policy), AGENT, GENERATED_AT);
}

describe("buildSummaryDocument", () => {
  it("preserves the classification, agent, timestamp, and schema version", () => {
    const classification = classifyReport(
      [createCase("1.1.1", "OK"), createCase("1.1.2", "FAILED")],
      "non-strict",
    );

    const document = buildSummaryDocument(classification, "test-agent", GENERATED_AT);

    assert.equal(document.schemaVersion, 1);
    assert.equal(document.agent, "test-agent");
    assert.equal(document.generatedAt, GENERATED_AT);
    assert.equal(document.policy, "non-strict");
    assert.equal(document.outcome, "failed");
    assert.equal(document.error, undefined);
    assert.deepEqual(document.counts, classification.counts);
    assert.deepEqual(document.cases, classification.cases);
  });

  it("preserves an error message", () => {
    const classification = classifyReport([createCase("1.1.1", "OK")], "failed");

    const document = buildSummaryDocument(
      classification,
      AGENT,
      GENERATED_AT,
      "server did not become ready",
    );

    assert.equal(document.error, "server did not become ready");
  });

  it("is deterministic for a fixed classification and timestamp", () => {
    const classification = classifyReport([createCase("1.1.1", "FAILED")], "failed");

    const first = buildSummaryDocument(classification, AGENT, GENERATED_AT);
    const second = buildSummaryDocument(classification, AGENT, GENERATED_AT);

    assert.deepEqual(first, second);
    assert.equal(formatSummaryMarkdown(first), formatSummaryMarkdown(second));
  });
});

describe("formatSummaryMarkdown", () => {
  it("renders the title, result and policy line, and counts", () => {
    const document = createDocument(
      [
        createCase("1.1.1", "OK"),
        createCase("1.1.2", "INFORMATIONAL"),
        createCase("1.1.3", "FAILED"),
      ],
      "non-strict",
    );

    const markdown = formatSummaryMarkdown(document);

    assert.match(markdown, /^# Autobahn WebSocket report: autobahn-action\n/u);
    assert.match(markdown, /Result: failed\. Policy: non-strict\./u);
    assert.match(markdown, /\| Total \| 3 \|/u);
    assert.match(markdown, /\| Passed \| 1 \|/u);
    assert.match(markdown, /\| Failed \| 1 \|/u);
    assert.match(markdown, /\| Non-strict \| 0 \|/u);
    assert.match(markdown, /\| Informational \| 1 \|/u);
    assert.ok(markdown.endsWith("\n"));
  });

  it("renders an escaped error line after the result and policy", () => {
    const classification = classifyReport([createCase("1.1.1", "FAILED")], "failed");
    const document = buildSummaryDocument(classification, AGENT, GENERATED_AT, "server <failed>");

    const markdown = formatSummaryMarkdown(document);

    assert.match(markdown, /Result: failed\. Policy: failed\.\nError: server &lt;failed&gt;\n/u);
  });

  it("omits the error line when no error is present", () => {
    const document = createDocument([createCase("1.1.1", "OK")]);

    const markdown = formatSummaryMarkdown(document);

    assert.doesNotMatch(markdown, /^Error: /mu);
  });

  it("renders failed and non-strict case tables when present", () => {
    const document = createDocument(
      [createCase("1.1.1", "FAILED"), createCase("1.1.2", "NON-STRICT"), createCase("1.1.3", "OK")],
      "non-strict",
    );

    const markdown = formatSummaryMarkdown(document);

    assert.match(markdown, /## Failed cases/u);
    assert.match(markdown, /\| 1\.1\.1 \| FAILED \| n\/a \| n\/a \| n\/a \| n\/a \|/u);
    assert.match(markdown, /## Non-strict cases/u);
    assert.match(markdown, /\| 1\.1\.2 \| NON-STRICT \| n\/a \| n\/a \| n\/a \| n\/a \|/u);
    assert.doesNotMatch(markdown, /\| 1\.1\.3 \| OK \|/u);
  });

  it("renders duration, remote close code, and report file values", () => {
    const reportCase: ReportCase = {
      id: "1.1.1",
      behavior: "FAILED",
      behaviorClose: "OK",
      durationMs: 12.5,
      remoteCloseCode: 1000,
      reportFile: "1.1.1.json",
    };

    const markdown = formatSummaryMarkdown(createDocument([reportCase]));

    assert.ok(markdown.includes("| 1.1.1 | FAILED | OK | 12.5 | 1000 | 1.1.1.json |"));
  });

  it("escapes pipes and line breaks inside table cells", () => {
    const document = createDocument([
      createCase("1.1.1|bad", "WRONG|bad", "OK|close", "report|file\nnext"),
    ]);

    const markdown = formatSummaryMarkdown(document);

    assert.ok(markdown.includes(String.raw`| 1.1.1\|bad | WRONG\|bad | OK\|close |`));
    assert.ok(markdown.includes(String.raw`report\|file<br>next`));
  });

  it("escapes a backslash before a pipe in a table cell", () => {
    const document = createDocument([createCase("1.1.1", "WRONG", undefined, "report\\|file")]);

    const markdown = formatSummaryMarkdown(document);

    assert.ok(markdown.includes(String.raw`report\\\|file`));
  });

  it("neutralizes HTML and Markdown links in the agent heading", () => {
    const classification = classifyReport([createCase("1.1.1", "OK")], "failed");

    const agents = [
      "<img src=x onerror=alert(1)>",
      "[click](https://example.com)",
      "![x](https://example.com)",
    ];

    for (const agent of agents) {
      const markdown = formatSummaryMarkdown(
        buildSummaryDocument(classification, agent, GENERATED_AT),
      );

      const heading = markdown.split("\n")[0] ?? "";

      assert.doesNotMatch(heading, /</u);
      assert.doesNotMatch(heading, /\[/u);
      assert.doesNotMatch(heading, /\]\(/u);
      assert.doesNotMatch(heading, /!\[/u);
    }

    const ampersandMarkdown = formatSummaryMarkdown(
      buildSummaryDocument(classification, "&lt;script&gt;", GENERATED_AT),
    );

    assert.ok(ampersandMarkdown.includes("&amp;lt;script&amp;gt;"));
  });

  it("sanitizes Markdown structure in the agent heading", () => {
    const classification = classifyReport([createCase("1.1.1", "OK")], "failed");
    const document = buildSummaryDocument(classification, "agent\nname|`**", GENERATED_AT);

    const markdown = formatSummaryMarkdown(document);

    assert.equal(markdown.split("\n")[0], "# Autobahn WebSocket report: agent name\\|\\`\\*\\*");
  });

  it("keeps the agent heading to one line without changing the line count", () => {
    const classification = classifyReport([createCase("1.1.1", "OK")], "failed");
    const unsafeDocument = buildSummaryDocument(classification, "agent\nname", GENERATED_AT);
    const safeDocument = buildSummaryDocument(classification, "agent name", GENERATED_AT);

    const unsafeMarkdown = formatSummaryMarkdown(unsafeDocument);
    const safeMarkdown = formatSummaryMarkdown(safeDocument);

    assert.doesNotMatch(unsafeMarkdown, /agent\nname/u);
    assert.equal(unsafeMarkdown.split("\n")[0], safeMarkdown.split("\n")[0]);
    assert.equal(unsafeMarkdown.split("\n").length, safeMarkdown.split("\n").length);
  });

  it("states plainly when there are no failed or non-strict cases", () => {
    const document = createDocument([
      createCase("1.1.1", "OK"),
      createCase("1.1.2", "INFORMATIONAL"),
    ]);

    const markdown = formatSummaryMarkdown(document);

    assert.match(markdown, /No failed or non-strict cases\./u);
    assert.doesNotMatch(markdown, /## Failed cases/u);
    assert.doesNotMatch(markdown, /## Non-strict cases/u);
  });
});
