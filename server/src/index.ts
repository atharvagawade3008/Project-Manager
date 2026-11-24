import { createApp } from './app.js';

const parsedPort = Number.parseInt(process.env.PORT || '', 10);
const PORT = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort < 65536 ? parsedPort : 3001;
const app = createApp();

app.listen(PORT, () => {
  console.log(`[Project OS Server] Running on http://localhost:${PORT}`);
  console.log(`[Project OS Server] API Health available at http://localhost:${PORT}/api/health`);
});
