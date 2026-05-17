# dll347

Monorepo starter for the `dll347` project using:

- Frontend: Next.js, React, TypeScript, Tailwind, PWA
- Backend: Django, Django REST Framework, PostgreSQL
- Communication: REST API

## Saved project defaults

- Database name: `dll347_db`
- Database user: `plughub`
- Database password: `Cablet0w`
- Backend env file: [backend/.env](/C:/Users/Dell%20Latitude%205350/OneDrive/Desktop/Projects/dll347/backend/.env)
- Frontend env file: [frontend/.env.local](/C:/Users/Dell%20Latitude%205350/OneDrive/Desktop/Projects/dll347/frontend/.env.local)

## API communication

- Frontend to backend communication is API-only over REST.
- Frontend requests should go through [frontend/src/lib/api.ts](/C:/Users/Dell%20Latitude%205350/OneDrive/Desktop/Projects/dll347/frontend/src/lib/api.ts).
- Backend API routes live under `/api/`.
- The public health endpoint is `GET /api/health/`.

## Security defaults

- CORS is restricted to the explicit frontend origins in `backend/.env`.
- CSRF trusted origins are explicitly allowlisted.
- DRF accepts JSON by default and throttles anonymous and authenticated traffic.
- Session and CSRF cookie `Secure` flags are environment-controlled and should be `True` behind HTTPS.
- The health endpoint no longer exposes database credentials or internal connection details.

## Run PostgreSQL

```powershell
docker compose up -d
```

## Run the backend

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Backend health endpoint:

```text
http://127.0.0.1:8000/api/health/
```

## Run the frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend app:

```text
http://127.0.0.1:3000
```
