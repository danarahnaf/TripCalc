// Serves the static `build/` folder (SPA fallback to index.html) for E2E tests.
import http from 'node:http';
import sirv from 'sirv';

const port = Number(process.env.PORT) || 4180;
const serve = sirv('build', { single: true, dev: true });

http.createServer(serve).listen(port, () => {
	console.log(`Serving build/ on http://localhost:${port}`);
});
