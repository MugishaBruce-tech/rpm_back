# Security Architecture White Paper: BRARUDI RPM Tracker

This document outlines the security posture of the BRARUDI BPM Tracker application, documenting common cyber threats and the specific engineering measures implemented to mitigate them.

## 1. Executive Summary
The RPM Tracker implements a multi-layered security architecture based on the **STRIDE** (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, & Elevation of Privilege) threat model. Key defenses include HttpOnly cookie-based authentication, strict role-based access control (RBAC), and centralized audit logging.

---

## 2. Threat Modeling & Mitigations (STRIDE Breakdown)

### **S — Spoofing (Identity Theft)**
**The Threat:** An attacker pretends to be a legitimate user to gain unauthorized access.
*   **Protection Measure 1 (Multi-Factor Authentication):** All logins require a secondary verification code (OTP via Email or Google Authenticator), ensuring that a compromised password alone is insufficient for access.
*   **Protection Measure 2 (Secure Password Hashing):** Passwords are never stored in plain text. We utilize `bcrypt` with a cost factor of 10 to protect against "rainbow table" or dictionary attacks.
*   **Protection Measure 3 (HttpOnly Cookies):** JWT tokens are transmitted via `HttpOnly` and `Secure` cookies. This makes it impossible for malicious JavaScript (even from a successful XSS attack) to "steal" the session token.

### **T — Tampering (Data Alteration)**
**The Threat:** An attacker modifies requests or database entries to change business logic (e.g., altering stock counts).
*   **Protection Measure 1 (Zod Schema Validation):** Every incoming request is validated against a strict schema. If a user tries to send a negative stock number or an invalid region name, the server rejects it at the gate (`422 Unprocessable Entity`).
*   **Protection Measure 2 (ORM Parameterization):** By using the `Sequelize` ORM, all database queries are automatically parameterized, completely neutralizing **SQL Injection (SQLi)** attacks.
*   **Protection Measure 3 (CORS Enforcement):** The API is locked to only respond to requests from specific, trusted frontend domains (e.g., your production dashboard).

### **R — Repudiation (Denial of Action)**
**The Threat:** A user performs an action (e.g., deleting a loan) and later denies having done so.
*   **Protection Measure 1 (Audit Logging Middleware):** The `auditLogger.js` middleware captures every mutation (POST, PUT, DELETE) in the system, logging the User ID, timestamp, IP address, and exact payload for forensic review.
*   **Protection Measure 2 (Append-Only Logs):** The system provides no endpoint to modify or delete logs, ensuring a permanent and immutable history of actions.

### **I — Information Disclosure (Data Leakage)**
**The Threat:** Sensitive data (e.g., internal user details or database errors) is exposed to an unauthorized party.
*   **Protection Measure 1 (Regional/Role Scoping):** The `authorize.js` middleware enforces "data isolation." A Sub-Distributor (SUB_D) or Regional Manager (DDM) can only "see" data within their assigned scope.
*   **Protection Measure 2 (Global Error Handling):** Detailed server stack traces and raw database errors are masked. Users see a generic "Internal Server Error" message, preventing attackers from "mapping" the system architecture through error messages.
*   **Protection Measure 3 (Attribute Filtering):** All API responses explicitly list allowed fields (e.g., `attributes: ['id', 'name']`), ensuring sensitive fields like passwords or hashed secrets are never transmitted.

### **D — Denial of Service (Availability Attack)**
**The Threat:** An attacker overwhelms the server with thousands of requests, crashing the app for legitimate users.
*   **Protection Measure 1 (Global Rate Limiting):** Every IP address is limited to 100 requests per 15 minutes to prevent basic flooding attacks.
*   **Protection Measure 2 (Strict Auth Limiter):** Sensitive endpoints (Login/OTP) are limited to **10 attempts per 15 minutes**, preventing brute-force password guessing and SMS/Email flooding.

### **E — Elevation of Privilege (Illegal Permissions)**
**The Threat:** A low-level user attempts to gain administrative permissions.
*   **Protection Measure 1 (RBAC Verification):** Every sensitive route is protected by the `authorize(...)` middleware, which checks for granular permission codes (e.g., `USER_CREATE_ALL`).
*   **Protection Measure 2 (Logic Guarding):** Even if an attacker "guesses" an edit URL, the backend explicitly verifies that the user has the right to edit that specific user or region before committing the change.

---

## 3. High-Level Security Infrastructure

| Layer | Technical Implementation |
| :--- | :--- |
| **Transport** | Enforced HTTPS (recommended) and Helmet.js headers (X-Frame-Options, CSP, HSTS). |
| **Authentication** | Two-Factor Authentication (2FA) + HttpOnly/Secure Refresh Tokens. |
| **Authorization** | Centralized `authorize()` middleware with "Role + Region" scoping. |
| **Input** | `Zod` Schema-based validation for all API inputs. |
| **Logging** | ISO-compliant `AuditLog` table capturing all state changes. |

## 4. Conclusion
The BRARUDI RPM Tracker is engineered for **Security by Design**. By moving away from traditional state-less tokens (stored in localStorage) to **HttpOnly Cookies**, and by implementing strict **Rate Limiting** and **Input Validation**, the application provides a enterprise-grade defense-in-depth strategy suitable for professional distribution and usage.

---
*Created on: 2026-03-24*
*Version: 2.0 (STRIDE Enhanced)*
