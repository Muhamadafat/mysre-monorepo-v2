import { describe, expect, it } from "vitest";
import { reconcileCompletion } from "./copilotText";

const sent = "analisis statistik. ";

describe("reconcileCompletion", () => {
  it("keeps the suggestion when nothing was typed meanwhile", () => {
    expect(reconcileCompletion(sent, sent, "dimana data diolah")).toBe("dimana data diolah");
  });

  it("drops the part typed while waiting (whole word + space)", () => {
    expect(reconcileCompletion(sent, sent + "dimana ", "dimana data diolah")).toBe("data diolah");
  });

  it("continues a half-typed word without a space", () => {
    expect(reconcileCompletion(sent, sent + "diman", "dimana data diolah")).toBe("a data diolah");
  });

  it("drops the suggestion when the writer typed something else", () => {
    expect(reconcileCompletion(sent, sent + "sehingga ", "dimana data diolah")).toBeNull();
  });

  it("drops it when earlier text changed", () => {
    expect(reconcileCompletion(sent, "analisis data. dimana ", "dimana data")).toBeNull();
  });

  it("ignores case and leading space of the model output", () => {
    expect(reconcileCompletion(sent, sent + "Dimana ", " dimana data diolah")).toBe("data diolah");
  });
});
