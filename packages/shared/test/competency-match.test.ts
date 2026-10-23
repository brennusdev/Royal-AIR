import { describe, expect, it } from "vitest";
import { compareCompetencyEvidence } from "../src/index.js";

describe("compareCompetencyEvidence", () => {
  it("shows reviewed, demonstrated competencies and keeps missing evidence explicit", () => {
    const result = compareCompetencyEvidence(
      ["http", "sql", "testing"],
      [
        { slug: "http", status: "reviewed", level: "demonstrated" },
        { slug: "sql", status: "self_reported", level: "strong_evidence" },
        { slug: "testing", status: "reviewed", level: "developing" }
      ]
    );

    expect(result.demonstrated).toEqual(["http"]);
    expect(result.notDemonstrated).toEqual(["sql", "testing"]);
    expect(result.note).toContain("não indicam falta de capacidade");
  });

  it("does not duplicate requirements", () => {
    const result = compareCompetencyEvidence(["git", "git"], [
      { slug: "git", status: "reviewed", level: "strong_evidence" }
    ]);

    expect(result.demonstrated).toEqual(["git"]);
    expect(result.notDemonstrated).toEqual([]);
  });
});
