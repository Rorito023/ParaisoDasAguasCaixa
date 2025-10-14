// server.js
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { pool, initDB } from "./db.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Caminho absoluto (para servir frontend)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Servir os arquivos estáticos (frontend)
app.use(express.static(path.join(__dirname, "public")));

// Inicializa banco
initDB()
  .then(() => console.log("✅ Banco de dados inicializado"))
  .catch((err) => console.error("❌ Erro ao inicializar o banco:", err));

// Rotas API -----------------------------------------------

// Obter todas as mesas
app.get("/api/mesas", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM mesas ORDER BY numero ASC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar mesas" });
  }
});

// Obter pedidos de uma mesa
app.get("/api/pedidos/:mesa", async (req, res) => {
  const mesa = req.params.mesa;
  try {
    const result = await pool.query("SELECT * FROM pedidos WHERE mesa = $1", [mesa]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar pedidos" });
  }
});

// Criar pedido
app.post("/api/pedidos", async (req, res) => {
  const { mesa, produto, quantidade, preco, obs } = req.body;
  try {
    await pool.query(
      "INSERT INTO pedidos (mesa, produto, quantidade, preco, obs) VALUES ($1, $2, $3, $4, $5)",
      [mesa, produto, quantidade, preco, obs]
    );
    await pool.query("UPDATE mesas SET status = 'ocupada' WHERE numero = $1", [mesa]);
    res.json({ message: "Pedido adicionado" });
  } catch (err) {
    res.status(500).json({ error: "Erro ao adicionar pedido" });
  }
});

// Remover pedido
app.delete("/api/pedidos/:id", async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query("DELETE FROM pedidos WHERE id = $1", [id]);
    res.json({ message: "Pedido removido" });
  } catch (err) {
    res.status(500).json({ error: "Erro ao remover pedido" });
  }
});

// Limpar mesa
app.post("/api/mesas/:mesa/liberar", async (req, res) => {
  const mesa = req.params.mesa;
  try {
    await pool.query("DELETE FROM pedidos WHERE mesa = $1", [mesa]);
    await pool.query("UPDATE mesas SET status = 'livre' WHERE numero = $1", [mesa]);
    res.json({ message: "Mesa liberada" });
  } catch (err) {
    res.status(500).json({ error: "Erro ao liberar mesa" });
  }
});

// Fallback — serve o index.html para qualquer rota não reconhecida
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ----------------------------------------------------------

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em:`);
  console.log(`   🌐 Local: http://localhost:${PORT}`);
  console.log(`   🔗 Render: ${process.env.RENDER_EXTERNAL_URL || "aguardando URL do Render..."}`);
});