const pino = require("pino");


module.exports = pino({
    level: process.env.LOG_LEVEL || "info",
    base: { service: "payflow-api", env: process.env.APP_ENV || "local" },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: ["req.headers.authorization", "*.cardNumber", "*.cvv"], // never log these
});
