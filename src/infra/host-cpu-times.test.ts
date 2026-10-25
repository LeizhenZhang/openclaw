import { readFileSync } from "node:fs";
import { cpus } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readHostCpuTimes } from "./host-cpu-times.js";

vi.mock("node:fs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs")>()),
  readFileSync: vi.fn(),
}));
vi.mock("node:os", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:os")>()),
  cpus: vi.fn(),
}));

const osTimes = { user: 1, nice: 2, sys: 3, idle: 4, irq: 5 };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(readFileSync).mockReset();
  vi.mocked(cpus).mockReset();
});

function onPlatform(platform: NodeJS.Platform) {
  vi.stubGlobal("process", { ...process, platform });
  vi.mocked(cpus).mockReturnValue([{ model: "test", speed: 1, times: osTimes }]);
}

describe("readHostCpuTimes", () => {
  it("reads per-CPU counters from /proc/stat on Linux without os.cpus()", () => {
    onPlatform("linux");
    vi.mocked(readFileSync).mockReturnValue(
      [
        "cpu  30 4 10 900 7 2 1 0 0 0",
        "cpu0 10 1 4 400 3 1 1 0 0 0",
        "cpu1 20 3 6 500 4 1 0 0 0 0",
        "intr 12345",
      ].join("\n"),
    );
    expect(readHostCpuTimes()).toEqual([
      { user: 100, nice: 10, sys: 40, idle: 4000, irq: 10 },
      { user: 200, nice: 30, sys: 60, idle: 5000, irq: 10 },
    ]);
    expect(cpus).not.toHaveBeenCalled();
  });

  it("falls back to os.cpus() when /proc/stat is unreadable or has no CPU lines", () => {
    onPlatform("linux");
    vi.mocked(readFileSync).mockImplementationOnce(() => {
      throw new Error("EACCES");
    });
    expect(readHostCpuTimes()).toEqual([osTimes]);
    vi.mocked(readFileSync).mockReturnValueOnce("intr 1\n");
    expect(readHostCpuTimes()).toEqual([osTimes]);
  });

  it("uses os.cpus() on other platforms", () => {
    onPlatform("darwin");
    expect(readHostCpuTimes()).toEqual([osTimes]);
    expect(readFileSync).not.toHaveBeenCalled();
  });
});
