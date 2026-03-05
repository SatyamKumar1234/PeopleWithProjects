// Honeypot integration for PWP auth pages
// This file re-exports the honeypot module for easy import within the Next.js app

export { HoneypotProvider, useHoneypot, HoneypotField, quickCheck } from '../../ssl-honeypot/index';
