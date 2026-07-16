/* 打包 Web Annotator 为 CRX3（自签名）。依赖：npm i crx
 * 首次运行自动生成 RSA 私钥并写入 dist/annotator.pem，之后复用以固定扩展 ID。
 */
const Crx = require('crx');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const KEY = path.join(DIST, 'annotator.pem');
const OUT = path.join(DIST, 'annotator.crx');

if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });

let pem;
if (fs.existsSync(KEY)) {
  pem = fs.readFileSync(KEY);
} else {
  const kp = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  pem = (kp && typeof kp === 'object' && kp.privateKey) ? kp.privateKey : kp;
  fs.writeFileSync(KEY, pem);
  console.log('生成新私钥 ->', KEY);
}

const crx = new Crx({ rootDirectory: SRC, privateKey: pem });

crx.pack()
  .then((buf) => {
    fs.writeFileSync(OUT, buf);
    console.log('OK  ->', OUT, '(' + buf.length + ' bytes)');
  })
  .catch((e) => {
    console.error('PACK FAILED:', e && e.message ? e.message : e);
    process.exit(1);
  });
