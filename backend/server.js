// server.js
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { authenticateToken } from "./auth.js";
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
app.use(express.static(path.join(__dirname, "../public")));

// Inicializa banco
initDB()
  .then(() => console.log("✅ Banco de dados inicializado"))
  .catch((err) => console.error("❌ Erro ao inicializar o banco:", err));

// Rotas API -----------------------------------------------

// Registrar usuário
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ message: "Usuário e senha são obrigatórios" });

  try {
    const userCheck = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    if (userCheck.rows.length > 0)
      return res.status(409).json({ message: "Usuário já existe" });

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      "INSERT INTO users (username, password) VALUES ($1, $2)",
      [username, hashedPassword]
    );

    res.status(201).json({ message: "Usuário criado com sucesso" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao registrar usuário" });
  }
});

// Login de usuário
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ message: "Usuário e senha são obrigatórios" });

  try {
    const userResult = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    if (userResult.rows.length === 0)
      return res.status(401).json({ message: "Usuário ou senha inválidos" });

    const user = userResult.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "Usuário ou senha inválidos" });

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao fazer login" });
  }
});

// Obter todas as mesas
app.get("/api/mesas", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM mesas ORDER BY numero ASC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar mesas" });
  }
});

// 🔹 Obter todos os pedidos de uma mesa (com ID incluso)
app.get("/api/mesas/:mesa/pedidos", async (req, res) => {
  const mesa = req.params.mesa;
  try {
    const result = await pool.query(
      `SELECT id, produto, quantidade, preco, obs
       FROM pedidos
       WHERE mesa = $1
       ORDER BY id ASC`,
      [mesa]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao buscar pedidos da mesa:", err);
    res.status(500).json({ error: "Erro ao buscar pedidos" });
  }
});

// Criar pedido genérico
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

// 🔹 ROTA AJUSTADA: adiciona pedido e retorna o registro criado
app.post("/api/mesas/:mesa/pedidos", async (req, res) => {
  const mesa = req.params.mesa;
  const { produto, quantidade, preco, obs } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO pedidos (mesa, produto, quantidade, preco, obs)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`, // retorna o pedido criado
      [mesa, produto, quantidade, preco, obs]
    );

    // Atualiza o status da mesa para 'ocupada'
    await pool.query(
      "UPDATE mesas SET status = 'ocupada' WHERE numero = $1",
      [mesa]
    );

    // Retorna o pedido criado ao frontend
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Erro ao adicionar pedido à mesa:", err);
    res.status(500).json({ error: "Erro ao adicionar pedido à mesa" });
  }
});

// 🔹 Rota para obter o status de todas as mesas
app.get("/api/mesas/status", async (req, res) => {
  try {
    const result = await pool.query("SELECT numero, status FROM mesas ORDER BY numero ASC");
    const statusMesas = {};
    result.rows.forEach(mesa => {
      statusMesas[mesa.numero] = mesa.status;
    });
    res.json(statusMesas);
  } catch (err) {
    console.error("❌ Erro ao buscar status das mesas:", err);
    res.status(500).json({ error: "Erro ao buscar status das mesas" });
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

// Atualizar quantidade de um pedido
app.put("/api/pedidos/:id", async (req, res) => {
  const id = req.params.id;
  const { quantidade } = req.body;

  try {
    const result = await pool.query(
      "UPDATE pedidos SET quantidade = $1 WHERE id = $2 RETURNING *",
      [quantidade, id]
    );

    if (result.rowCount === 0)
      return res.status(404).json({ error: "Pedido não encontrado" });

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Erro ao atualizar pedido:", err);
    res.status(500).json({ error: "Erro ao atualizar pedido" });
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

// Middleware simples para checar token (placeholder)
function verificarAutenticacao(req, res, next) {
  next();
}

// Serve index.html
app.get("/", verificarAutenticacao, (req, res) => {
  res.sendFile(path.join(__dirname, "../public", "index.html"));
});

// Para login e register.html
app.get("/login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "../public", "login.html"));
});

app.get("/register.html", (req, res) => {
  res.sendFile(path.join(__dirname, "../public", "register.html"));
});

// Porta
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});


//├── backend/
//│   ├── server.js ✅
//│   ├── db.js ✅
//│   ├── package.json ✅
//│   └── .env ✅ (com DATABASE_URL)
//│
//├── public/
//│   ├── index.html ✅ (verifica token e redireciona)
//│   ├── login.html ✅
//│   ├── register.html ✅
//│   ├── style.css ✅
//│   └── (outros arquivos estáticos)
