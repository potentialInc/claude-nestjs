# Authentication & Authorization Test Patterns

Comprehensive patterns for testing authentication and authorization in NestJS applications.

---

## Login Flow Testing

### Valid Credentials

```typescript
describe('POST /auth/login', () => {
    it('should return access token for valid credentials', async () => {
        const password = 'password123';
        const user = await createTestUser(setup.testDb.dataSource, { password });

        const response = await request(app.getHttpServer())
            .post('/auth/login')
            .send({
                email: user.email,
                password: password,
            })
            .expect(200);

        expect(response.body).toHaveProperty('accessToken');
        expect(typeof response.body.accessToken).toBe('string');
    });

    it('should return 401 for invalid credentials', async () => {
        await request(app.getHttpServer())
            .post('/auth/login')
            .send({
                email: 'wrong@example.com',
                password: 'wrongpassword',
            })
            .expect(401);
    });

    it('should return 401 for wrong password', async () => {
        const user = await createTestUser(setup.testDb.dataSource, { password: 'correct123' });

        await request(app.getHttpServer())
            .post('/auth/login')
            .send({
                email: user.email,
                password: 'wrongpassword',
            })
            .expect(401);
    });
});
```

---

## Protected Route Testing

### Token Validation

```typescript
describe('Protected Routes', () => {
    it('should allow access with valid token', async () => {
        const user = await createTestUser(setup.testDb.dataSource);
        const token = generateAccessToken(user);

        await request(app.getHttpServer())
            .get('/users/me')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
    });

    it('should reject expired token', async () => {
        const user = await createTestUser(setup.testDb.dataSource);
        const expiredToken = generateExpiredToken(user);

        await request(app.getHttpServer())
            .get('/users/me')
            .set('Authorization', `Bearer ${expiredToken}`)
            .expect(401);
    });

    it('should reject malformed token', async () => {
        await request(app.getHttpServer())
            .get('/users/me')
            .set('Authorization', 'Bearer invalid-token')
            .expect(401);
    });

    it('should reject missing Authorization header', async () => {
        await request(app.getHttpServer())
            .get('/users/me')
            .expect(401);
    });

    it('should reject wrong header format', async () => {
        const user = await createTestUser(setup.testDb.dataSource);
        const token = generateAccessToken(user);

        // Missing "Bearer" prefix
        await request(app.getHttpServer())
            .get('/users/me')
            .set('Authorization', token)
            .expect(401);
    });
});
```

---

## Role-Based Access Control

### Admin Routes

```typescript
describe('Role-Based Access', () => {
    it('should allow admin to access admin routes', async () => {
        const admin = await createTestUser(setup.testDb.dataSource, { role: 'admin' });
        const token = generateAccessToken(admin);

        await request(app.getHttpServer())
            .get('/admin/dashboard')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
    });

    it('should reject regular user from admin routes', async () => {
        const user = await createTestUser(setup.testDb.dataSource, { role: 'user' });
        const token = generateAccessToken(user);

        await request(app.getHttpServer())
            .get('/admin/dashboard')
            .set('Authorization', `Bearer ${token}`)
            .expect(403);
    });

    it('should reject unauthenticated access to admin routes', async () => {
        await request(app.getHttpServer())
            .get('/admin/dashboard')
            .expect(401);
    });
});
```

### Multiple Role Support

```typescript
describe('Multiple Roles', () => {
    it('should allow both admin and moderator', async () => {
        const admin = await createTestUser(setup.testDb.dataSource, { role: 'admin' });
        const moderator = await createTestUser(setup.testDb.dataSource, { role: 'moderator' });

        const adminToken = generateAccessToken(admin);
        const modToken = generateAccessToken(moderator);

        await request(app.getHttpServer())
            .get('/moderation/reports')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        await request(app.getHttpServer())
            .get('/moderation/reports')
            .set('Authorization', `Bearer ${modToken}`)
            .expect(200);
    });

    it('should reject user role', async () => {
        const user = await createTestUser(setup.testDb.dataSource, { role: 'user' });
        const token = generateAccessToken(user);

        await request(app.getHttpServer())
            .get('/moderation/reports')
            .set('Authorization', `Bearer ${token}`)
            .expect(403);
    });
});
```

---

## Resource Ownership Testing

### User Can Access Own Resources

