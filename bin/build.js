import esbuild from 'esbuild';
import path from 'node:path';

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

const ENTRY_POINTS = ['src/index.js'];
const OUTDIR = 'dist';
const DEV_PORT = 3000;

const buildOptions = {
  entryPoints: ENTRY_POINTS,
  outdir: OUTDIR,
  outbase: 'src',
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  sourcemap: true,
  minify: isProduction,
  legalComments: 'none',
};

const toOutputFile = (entryPoint) => entryPoint.replace(/^src[\\/]/, '').replace(/\.[^/.]+$/, '.js');

if (isProduction) {
  await esbuild.build(buildOptions);
  console.log('Build completed in production mode.');
} else if (isDevelopment) {
  const context = await esbuild.context({
    ...buildOptions,
    banner: {
      js: 'new EventSource("http://localhost:3000/esbuild").addEventListener("change", () => location.reload());',
    },
  });

  await context.watch();

  const server = await context.serve({
    servedir: OUTDIR,
    port: DEV_PORT,
  });

  const host = server.host === '0.0.0.0' ? 'localhost' : server.host;
  const rows = ENTRY_POINTS.map((entryPoint) => {
    const outputFile = toOutputFile(entryPoint).replaceAll(path.sep, '/');
    const fileLocation = `http://${host}:${server.port}/${outputFile}`;
    return {
      'File Location': fileLocation,
      'Import Suggestion': `<script defer src="${fileLocation}"></script>`,
    };
  });

  console.table(rows);
} else {
  await esbuild.build(buildOptions);
  console.log('Build completed.');
}