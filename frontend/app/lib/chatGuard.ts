/**
 * Prevents spamming the Cerebras chat API on errors:
 * - After any error (except payment): 2.5s cooldown before the next call.
 * - On payment/quota (402): block all further calls until page reload.
 */

const COOLDOWN_MS = 2500;

let lastErrorAt = 0;
let paymentErrorBlocked = false;

export function canCallChat(): boolean {
    if (paymentErrorBlocked) return false;
    if (lastErrorAt === 0) return true;
    return Date.now() - lastErrorAt >= COOLDOWN_MS;
}

export function recordChatError(status: number, body?: { code?: string }): void {
    if (status === 402 || body?.code === "PAYMENT_REQUIRED") {
        paymentErrorBlocked = true;
        return;
    }
    lastErrorAt = Date.now();
}

export function recordChatSuccess(): void {
    lastErrorAt = 0;
}

export function isPaymentErrorBlocked(): boolean {
    return paymentErrorBlocked;
}
