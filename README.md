# JWT Auth Starter: Login & Register Guide

A minimal Express + MySQL backend built to help beginner developers understand how **login and registration with JWT (JSON Web Tokens)** actually works, including access tokens, refresh tokens, and httpOnly cookies.

This project intentionally keeps scope small (just signup, login, refresh, logout, and one protected test route) so the auth flow itself is easy to trace and learn from.

---

## Tech Stack

- **Node.js** + **Express**, server and routing
- **MySQL** (via `mysql2` pool), user storage
- **bcrypt**, password hashing
- **jsonwebtoken**, signing and verifying JWTs
- **cookie-parser**, reading cookies from incoming requests
- **express-validator**, request validation
- **cors**, cross-origin request handling (with cookie support)
- **dotenv**, environment variable management

---

## How the Auth Flow Works

This project uses **two tokens** instead of one, which is the standard production pattern:

| | Access Token | Refresh Token |
|---|---|---|
| Purpose | Proves who you are on every request | Used only to get a new access token |
| Lifespan | Short (15 minutes) | Long (7 days) |
| Sent on | Every protected request | Only to `/api/refresh` |
| Stored | httpOnly cookie | httpOnly cookie + DB (`refresh_token` column) |

**Why two tokens?** If an access token gets stolen, the damage window is small since it expires in 15 minutes. The refresh token is used far less often and can be revoked server side at any time, for example on logout, so it's safer to keep it long lived.

**Why httpOnly cookies instead of localStorage?** `httpOnly` cookies can't be read by JavaScript in the browser, which protects tokens from being stolen via XSS attacks. The tradeoff is that your frontend must send requests with `credentials: 'include'` (or `withCredentials: true` in axios) for cookies to be included cross-origin.

### The full lifecycle

1. **Signup**: password is hashed with bcrypt, user is saved to the DB
2. **Login**: credentials are checked, and if valid, an access token and refresh token are generated and set as httpOnly cookies. The refresh token is also saved in the DB against that user.
3. **Accessing a protected route**: middleware reads the access token from cookies, verifies its signature and expiry, and attaches the decoded user info to `req.user`
4. **Access token expires (after 15 min)**: frontend calls `/api/refresh`, which verifies the refresh token, checks it still matches what's stored in the DB (proving it hasn't been revoked), and issues a new access token
5. **Logout**: the refresh token is cleared from the DB (revoking it) and both cookies are cleared from the browser

---

## Project Structure

```
src/
  config/
    db.js                   # MySQL connection pool
  middleware/
    authenticateToken.js    # Verifies access token, protects routes
  modules/
    auth/
      authController.js     # signup, login, refresh, logout logic
  utils/
    tokens.js               # generateAccessToken, generateRefreshToken
server.js                       # routes + server entry point
.env                          # secrets and config (not committed)
```

---

## Environment Variables

Create a `.env` file in the project root:

```
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_db_password
DB_NAME=your_db_name

ACCESS_TOKEN_SECRET=your_access_token_secret
REFRESH_TOKEN_SECRET=your_refresh_token_secret
```

**Important:** leave `NODE_ENV=development` while testing locally on `http://localhost`. Only set `NODE_ENV=production` on your actual deployed server with HTTPS. The cookie `secure` flag depends on this, and setting it to `production` locally will silently break cookies over plain HTTP.

---

## API Endpoints

### `POST /api/signup`
Registers a new user.

**Body:**
```json
{
  "username": "raymond",
  "password": "mon123"
}
```

**Responses:** `201` on success, `400` if fields are missing or invalid or username is taken, `500` on server error.

---

### `POST /api/login`
Authenticates a user and issues both tokens as httpOnly cookies.

**Body:**
```json
{
  "username": "raymond",
  "password": "mon123"
}
```

**Responses:** `200` with basic user info on success, `400` if fields are missing, `401` for invalid credentials, `500` on server error.

---

### `POST /api/refresh`
Issues a new access token using the refresh token stored in cookies. No body needed, it reads the `refreshToken` cookie automatically.

**Responses:** `200` on success (new `accessToken` cookie is set), `401` if no refresh token is present, `403` if the token is invalid, expired, or revoked.

---

### `POST /api/logout`
Revokes the refresh token in the database and clears both cookies. No body needed.

**Responses:** `200` on success, `500` on server error.

---

### `GET /api/test-protected`
Example protected route. Requires a valid access token cookie.

**Responses:** `200` with decoded user info if authenticated, `401` if the token is missing, invalid, or expired.

---

## Tested with Postman

1. Postman automatically stores and resends cookies per domain, no manual copying needed, as long as you hit the same base URL across requests.
2. **Login** first (`POST /api/login`), then check the **Cookies** tab (near the Send button) to confirm `accessToken` and `refreshToken` were set.
3. Call **`GET /api/test-protected`**, it should return your decoded user info.
4. Call **`POST /api/refresh`**, it should return a new `accessToken` (compare the cookie value before and after to confirm it changed).
5. Call **`POST /api/logout`**, cookies should disappear from the Cookies tab, and `/api/test-protected` should now return `401`.

To test token expiry without waiting 15 minutes, temporarily shorten it in `utils/tokens.js`:

```javascript
{ expiresIn: '10s' }
```

Remember to change it back to `'15m'` afterward.

---

