import '@testing-library/jest-dom'

process.env.NEXTAUTH_SECRET = 'test-secret-32-chars-minimum-here!!'
process.env.NEXTAUTH_URL = 'http://localhost:3000'
process.env.MAIL_DOMAIN = 'maillab.local'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
