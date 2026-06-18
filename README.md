# OneProcess RPA — Spring Boot Web Dashboard & Telemetry Server

This directory contains the self-contained Java Spring Boot implementation of the OneProcess RPA multi-tenant management platform, serving both the REST API backend and the premium frontend dashboard.

---

## 🛠️ Technology Stack & Architecture

- **Backend:** Java 17 + Spring Boot 3.3.0 (Spring Web, Spring Data JPA)
- **Database:** H2 Database (In-Memory) for zero-configuration local execution, with optional PostgreSQL configuration for production/Supabase.
- **Frontend:** HTML5, CSS3 (Vanilla Dark Mode System matching the prototype specifications), and Vanilla JS (`fetch` API).
- **Containerization:** Multi-stage `Dockerfile` + `docker-compose.yml`.

### Architecture Mappings to Schema & Spec:
1. **Multi-Tenancy:** Handled via the `Cliente` (Tenant) entity. Every `CadastroRpa` and `RpaTask` is mapped to a tenant.
2. **Access Control:** `UsuarioPerfil` holds roles (`admin` or `client`) and credentials. A mapping table `VinculoClienteUsuario` restricts client users to their respective tenant data.
3. **Idempotency:** `RpaTask` and `RpaSubtask` primary keys are UUIDs generated deterministically by the robots (via SHA-256 hashes of inputs). The `/api/resultados/task` webhook handles this by updating (upserting) instead of throwing unique constraint violations.
4. **Denormalized Counters (Trigger simulation):** The Java service layer in `/api/resultados/subtask` automatically updates `total_linhas`, `linhas_sucesso`, and `linhas_erro` counters on the parent `RpaTask` in real-time as subtask rows are streamed.

---

## 🚀 How to Run

### Option 1: Docker Compose (Recommended)
From the `web/` folder, run:
```bash
docker compose up -d --build
```
This builds the application and exposes it at [http://localhost:8080](http://localhost:8080).

### Option 2: Local Maven Run
If you have JDK 17 and Maven installed locally:
```bash
mvn spring-boot:run
```

---

## 🔑 Default Seed Credentials

Upon startup, the database is seeded automatically with the following accounts:
- **Administrator Console:**
  - **Username:** `oneprocess`
  - **Password:** `op2025`
- **Client Console (ABC Indústria):**
  - **Username:** `cliente_abc`
  - **Password:** `abc123`

---

## 📡 Telemetry Webhooks (Testing the Java Robots)

The local robots send outbound telemetry HTTP POST requests to these endpoints:

### 1. Initialize Batch Task (POST `/api/resultados/task`)
Use this to simulate a robot starting a new file processing batch:
```bash
curl -X POST http://localhost:8080/api/resultados/task \
  -H "Content-Type: application/json" \
  -d '{
    "id": "e963b516-1fcd-400a-bf19-33e1d67a14e9",
    "cadastroRpaId": "6d790d98-89c0-4c12-a7ad-35f922756df4",
    "nome": "leitura_planilha_nfe_june.xlsx",
    "caminhoJsonDisco": "/var/rpa/input/leitura_planilha_nfe_june.xlsx",
    "status": "Processando"
  }'
```

### 2. Stream Subtask Rows (POST `/api/resultados/subtask`)
Use this to stream row-level results. The backend will automatically update the total, success, and error counters on the task:
```bash
curl -X POST http://localhost:8080/api/resultados/subtask \
  -H "Content-Type: application/json" \
  -d '{
    "id": "f516a241-12f3-424a-81a1-99b822cbfa22",
    "idTask": "e963b516-1fcd-400a-bf19-33e1d67a14e9",
    "nome": "Linha 1 - Processamento NF-000550",
    "status": "Sucesso",
    "numeroDocumento": "NF-000550",
    "serieDocumento": "1",
    "dataEmissao": "2026-06-09",
    "valorTotalDocumento": 3450.90,
    "codigoFornecedor": "FORN-110",
    "nomeFornecedor": "Fornecedor X Eireli"
  }'
```

Check the **Resultados** screen on your dashboard to see these logs update in real-time.
