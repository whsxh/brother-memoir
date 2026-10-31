const { createRequire } = require("module");
const req = createRequire("C:\\Users\\18058\\AppData\\Roaming\\npm\\node_modules\\hyperframes\\package.json");
const puppeteer = req("puppeteer-core");

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: "new",
    args: ["--no-sandbox"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1200 });
  const errs = [];
  page.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  await page.goto("https://whsxh.github.io/brother-memoir/", { waitUntil: "networkidle2", timeout: 45000 });
  await new Promise((r) => setTimeout(r, 2000));
  const status = await page.$eval("#status", (n) => n.textContent);
  const chips = await page.$$eval(".chip", (n) => n.map((x) => x.textContent));
  const memos = await page.$$eval(".memo h3", (n) => n.map((x) => x.textContent));
  await page.screenshot({ path: "D:\\deepseek\\brother-memoir\\live.png" });
  console.log(JSON.stringify({ status, chips, memos, errs }, null, 2));
  await browser.close();
})();
