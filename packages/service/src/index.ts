import { createApp } from './app.js';
import { DEFAULT_PORT } from './constants.js';

const app = createApp();
const port = Number(process.env.PORT ?? DEFAULT_PORT);

app.listen(port, () => {
  console.log(`Markdown to PDF service listening on http://localhost:${port}`);
});
