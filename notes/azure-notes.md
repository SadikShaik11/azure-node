# My Azure Notes

Learning Azure one topic at a time: short idea, then practical.

---

## Topic 1: Login and Subscription

**Idea:** Before the terminal can create anything in Azure, it needs to know:
- **Who you are**: you log in
- **Which account to bill**: the **subscription**

**Real scenario:** At work you may have `dev`, `staging` and `prod` subscriptions. Always check which one is active before running commands, just like checking your git branch before pushing.

**Commands**
```bash
az login                                # opens browser, you sign in
az account show --output table          # which account am I using?
az account list --output table          # all accounts I have access to
az account set --subscription "<name>"  # switch account
```

**What the output means**
| Column | Meaning |
|---|---|
| Name | Account name, e.g. "Azure subscription 1" |
| State = Enabled | Account is active |
| IsDefault = True | Commands will use this account |
| TenantId | Your ID in Azure's login system (ignore for now) |

---

## Topic 2: Resources and Resource Groups

**Resource** = anything you create and use on Azure.

| On my laptop | Azure resource |
|---|---|
| `node server.js` | App Service (runs my API) |
| Local PostgreSQL / MongoDB | Azure Database |
| `.env` file with secrets | Key Vault |
| Folder of uploaded files | Storage Account |

**Resource Group** = a folder that holds the resources for one project.

```
rg-payflow            ← resource group (folder)
 ├── payflow-api      ← resource
 ├── payflow-db       ← resource
 └── payflow-vault    ← resource
```

**Why it matters:** delete the resource group and everything inside is deleted together. No forgotten resources still costing money.

**At work:** separate groups per environment, e.g. `rg-payflow-dev` and `rg-payflow-prod`, so dev experiments never touch the live app.

**Rules**
1. Every resource must be inside a resource group.
2. A resource group has a **location** (region); I use **Central India**.
3. You pay for resources, not resource groups. An empty group is free.

### Practical (done ✅)
**Portal:** Resource groups → + Create → name + region "(Asia Pacific) Central India" → Review + create → Create

**CLI**
```bash
az group create --name rg-payflow --location centralindia   # create
az group list --output table                                 # list all
az group show --name rg-payflow --output table               # one group's details
az group delete --name rg-pay-cli                            # delete (asks to confirm)
```

### Duplicate names?
- Names are **unique per subscription**: you can't have two `rg-payflow`.
- Portal: shows an "already exists" error.
- CLI, same name and same location: no error; returns the existing group (**idempotent**, like HTTP PUT).
- CLI, same name but a different location: error.
- Idempotent = safe to run again and again, which is why scripts and CI/CD pipelines can re-run commands.

### Deleting
- Deleting a resource group deletes **everything inside it**. It can't be undone.
- Always double-check the name before deleting, especially at work (dev vs prod).

**CLI pattern:** `az <what> <action> --options`, e.g. `az group create`, `az webapp create`, `az webapp list`

---

## Topic 3: Budget alert

**Idea:** A budget is a spending limit. Azure **emails** you at set percentages (e.g. 50%, 80%, 100%).

**Real scenario:** You forget a database running after practice. The budget email warns you before the bill arrives.

**Remember**
- A budget **only alerts**; it does NOT stop or delete anything.
- Alerts are **delayed by a few hours** (cost data updates a few times a day).
- Scope can be the **billing account**, **subscription** or **resource group**. Higher scope = watches more.
- ⚠️ The amount is in your **billing currency**. My account bills in **USD**, so "500" means **$500**, not ₹500. Check the currency!

### Practical
**Portal:** search "Budgets" → check Scope → + Add → name, Monthly, amount → alerts at 50/80/100% Actual → email → Create

**CLI (view budgets)**
```bash
az consumption budget list --output table   # subscription-level budgets
```
- Budgets are "set once": the portal is fine; at work they're made with Terraform/Bicep.
- Learn in the CLI what you do often (create, deploy, logs, delete).

---

## Topic 4: App Service

**Idea:** Run your API on the internet without managing a server. You push code; Azure handles the machine, Node, HTTPS, restarts and patching.

```
App Service Plan   ← the machine you rent (CPU/RAM/price). You pay for this.
 └── Web App       ← your app running on it (many apps can share one plan)
```

| Tier | Cost | Use |
|---|---|---|
| F1 Free | $0 | Learning (limited CPU per day, sleeps when idle) |
| B1 Basic | ~$13/mo | Small real apps |
| Premium | $$$ | Production, autoscale |

### The PORT rule ⚠️
```js
const PORT = process.env.PORT || 3000;
```
Azure picks the port (usually 8080) and passes it in `PORT`. Hardcode 3000 → Azure pings 8080 → no answer → **503**.
Same on Heroku, Render, Cloud Run, AWS App Runner.

### package.json needs a start script
```json
"scripts": { "start": "node index.js" }
```
Azure runs `npm start`.

### Naming convention
| Thing | Prefix | Example |
|---|---|---|
| Resource group | `rg-` | `rg-payflow` |
| App Service plan | `plan-` | `plan-payflow` |
| Web App | `app-` | `app-payflow-api` |

### Practical (done ✅)
**Portal:** App Services → + Create → Web App → Publish: Code, Runtime: Node LTS, OS: Linux, Region: Central India, Plan: Free F1 → Create

