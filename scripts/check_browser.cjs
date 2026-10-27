/* Check the live filter behavior in a real browser without extra packages. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const {spawn} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'rajasthan-filter-check-'));
const edge = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (error, content) => {
    if (error) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)] || 'application/octet-stream');
    res.end(content);
  });
});

let browser, ws;
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = spawn(edge, ['--headless=new','--disable-gpu','--no-first-run','--disable-extensions',
    '--disable-background-networking','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],
    {windowsHide:true,stdio:'ignore'});
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !fs.existsSync(portFile); i++) await sleep(200);
  assert.ok(fs.existsSync(portFile), 'Edge did not start its debugging port');
  const port = fs.readFileSync(portFile, 'utf8').split('\n')[0];
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const tab = tabs.find(item => item.type === 'page');
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const entry = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
      else entry.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++id, {resolve,reject});
    ws.send(JSON.stringify({id,method,params}));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', {expression,returnByValue:true,awaitPromise:true});
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const waitFor = async expression => {
    for (let i = 0; i < 150; i++) {
      if (await evaluate(expression)) return;
      await sleep(100);
    }
    throw new Error(`Timed out: ${expression}`);
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {width:1440,height:950,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate', {url:base + '/merit.html?year=2026'});
  await waitFor(`document.getElementById('result-count')?.textContent.includes('3,160 of 3,160')`);
  if (process.env.UI_SNAPSHOT_DIR) {
    fs.mkdirSync(process.env.UI_SNAPSHOT_DIR, {recursive:true});
    const shot = await send('Page.captureScreenshot', {format:'png',captureBeyondViewport:false});
    fs.writeFileSync(path.join(process.env.UI_SNAPSHOT_DIR, 'merit-desktop.png'), Buffer.from(shot.data,'base64'));
  }
  assert.equal(await evaluate(`document.getElementById('domicile-filter-search').offsetWidth > 0`), true);
  await evaluate(`(()=>{const x=document.getElementById('domicile-filter-search');x.focus();x.value='telangana';x.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  assert.equal(await evaluate(`document.querySelectorAll('#domicile-filter .picker-options input').length`), 1);
  assert.equal(await evaluate(`document.querySelector('#domicile-filter .picker-options input').value`), 'Telangana');
  await evaluate(`document.querySelector('#domicile-filter .picker-options input').click()`);
  await waitFor(`document.getElementById('result-count').textContent.includes('3 of 3,160')`);
  assert.equal(await evaluate(`document.querySelectorAll('#domicile-filter .picker-chip').length`), 1);
  assert.ok((await evaluate(`location.search`)).includes('domicile=Telangana'));
  await evaluate(`document.querySelector('#domicile-filter .picker-chip button').click()`);
  await waitFor(`document.getElementById('result-count').textContent.includes('3,160 of 3,160')`);
  await evaluate(`(()=>{const x=document.getElementById('domicile-filter-search');x.focus();x.value='all except';x.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await evaluate(`document.querySelector('#domicile-filter .picker-options input').click()`);
  await waitFor(`document.getElementById('result-count').textContent.includes('256 of 3,160')`);
  const shared = await evaluate(`location.href`);
  await send('Page.navigate', {url:shared});
  await waitFor(`document.getElementById('result-count')?.textContent.includes('256 of 3,160')`);

  await send('Page.navigate', {url:base + '/matrix.html?year=2025&round=round-1'});
  await waitFor(`location.pathname.endsWith('/matrix.html') && document.querySelector('#college-filter .picker-options input') && !document.getElementById('result-count')?.textContent.includes('Loading')`);
  await evaluate(`(()=>{const x=document.getElementById('college-filter-search');x.focus();x.value='gandhi jaipur';x.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  assert.equal(await evaluate(`document.querySelectorAll('#college-filter .picker-options input').length`), 1);
  await evaluate(`document.querySelector('#college-filter .picker-options input').click()`);
  await waitFor(`document.getElementById('result-count').textContent !== 'Loading records…'`);
  assert.ok((await evaluate(`document.querySelector('#college-filter .picker-chip')?.textContent`)).includes('Mahatma Gandhi'));

  await send('Page.navigate', {url:base + '/allotments.html?year=2025'});
  await waitFor(`location.pathname.endsWith('/allotments.html') && document.querySelector('#college-filter .picker-options input') && document.getElementById('result-count')?.textContent.includes(' of ')`);
  await evaluate(`(()=>{const x=document.getElementById('college-filter-search');x.focus();x.value='gandhi jaipur';x.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  assert.equal(await evaluate(`document.querySelectorAll('#college-filter .picker-options input').length`), 1);

  await send('Page.navigate', {url:base + '/growth.html'});
  await waitFor(`location.pathname.endsWith('/growth.html') && document.querySelector('#branch-filter .picker-options input') && !document.getElementById('result-count')?.textContent.includes('Loading')`);
  await evaluate(`(()=>{const x=document.getElementById('branch-filter-search');x.focus();x.value='radiotherapy';x.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  assert.ok(await evaluate(`document.querySelectorAll('#branch-filter .picker-options input').length > 0`));

  await send('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true});
  await send('Page.navigate', {url:base + '/merit.html?year=2026'});
  await waitFor(`document.getElementById('result-count')?.textContent.includes('3,160 of 3,160')`);
  await evaluate(`(()=>{const x=document.getElementById('domicile-filter-search');x.scrollIntoView({block:'center'});x.focus();x.value='tel';x.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  assert.equal(await evaluate(`document.querySelector('#domicile-filter .picker-popover').hidden`), false);
  assert.equal(await evaluate(`(()=>{const r=document.querySelector('#domicile-filter .picker-popover').getBoundingClientRect();return r.left>=0&&r.right<=window.innerWidth&&document.documentElement.scrollWidth<=window.innerWidth;})()`), true);
  if (process.env.UI_SNAPSHOT_DIR) {
    await sleep(250);
    const shot = await send('Page.captureScreenshot', {format:'png',captureBeyondViewport:false});
    fs.writeFileSync(path.join(process.env.UI_SNAPSHOT_DIR, 'merit-mobile.png'), Buffer.from(shot.data,'base64'));
  }
  assert.equal(errors.length, 0, JSON.stringify(errors));
  console.log('Browser checks passed: live typeahead, selection chips, domicile shortcut, shared URL, all four data views and mobile popup.');
  await send('Browser.close').catch(() => {});
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (ws) ws.close();
  if (browser) browser.kill();
  server.close();
  await sleep(500);
  const tempRoot = path.resolve(os.tmpdir()) + path.sep;
  if (path.resolve(profile).startsWith(tempRoot)) {
    try { fs.rmSync(profile, {recursive:true,force:true,maxRetries:5,retryDelay:200}); }
    catch (error) { console.warn(`Temporary Edge profile remains at ${profile}: ${error.message}`); }
  }
});
