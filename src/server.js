import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import { secureAccess } from "./middleware/secure.js";
import { usersRouter } from "./api/users.js";
import { keysRouter } from "./api/keys.js";
import { tradesRouter } from "./api/trades.js";
import { withdrawRouter } from "./api/withdraw.js";
import { adminRouter } from "./api/admin.js";
import { marketsRouter } from "./api/markets.js";
import { log } from "./utils/logger.js";

dotenv.config();
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "../public")));

app.use("/api/keys", secureAccess, keysRouter);
app.use("/api/users", secureAccess, usersRouter);
app.use("/api/trades", secureAccess, tradesRouter);
app.use("/api/withdraw", secureAccess, withdrawRouter);
app.use("/api/admin", adminRouter);
app.use("/api/markets", marketsRouter);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => log(`🚀 QL Trading AI running on port ${PORT}`));