**Deploy from the CLI (build first, then deploy)**
```bash
npm ci --omit=dev                          # install production packages
zip -r app.zip . -x "*.zip"                # zip WITH node_modules
az webapp deploy --resource-group <rg> --name <app> --src-path app.zip --type zip
```
- `az webapp up` is deprecated. Use `az webapp create` + `az webapp deploy`.

### Useful app commands
```bash
az webapp show -g <rg> -n <app> --query defaultHostName -o tsv   # get the URL
az webapp browse -g <rg> -n <app>                                # open in browser
curl https://<url>/health                                        # test from terminal
az webapp list --query "[].{name:name, url:defaultHostName, state:state}" -o table
```
- `--query` = pick only the fields you want from the JSON output (like SELECT in SQL).
- `-g` = `--resource-group`, `-n` = `--name`, `-o` = `--output` (short forms).

### node_modules: right or wrong?
- Committing node_modules to **Git** → ❌ wrong
- Including node_modules in the **deployment zip** → ✅ industry standard (the "build artifact")
- Build on the **same OS** you run on: CI pipelines build on Linux. Native packages (bcrypt, sharp) built on a Mac crash on Linux.

### How real companies create App Services
| Task | How |
|---|---|
| Create infrastructure (app, plan, DB) | **Terraform/Bicep** code → PR review → pipeline creates it |
| Deploy code | **CI/CD pipeline** on every merge, never by hand |
| Daily checks (logs, restart, URL, settings) | **CLI** or portal (developers) |
| Explore / experiment | **Portal** |

- Portal clicks can't be reviewed or reliably repeated, so they aren't used for prod setup.
- Why learn the CLI anyway: it maps almost 1:1 to Terraform, pipelines run `az` commands, and devs use it daily.

### What if node_modules is huge? 💡 (new learning)
Real backends can have 200–500 MB of node_modules. Ways to shrink deploys:

1. **Skip dev packages:** `npm ci --omit=dev`. typescript, jest, eslint and nodemon aren't needed in production; often cuts 50–70%.
2. **Zip compression:** JS text compresses well (300 MB → ~50–80 MB zipped).
3. **Bundling (pro move):** esbuild packs your code + only the packages you actually use into ONE file.
   ```bash
   npx esbuild index.js --bundle --platform=node --minify --outfile=dist/server.js
   ```
   300 MB / 20,000 files → ~3 MB / 1 file. Faster deploy and startup.
   ⚠️ Native packages (bcrypt, sharp) can't be bundled.
4. **Docker layers (what companies use):** runtime and node_modules layers are cached; most deploys upload only your changed code.
   ```
   Layer 1: Node runtime   ← cached
   Layer 2: node_modules   ← cached unless package.json changes
   Layer 3: your code      ← only this uploads
   ```

| Approach | Typical size |
|---|---|
| Everything incl. dev packages | 300 MB |
| `--omit=dev` | ~100 MB |
| `--omit=dev` + zip | ~25 MB |
| esbuild bundle | ~3 MB |
| Docker (after first deploy) | only changes |

### First real bug I debugged 🐞 (see below)

---

## Topic 4.5: Tags

**Idea:** `key = value` labels on resources. They don't change behavior; they help **find, organize and track cost**.

**Real scenarios**
- CFO asks "how much does the payments team spend?" → Cost Management, group by tag `team` → answer in seconds.
- Unknown server costing money → `owner` tag tells you who to ask before deleting.

| Key | Example |
|---|---|
| env | dev / staging / prod |
| owner | sadik |
| project | payflow |
| team | payments |

- Resource group tags are **NOT** inherited by resources inside (companies enforce tags with Azure Policy).

### Practical (done ✅)
**Portal:** resource → Tags → add → Apply
```bash
az group update --name <rg> --tags env=dev project=payflow owner=sadik   # tag a group
az resource list --tag project=payflow --output table                     # find by tag
```

---

### (Topic 4) First real bug I debugged 🐞
- Deploy said **success**, but the site gave **503**.
- Log: `Error: Cannot find module 'express'` → `npm install` never ran on Azure.
- Fix: install locally and deploy the zip with node_modules.
- **Lesson: "Deployment successful" ≠ app working. Always open the URL; on 503, read the logs.**

---

## Topic 5: App settings (environment variables)

**Idea:** Azure has no `.env` file. You set **App settings** in the portal/CLI and Azure injects them as environment variables. Code stays the same: `process.env.STRIPE_KEY`.

**Real scenarios**
- Same code + same zip deployed to dev and prod; only the settings differ (`sk_test_...` vs `sk_live_...`).
- Stripe key rotated at 11 PM → update one setting → app restarts → done in 1 minute, no redeploy.

**Remember**
- Changing a setting **restarts the app** (Node reads `process.env` at startup).
- **Never commit `.env`** to Git; add it to `.gitignore`. Bots scan GitHub for leaked keys.
- Never return secrets from an API response.
- Real secrets go in **Key Vault** later (Topic 12); the app setting just points to it.
- `SCM_DO_BUILD_DURING_DEPLOYMENT` was also an app setting.

### Practical (done ✅)
**Portal:** Web App → Settings → Environment variables → App settings → + Add → Apply → Confirm

```js
app.get("/config", (req, res) => {
  res.json({ env: process.env.APP_ENV || "local", provider: process.env.PAYMENT_PROVIDER || "none" });
});
```

```bash
az webapp config appsettings set  -g <rg> -n <app> --settings APP_ENV=staging   # add/change
az webapp config appsettings list -g <rg> -n <app> -o table                      # list
az webapp config appsettings delete -g <rg> -n <app> --setting-names APP_ENV     # remove
```
