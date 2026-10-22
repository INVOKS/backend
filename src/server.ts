import "dotenv/config";
import app from "./app.js";

const PORT = Number(process.env.PORT || 5000);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server INVOKS aktif di http://0.0.0.0:${PORT} (http://localhost:${PORT})`);
});
