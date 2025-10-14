// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pool, initDB } from "./db.js";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();

// --- Middlewares ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Servir frontend ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public"))); // assume que seu HTML/JS/CSS estão em pasta "public"

// --- Inicializar DB e start server ---
const PORT = process.env.PORT || 3000;

initDB()
  .then(() => {
    console.log("📦 Banco PostgreSQL inicializado!");
    app.listen(PORT, () => console.log(`✅ Servidor rodando em https://localhost:${PORT}`));
  })
  .catch(err => {
    console.error("❌ Erro ao inicializar banco:", err);
  });

// --- Rotas ---
// Retorna todas as mesas
app.get("/mesas", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT numero, status FROM mesas ORDER BY numero ASC");
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar mesas:", err);
    res.status(500).json({ error: "Erro ao buscar mesas" });
  }
});

// Retorna pedidos de uma mesa
app.get("/mesas/:numero", async (req, res) => {
  try {
    const numero = parseInt(req.params.numero);
    const { rows } = await pool.query(
      "SELECT produto, quantidade, preco, obs FROM pedidos WHERE mesa = $1 ORDER BY id ASC",
      [numero]
    );
    res.json({ pedidos: rows });
  } catch (err) {
    console.error("Erro ao buscar pedidos da mesa:", err);
    res.status(500).json({ error: "Erro ao carregar pedidos da mesa" });
  }
});

// Adicionar pedido
app.post("/mesas/:numero/pedidos", async (req, res) => {
  try {
    const numero = parseInt(req.params.numero);
    const { produto, quantidade, preco, obs } = req.body;

    await pool.query(
      "INSERT INTO pedidos (mesa, produto, quantidade, preco, obs) VALUES ($1, $2, $3, $4, $5)",
      [numero, produto, quantidade, preco, obs]
    );

    await pool.query("UPDATE mesas SET status = 'ocupada' WHERE numero = $1", [numero]);
    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao adicionar pedido:", err);
    res.status(500).json({ error: "Erro ao adicionar pedido" });
  }
});

// Fechar mesa (estado "fechamento")
app.post("/mesas/:numero/fechar", async (req, res) => {
  try {
    const numero = parseInt(req.params.numero);
    await pool.query("UPDATE mesas SET status = 'fechamento' WHERE numero = $1", [numero]);
    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao fechar mesa:", err);
    res.status(500).json({ error: "Erro ao fechar mesa" });
  }
});

// Mesa paga (limpa pedidos e libera mesa)
app.post("/mesas/:numero/paga", async (req, res) => {
  try {
    const numero = parseInt(req.params.numero);
    await pool.query("DELETE FROM pedidos WHERE mesa = $1", [numero]);
    await pool.query("UPDATE mesas SET status = 'livre' WHERE numero = $1", [numero]);
    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao pagar mesa:", err);
    res.status(500).json({ error: "Erro ao pagar mesa" });
  }
});

// Simulação de impressão
app.post("/imprimir", (req, res) => {
  console.log("🖨️ Pedido:", req.body);
  res.json({ status: "ok" });
});

app.post("/imprimir_comanda", (req, res) => {
  console.log("🖨️ Comanda completa:", req.body);
  res.json({ status: "ok" });
});
