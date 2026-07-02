# Deep Dive: Member Login / Harvard Key SSO

> The single hardest and most uncertain item. This is as much an
> **organizational / procurement** decision as a technical one. Read this before
> committing to any login approach.

## What the team asked for

From the feedback doc:

> **SSO Single Sign** — HBS Women's Association implemented a Sign in option with
> a Harvard Key. This can reduce the manual work of verifying alumni but can also
> limit us on the information that we collect.

So the goal is a **member login that verifies Harvard affiliation** with minimal
manual work.

## What Harvard Key actually is

Harvard Key is Harvard University's central identity system (run by HUIT IAM). It
is **federated SSO based on SAML 2.0 / Shibboleth**. To let people "Sign in with
Harvard Key," an application must be **registered as a Service Provider (SP) with
Harvard's Identity Provider (IdP)** — a process owned by Harvard IT, generally
requiring an official Harvard sponsor/affiliation and a security review.

Two hard implications:

1. **It requires Harvard IT approval.** A volunteer alumni community may or may
   not qualify to register an SP directly. This is the gating unknown, and it is
   outside our control and timeline.
2. **It requires server-side auth.** SAML handshakes cannot run on a pure static
   site (GitHub Pages serves only static files). We'd need a serverless auth
   layer (e.g. Cloudflare Workers / Netlify Functions / a small backend), which
   changes the hosting architecture for the login-gated parts.

## Important precedent: how HBSWA actually did it

The HBS Women's Association login links go to **`imodules.com` / `Anthology
Encompass` (iModules)** — a **paid third-party alumni-engagement platform**.
They did **not** build Harvard Key SSO themselves; they adopted a platform that
already integrates with Harvard's auth and provides the CRM/membership tooling.

Takeaway: "HBSWA has Harvard Key login" really means "HBSWA pays for an alumni
platform that includes it." Replicating that path means buying a platform, not
writing an integration — likely expensive and heavy for a volunteer org, and it
would largely replace the custom site/CRM we're building.

## The realistic options

| Option | What it is | Verifies Harvard affiliation? | Needs Harvard IT? | Hosting impact | Effort / cost |
|---|---|---|---|---|---|
| **A. Harvard Key direct (SAML SP)** | Register our app as a Harvard SP | ✅ Strongest | ✅ Yes — approval + review | Needs serverless auth layer | **XL, externally gated** |
| **B. Paid alumni platform (iModules/Anthology, etc.)** | Adopt HBSWA's model | ✅ Yes (platform handles it) | Via the vendor | Replaces custom site/CRM | **$$$/yr + migration** |
| **C. Harvard email magic-link** | Email a one-time login link; verify the address domain | 🟡 Proxy for affiliation (many alumni lack a live @*.harvard.edu) | ❌ No | Needs a serverless email/auth function | **L (~1 week)** |
| **D. Google / generic sign-in + manual approval** | Sign in with Google; an admin approves alumni | 🟡 Manual step, but captures more data | ❌ No | Needs light backend or a 3rd-party auth (Auth0/Clerk free tier) | **M–L** |
| **E. Defer login for v1** | Launch the public site now; add gated features later | — | ❌ No | None | **S (decision only)** |

## Recommendation

- **For launch, decouple login from the website.** The public marketing site
  (everything built so far) does not need auth to go live. Ship it; treat member
  login as a fast-follow.
- **Harvard Key direct (A) is high-risk / high-latency** and may not even be
  available to a volunteer org. Only pursue it if there is an **official Harvard
  sponsor** willing to shepherd the SP registration.
- **The pragmatic middle path is C or D** — email magic-link or Google sign-in
  with light manual approval — which needs no Harvard IT involvement and a small
  serverless function, not a platform migration. It captures more member data
  (which the feedback doc noted Harvard Key *limits*).
- **Option B only makes sense** if the org wants a full alumni platform (and
  budget), in which case much of this custom build becomes redundant.

## Decisions needed from the team

1. Is there an **official Harvard sponsor** who can pursue Harvard Key SP
   registration? (If no → Option A is effectively off the table.)
2. What's the **primary goal of login** — gating content, verifying alumni, or
   collecting member data? (The feedback flags Harvard Key limits data capture.)
3. Is login **required for v1**, or can the public site launch first with login
   as a fast-follow? *(Strongly recommend the latter.)*
4. Is there **budget** for a paid alumni platform (Option B)?

## Open questions to research (if we proceed with A)

- Does Harvard IAM permit SP registration for alumni volunteer organizations, or
  only official Harvard units?
- What is the review/approval timeline?
- What attributes does the Harvard IdP release (name, class year, email)?
