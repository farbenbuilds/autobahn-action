import { error, warning } from "@actions/core";

import type { ClassifiedCase, FailurePolicy, ReportClassification } from "../domain/autobahn.ts";

export type Annotation = {
  level: "error" | "warning";
  title: string;
  message: string;
};

export const MAX_ANNOTATIONS = 50;

const FAILED_TITLE = "Autobahn case failed";
const NON_STRICT_TITLE = "Autobahn non-strict case";

function sanitizeMessage(value: string): string {
  return value.replace(/\r\n|\r|\n/gu, " ");
}

function formatCaseMessage(reportCase: ClassifiedCase): string {
  const behaviorClose =
    reportCase.behaviorClose === undefined ? "not reported" : reportCase.behaviorClose;

  return sanitizeMessage(
    `Case ${reportCase.id}: behavior ${reportCase.behavior}, behavior close ${behaviorClose}.`,
  );
}

export function buildAnnotations(
  classification: ReportClassification,
  policy: FailurePolicy,
): Annotation[] {
  const annotations: Annotation[] = [];

  for (const reportCase of classification.failedCases) {
    if (annotations.length >= MAX_ANNOTATIONS) {
      return annotations;
    }

    annotations.push({
      level: "error",
      title: FAILED_TITLE,
      message: formatCaseMessage(reportCase),
    });
  }

  if (policy !== "non-strict") {
    return annotations;
  }

  for (const reportCase of classification.nonStrictCases) {
    if (annotations.length >= MAX_ANNOTATIONS) {
      break;
    }

    annotations.push({
      level: "warning",
      title: NON_STRICT_TITLE,
      message: formatCaseMessage(reportCase),
    });
  }

  return annotations;
}

export function publishAnnotations(annotations: Annotation[]): void {
  for (const annotation of annotations) {
    if (annotation.level === "error") {
      error(annotation.message, { title: annotation.title });
      continue;
    }

    warning(annotation.message, { title: annotation.title });
  }
}
