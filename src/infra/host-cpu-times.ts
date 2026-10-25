import { readFileSync } from "node:fs";
import { cpus, type CpuInfo } from "node:os";

// /proc/stat counts in USER_HZ, which Linux fixes at 100 for userspace; os.cpus() uses ms.
const PROC_STAT_TICK_MS = 10;
const PROC_STAT_CPU_LINE_RE = /^cpu\d+\s/;

/**
 * Per-CPU times in milliseconds, as os.cpus() reports them. On Linux this reads the
 * same /proc/stat counters directly: os.cpus() also reads each CPU's current frequency
 * from sysfs, which can block for tens of milliseconds per CPU on x86 hosts.
 */
export function readHostCpuTimes(): CpuInfo["times"][] {
  if (process.platform === "linux") {
    const times = readProcStatCpuTimes();
    if (times) {
      return times;
    }
  }
  return cpus().map((cpu) => cpu.times);
}

function readProcStatCpuTimes(): CpuInfo["times"][] | undefined {
  let text: string;
  try {
    text = readFileSync("/proc/stat", "utf8");
  } catch {
    return undefined;
  }
  const times: CpuInfo["times"][] = [];
  for (const line of text.split("\n")) {
    if (!PROC_STAT_CPU_LINE_RE.test(line)) {
      continue;
    }
    // cpuN user nice system idle iowait irq ...; libuv reports the same five fields.
    const [user, nice, sys, idle, , irq] = line.trim().split(/\s+/).slice(1).map(Number);
    times.push({
      user: user! * PROC_STAT_TICK_MS,
      nice: nice! * PROC_STAT_TICK_MS,
      sys: sys! * PROC_STAT_TICK_MS,
      idle: idle! * PROC_STAT_TICK_MS,
      irq: irq! * PROC_STAT_TICK_MS,
    });
  }
  return times.length > 0 ? times : undefined;
}
