const express = require('express')
const router = express.Router()
const app = express()

const pinoHttp = require("pino-http");
const { randomUUID } = require("crypto");
const logger = require('./logger')
const PORT = process.env.PORT || 3000;  

app.use(express.json());

/**
 * error handlers loggers
 */

app.use(pinoHttp({
  logger,
  genReqId: (req, res) => {
    const id = req.headers["x-request-id"] || randomUUID();
    res.setHeader("x-request-id", id);
    return id;
  },
}));

process.on("SIGTERM", () => { logger.info("SIGTERM, shutting down"); server.close(() => process.exit(0)); });
process.on("unhandledRejection", (e) => { logger.fatal({ err: e }, "Unhandled rejection"); process.exit(1); });
process.on("uncaughtException",  (e) => { logger.fatal({ err: e }, "Uncaught exception");  process.exit(1); });



app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});





app.get("/api/payments", (req, res) => {
  res.json([
    { id: 1, amount: 499, currency: "INR", status: "SUCCESS" },
    { id: 2, amount: 1299, currency: "INR", status: "PENDING" },
  ]);
});

app.get("/config", (req, res) => {
  res.json({
    env: process.env.APP_ENV || "local",
    provider: process.env.PAYMENT_PROVIDER || "none",
  });
});

app.post("/api/payments", async (req, res, next) => {
  try {
    const { amount, currency = "INR" } = req.body;

    if (!amount || amount <= 0) {
      req.log.warn({ amount }, "Invalid payment amount");
      return res.status(400).json({ error: "amount must be greater than 0", requestId: req.id });
    }

    if (amount === 13) throw new Error("Payment gateway timeout"); // simulated failure

    const payment = { id: randomUUID(), amount, currency, status: "SUCCESS" };
    req.log.info({ paymentId: payment.id, amount }, "Payment created");
    res.status(201).json(payment);
  } catch (err) {
    next(err); // send to the central error handler
  }
});


/**
 * central error handler
 */
app.use((req, res) => {   // 404 for unknown routes
  res.status(404).json({ error: "Not found", requestId: req.id });
});

app.use((err, req, res, next) => {   // error handler (4 args = error handler)
  req.log.error({ err }, "Request failed");
  res.status(err.status || 500).json({ error: "Something went wrong", requestId: req.id });
});


const server = app.listen(PORT, () => logger.info({ port: PORT }, "PayFlow started"));