```typescript
describe('Resource Ownership', () => {
    it('should allow user to access own profile', async () => {
        const user = await createTestUser(setup.testDb.dataSource);
        const token = generateAccessToken(user);

        const response = await request(app.getHttpServer())
            .get(`/users/${user.id}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(response.body.data.id).toBe(user.id);
    });

    it('should prevent user from accessing other profiles', async () => {
        const user1 = await createTestUser(setup.testDb.dataSource);
        const user2 = await createTestUser(setup.testDb.dataSource);
        const token = generateAccessToken(user1);

        await request(app.getHttpServer())
            .get(`/users/${user2.id}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(403);
    });

    it('should allow admin to access any profile', async () => {
        const admin = await createTestUser(setup.testDb.dataSource, { role: 'admin' });
        const user = await createTestUser(setup.testDb.dataSource);
        const token = generateAccessToken(admin);

        const response = await request(app.getHttpServer())
            .get(`/users/${user.id}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(response.body.data.id).toBe(user.id);
    });
});
```

### Update Own Resources

```typescript
describe('Update Ownership', () => {
    it('should allow user to update own data', async () => {
        const user = await createTestUser(setup.testDb.dataSource);
        const token = generateAccessToken(user);

        await request(app.getHttpServer())
            .patch(`/users/${user.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ firstName: 'Updated' })
            .expect(200);
    });

    it('should prevent user from updating others data', async () => {
        const user1 = await createTestUser(setup.testDb.dataSource);
        const user2 = await createTestUser(setup.testDb.dataSource);
        const token = generateAccessToken(user1);

        await request(app.getHttpServer())
            .patch(`/users/${user2.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ firstName: 'Hacked' })
            .expect(403);
    });
});
```

---

## Registration & Email Verification

### User Registration

```typescript
describe('POST /auth/register', () => {
    it('should register new user', async () => {
        const response = await request(app.getHttpServer())
            .post('/auth/register')
            .send({
                email: 'newuser@example.com',
                password: 'password123',
                firstName: 'John',
                lastName: 'Doe',
            })
            .expect(201);

        expect(response.body.data).toHaveProperty('id');
        expect(response.body.data.email).toBe('newuser@example.com');
        expect(response.body.data.password).toBeUndefined();
    });

    it('should reject duplicate email', async () => {
        const existingUser = await createTestUser(setup.testDb.dataSource);

        await request(app.getHttpServer())
            .post('/auth/register')
            .send({
                email: existingUser.email,
                password: 'password123',
            })
            .expect(409);
    });

    it('should validate email format', async () => {
        const response = await request(app.getHttpServer())
            .post('/auth/register')
            .send({
                email: 'invalid-email',
                password: 'password123',
            })
            .expect(400);

        expect(response.body.message).toContain('email');
    });

    it('should enforce password requirements', async () => {
        await request(app.getHttpServer())
            .post('/auth/register')
            .send({
                email: 'test@example.com',
                password: '123', // Too short
            })
            .expect(400);
    });
});
```

---

## Password Reset Flow

```typescript
describe('Password Reset', () => {
    it('should send reset token to valid email', async () => {
        const user = await createTestUser(setup.testDb.dataSource);

        const response = await request(app.getHttpServer())
            .post('/auth/forgot-password')
            .send({ email: user.email })
            .expect(200);

        expect(response.body.message).toContain('sent');
    });

    it('should not reveal non-existent emails', async () => {
        // Should return 200 even if email doesn't exist (security)
        await request(app.getHttpServer())
            .post('/auth/forgot-password')
            .send({ email: 'nonexistent@example.com' })
            .expect(200);
    });

    it('should reset password with valid token', async () => {
        const user = await createTestUser(setup.testDb.dataSource);
        const resetToken = await generatePasswordResetToken(user);

        await request(app.getHttpServer())
            .post('/auth/reset-password')
            .send({
                token: resetToken,
                newPassword: 'newpassword123',
            })
            .expect(200);

        // Verify can login with new password
        await request(app.getHttpServer())
            .post('/auth/login')
            .send({
                email: user.email,
                password: 'newpassword123',
            })
            .expect(200);
    });

    it('should reject expired reset token', async () => {
        const user = await createTestUser(setup.testDb.dataSource);
        const expiredToken = await generateExpiredResetToken(user);

        await request(app.getHttpServer())
            .post('/auth/reset-password')
            .send({
                token: expiredToken,
                newPassword: 'newpassword123',
            })
            .expect(401);
    });
});
```

---

## Refresh Token Testing

```typescript
describe('Refresh Token', () => {
    it('should refresh access token with valid refresh token', async () => {
        const user = await createTestUser(setup.testDb.dataSource);
        const refreshToken = generateRefreshToken(user);

        const response = await request(app.getHttpServer())
            .post('/auth/refresh')
            .send({ refreshToken })
            .expect(200);

        expect(response.body).toHaveProperty('accessToken');
        expect(response.body).toHaveProperty('refreshToken');
    });

    it('should reject expired refresh token', async () => {
        const user = await createTestUser(setup.testDb.dataSource);
        const expiredToken = generateExpiredRefreshToken(user);

        await request(app.getHttpServer())
            .post('/auth/refresh')
            .send({ refreshToken: expiredToken })
            .expect(401);
    });

    it('should reject revoked refresh token', async () => {
        const user = await createTestUser(setup.testDb.dataSource);
        const refreshToken = generateRefreshToken(user);

        // Revoke token
        await revokeRefreshToken(refreshToken);

        await request(app.getHttpServer())
            .post('/auth/refresh')
            .send({ refreshToken })
            .expect(401);
    });
});
```

---

## Logout Testing

```typescript
describe('Logout', () => {
    it('should invalidate refresh token on logout', async () => {
        const user = await createTestUser(setup.testDb.dataSource);
        const token = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        await request(app.getHttpServer())
            .post('/auth/logout')
            .set('Authorization', `Bearer ${token}`)
            .send({ refreshToken })
            .expect(200);

        // Token should no longer work
        await request(app.getHttpServer())
            .post('/auth/refresh')
            .send({ refreshToken })
            .expect(401);
    });
});
```

---

## Related Files

- [supertest-patterns.md](../supertest-patterns.md) - Main patterns guide
- [crud-patterns.md](./crud-patterns.md) - CRUD testing patterns

---

**Related Skills**: [supertest-patterns](../supertest-patterns.md), [jest-fixtures](../jest-fixtures.md)
