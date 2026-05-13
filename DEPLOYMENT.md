# Hostinger Deployment Guide - Easiest Final Update

A fully automated deployment system has been developed for this project to solve all Hostinger server issues in just two steps.

## 1. Local Preparation (On Your Machine)
Open the terminal in the project folder and run this command:
```bash
npm run build
```
*(This command will now update the database, build the project, and automatically copy all files and images to a dedicated deployment folder).*

## 2. Uploading to Hostinger
After the previous command completes successfully, follow these steps:
1. Go to the project folder on your machine.
2. Enter the hidden folder `.next` then go to `standalone`.
3. **Copy all contents of the `standalone` folder entirely.**
4. Upload these contents directly to the `public_html` folder on Hostinger.

**The final structure of the `public_html` folder should be:**
```text
/public_html
  ├── .next/             (Copied from standalone)
  ├── node_modules/      (Copied from standalone)
  ├── public/            (Images and files, copied automatically)
  ├── package.json       (Copied from standalone)
  └── server.js          (The execution file, programmatically modified to read .env)
```

## Important Notes
- **No need to transfer other files:** The new script (`prepare-hostinger.js`) has prepared the `server.js` file to read the database automatically from Hostinger's hidden settings (`.builds/config/.env`).
- Once uploaded, Hostinger (LiteSpeed/Passenger system) will automatically run `server.js`, and the site will work without any 500 or 503 errors.
- **In case of code modification:** All you need to do in the future is repeat these steps: `npm run build` then upload the new `standalone` contents.
