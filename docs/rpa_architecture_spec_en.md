# OneProcess RPA Multi-Tenant Architecture & Operations Specification

## 1. System Overview
This document outlines the architecture, database schema, and system interactions for the OneProcess RPA Management Platform. The platform utilizes a multi-tenant architecture on top of Supabase (PostgreSQL + PostgREST + Auth) to centrally manage, monitor, and configure RPA (Robotic Process Automation) bots deployed across multiple client environments.

## 2. Multi-Tenant Database Schema
The database uses deterministic UUIDs (generated via SHA-256 hashing in the Java robots) to ensure idempotency and prevent duplicate records during network failures or robot restarts.

### 2.1. Governance & Access Control
- **`cliente` (Tenant Table):** Stores client company information (Name, Legal Name, CNPJ). Every operation is tied to a client ID for data isolation.
- **`usuario_perfil` (User Profile):** Links directly to Supabase Auth (`auth.users`). Stores user names and department details. Password management is delegated entirely to Supabase Auth.
- **`vinculo_cliente_usuario` (User-Client Mapping):** A cross-reference table that defines which users have access to which clients' dashboards. Allows an admin to oversee multiple clients while restricting client users to their own data.

### 2.2. Bot Configuration Catalog
- **`cadastro_rpa` (RPA Catalog):** Defines the configured bots available for each client. Contains metadata such as the bot's name, description, department, status (Active, Inactive, Maintenance), business rules, mapped risks, and an array of email addresses (`emails_alerta`) to be notified in case of task failures.

### 2.3. Telemetry & Execution Tracking
- **`rpa_sja_001_task` (Batch/File Level):** Records the processing of a full batch (e.g., an uploaded Excel file). 
  - **Idempotency:** The Primary Key (`id`) is a SHA-256 hash of the file's bytes.
  - **Dashboard Optimization:** Contains denormalized counters (`total_linhas`, `linhas_sucesso`, `linhas_erro`) updated via database triggers to ensure dashboard queries render instantly without heavy aggregation.
- **`rpa_sja_001_subtask` (Unit/Row Level):** Records the outcome of individual operations (e.g., a single invoice processed in the ERP).
  - **Idempotency:** The Primary Key (`id`) is derived from `Hash(task_id + document_number + vendor)`.
  - **ERP Context:** Captures specific business data (Invoice Number, Emission Date, Total Value, Vendor).

## 3. System Interactions & Interfaces

### 3.1. Front-End Web Application (Dashboard)
The front-end is composed of modular views connecting directly to Supabase via `supabase-js`, utilizing Row Level Security (RLS) to ensure data isolation.
- **Admin View:** Displays a consolidated overview of all clients, total active bots, execution rates, and overall success metrics. Admins can register new clients, issue credentials, and oversee the entire infrastructure.
- **Client View:** A restricted dashboard where a client (e.g., "ABC Indústria") sees only their active bots, success rates, and recent executions.
- **Configuration Module:** Allows clients or admins to register new RPAs, define rules, and configure alert email arrays.

### 3.2. RPA Robot (Java Spring Boot) Interaction
The robots are deployed in the clients' local environments (e.g., Windows Servers) and communicate exclusively via outgoing HTTPS webhooks to the Supabase REST API (PostgREST).
1. **Authentication:** The robot authenticates using a secure JWT token associated with its specific client tenant.
2. **Batch Initialization:** Upon detecting an input file, the robot generates the file hash (Task ID) and sends a `POST` request to the `/rest/v1/rpa_sja_001_task` endpoint.
3. **Upsert Mechanism:** The robot utilizes the HTTP header `Prefer: resolution=merge-duplicates`. If the robot restarts and resends the exact same batch or row, Supabase silently updates the record instead of throwing a unique constraint violation, maintaining perfect state idempotency.
4. **Row Processing:** As the robot executes UI interactions (e.g., in the onDFe system), it streams the result of each row via `POST` to the `rpa_sja_001_subtask` endpoint. The database trigger automatically increments the success/error counters on the parent task.

## 4. Development & Deployment Pipeline
- **Local Testing:** The complete stack (PostgreSQL, GoTrue, PostgREST, Studio) can be spun up locally via Docker Compose for offline testing.
- **Cloud Deployment:** Production environments run on managed instances (or self-hosted GCP `e2-standard-2` VMs with pd-balanced disks) ensuring high IOPS for PostgreSQL and stable API gateway performance.
