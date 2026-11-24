import "dotenv/config";
import app from "./app.js";
import { startReminderScheduler } from "./jobs/reminder.job.js";
import { ensureDefaultSystemSettings } from "./services/system-setting.service.js";

const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST || "0.0.0.0";

app.listen(PORT, HOST, async () => {
  console.log(`Server INVOKS aktif di http://${HOST}:${PORT} (http://localhost:${PORT})`);
  startReminderScheduler();
  try {
    await ensureDefaultSystemSettings();
  } catch (err) {
    console.error("Gagal menginisialisasi default system settings:", (err as Error).message ?? err);
  }
});
