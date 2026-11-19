import { runReminderJob } from "../services/notification.service.js";

const REMINDER_JOB_INTERVAL_MS =
  Number(process.env.REMINDER_JOB_INTERVAL_MS) || 15 * 60 * 1000;
const REMINDER_JOB_ENABLED = process.env.REMINDER_JOB_ENABLED !== "false";

let timer: NodeJS.Timeout | null = null;
let isRunning = false;

async function executeJob(): Promise<void> {
  if (isRunning) {
    console.log("[ReminderJob] Job sebelumnya masih berjalan, lewati siklus ini.");
    return;
  }
  isRunning = true;
  try {
    await runReminderJob();
  } catch (err) {
    console.error("[ReminderJob] Terjadi kesalahan pada reminder job:", err);
  } finally {
    isRunning = false;
  }
}

export function startReminderScheduler(): void {
  if (!REMINDER_JOB_ENABLED) {
    console.log("[ReminderJob] Reminder job dinonaktifkan via konfigurasi.");
    return;
  }

  console.log(
    `[ReminderJob] Memulai reminder scheduler (interval: ${REMINDER_JOB_INTERVAL_MS} ms)...`
  );

  // Jalankan siklus pertama saat startup (non-blocking)
  void executeJob();

  // Jadwalkan siklus berkala
  timer = setInterval(() => {
    void executeJob();
  }, REMINDER_JOB_INTERVAL_MS);
}

export function stopReminderScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log("[ReminderJob] Reminder scheduler dihentikan.");
  }
}
