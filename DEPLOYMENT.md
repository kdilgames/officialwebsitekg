# KDILGAMES Marketplace — Deployment Guide

This document outlines the steps to take your marketplace live at `https://kdilgames.com`.

## 1. Source Control (GitHub)
The deployment platform (Vercel) needs to read your code from a repository.
1. Create a **private** repository on [GitHub](https://github.com).
2. Run these commands in your project folder:
   ```bash
   git init
   git add .
   git commit -m "Initial marketplace build"
   git remote add origin https://github.com/kdilgames/officialwebsitekg.git
   git push -u origin main
   ```

## 2. Hosting (Vercel)
1. Sign up at [Vercel](https://vercel.com) using your GitHub account.
2. Click **Add New** -> **Project** and import your repository.
3. **Environment Variables**: This is the most important part. Copy every value from your local `.env` file to the Vercel dashboard.
   - `DATABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `STRIPE_SECRET_KEY`
   - `VIRUSTOTAL_API_KEY`
   - `SITE_URL`: Set this to `https://kdilgames.com`
4. Click **Deploy**.

## 3. Custom Domain (`kdilgames.com`)
1. In Vercel, go to **Settings** -> **Domains**.
2. Add `kdilgames.com`.
3. Update your DNS settings at your domain registrar:
   - **A Record**: Host `@`, Value `76.76.21.21`
   - **CNAME Record**: Host `www`, Value `cname.vercel-dns.com`

## 4. Production Service Updates
Once the site is live, you must update the callback URLs in your external services.

### Supabase
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard).
2. **Auth** -> **URL Configuration**:
   - **Site URL**: `https://kdilgames.com`
   - **Redirect URLs**: Add `https://kdilgames.com/**`

### Stripe
1. Go to your [Stripe Dashboard](https://dashboard.stripe.com).
2. **Developers** -> **Webhooks**:
   - Add an endpoint: `https://kdilgames.com/api/webhooks/stripe`
   - Select events: `checkout.session.completed`, `account.updated`, `capability.updated`.

## 5. Final Checklist
- [ ] Run `npm run db:deploy` locally to ensure the production database schema is up to date.
- [ ] Verify that the `avatars` and `product-images` buckets in Supabase are still marked as **Public**.
- [ ] Test the registration flow on the live site.
- [ ] Test a test-mode payment if using Stripe Sandbox.

---
**Congratulations!** Your professional digital marketplace is now live at `kdilgames.com`.
