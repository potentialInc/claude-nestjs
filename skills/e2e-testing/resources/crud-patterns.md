# Complete CRUD Testing Patterns

Comprehensive patterns for testing all CRUD operations in NestJS applications with Supertest.

---

## Full CRUD Test Suite

```typescript
describe('Products CRUD (e2e)', () => {
    let adminToken: string;
    let userToken: string;

    beforeEach(async () => {
        await setup.testDb.cleanDatabase();

        const admin = await createTestUser(setup.testDb.dataSource, { role: 'admin' });
        const user = await createTestUser(setup.testDb.dataSource, { role: 'user' });

        adminToken = generateAccessToken(admin);
        userToken = generateAccessToken(user);
    });

    describe('CREATE', () => {
        const createDto = {
            name: 'Test Product',
            price: 99.99,
            description: 'A test product',
        };

        it('should create product as admin', async () => {
            const response = await request(app.getHttpServer())
                .post('/products')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(createDto)
                .expect(201);

            expect(response.body.data.name).toBe(createDto.name);
            expect(response.body.data.id).toBeDefined();
        });

        it('should reject create without admin role', async () => {
            await request(app.getHttpServer())
                .post('/products')
                .set('Authorization', `Bearer ${userToken}`)
                .send(createDto)
                .expect(403);
        });
    });

    describe('READ', () => {
        let productId: string;

        beforeEach(async () => {
            const response = await request(app.getHttpServer())
                .post('/products')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Test', price: 10 });

            productId = response.body.data.id;
        });

        it('should get all products', async () => {
            const response = await request(app.getHttpServer())
                .get('/products')
                .set('Authorization', `Bearer ${userToken}`)
                .expect(200);

            expect(response.body.data.length).toBeGreaterThan(0);
        });

        it('should get single product', async () => {
            const response = await request(app.getHttpServer())
                .get(`/products/${productId}`)
                .set('Authorization', `Bearer ${userToken}`)
                .expect(200);

            expect(response.body.data.id).toBe(productId);
        });

        it('should return 404 for non-existent product', async () => {
            await request(app.getHttpServer())
                .get('/products/non-existent-id')
                .set('Authorization', `Bearer ${userToken}`)
                .expect(404);
        });
    });

    describe('UPDATE', () => {
        let productId: string;

        beforeEach(async () => {
            const response = await request(app.getHttpServer())
                .post('/products')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Original', price: 10 });

            productId = response.body.data.id;
        });

        it('should update product as admin', async () => {
            const response = await request(app.getHttpServer())
                .patch(`/products/${productId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Updated' })
                .expect(200);

            expect(response.body.data.name).toBe('Updated');
        });
    });

    describe('DELETE', () => {
        let productId: string;

        beforeEach(async () => {
            const response = await request(app.getHttpServer())
                .post('/products')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'ToDelete', price: 10 });

            productId = response.body.data.id;
        });

        it('should delete product as admin', async () => {
            await request(app.getHttpServer())
                .delete(`/products/${productId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            // Verify deletion
            await request(app.getHttpServer())
                .get(`/products/${productId}`)
                .set('Authorization', `Bearer ${userToken}`)
                .expect(404);
        });
    });
});
```

---

## Validation Testing

### Missing Required Fields

```typescript
describe('Validation Errors', () => {
    it('should return 400 for missing required fields', async () => {
        const admin = await createTestUser(setup.testDb.dataSource, { role: 'admin' });
        const token = generateAccessToken(admin);

        const response = await request(app.getHttpServer())
            .post('/users')
            .set('Authorization', `Bearer ${token}`)
            .send({}) // Missing required fields
            .expect(400);

        expect(response.body.message).toContain('email');
    });

    it('should return 400 for invalid email format', async () => {
        const admin = await createTestUser(setup.testDb.dataSource, { role: 'admin' });
        const token = generateAccessToken(admin);

        const response = await request(app.getHttpServer())
            .post('/users')
            .set('Authorization', `Bearer ${token}`)
            .send({
                email: 'invalid-email',
                password: 'password123',
            })
            .expect(400);

        expect(response.body.message).toContain('email');
    });
});
```

### Conflict Errors (409)

```typescript
describe('Conflict Errors', () => {
    it('should return 409 for duplicate email', async () => {
        const existingUser = await createTestUser(setup.testDb.dataSource);
        const admin = await createTestUser(setup.testDb.dataSource, { role: 'admin' });
        const token = generateAccessToken(admin);

        const response = await request(app.getHttpServer())
            .post('/users')
            .set('Authorization', `Bearer ${token}`)
            .send({
                email: existingUser.email, // Duplicate email
                password: 'password123',
            })
            .expect(409);

        expect(response.body.message).toContain('already exists');
    });
});
```

---

## Pagination Testing

```typescript
describe('Pagination', () => {
    beforeEach(async () => {
        await setup.testDb.cleanDatabase();
        const admin = await createTestUser(setup.testDb.dataSource, { role: 'admin' });

        // Create 25 products
        for (let i = 0; i < 25; i++) {
            await createTestProduct(setup.testDb.dataSource, { name: `Product ${i}` });
        }
    });

    it('should return paginated results', async () => {
        const user = await createTestUser(setup.testDb.dataSource);
        const token = generateAccessToken(user);

        const response = await request(app.getHttpServer())
            .get('/products')
            .query({ page: 1, limit: 10 })
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(response.body.data.length).toBe(10);
        expect(response.body.meta).toMatchObject({
            total: 25,
            page: 1,
            limit: 10,
            totalPages: 3,
        });
    });

    it('should return correct page', async () => {
        const user = await createTestUser(setup.testDb.dataSource);
        const token = generateAccessToken(user);

        const response = await request(app.getHttpServer())
            .get('/products')
            .query({ page: 3, limit: 10 })
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(response.body.data.length).toBe(5); // 25 - 20 = 5 remaining
        expect(response.body.meta.page).toBe(3);
    });
});
```

---

## Sorting and Filtering

```typescript
describe('Sorting and Filtering', () => {
    beforeEach(async () => {
        await setup.testDb.cleanDatabase();

        await createTestProduct(setup.testDb.dataSource, { name: 'Apple', price: 10 });
        await createTestProduct(setup.testDb.dataSource, { name: 'Banana', price: 5 });
        await createTestProduct(setup.testDb.dataSource, { name: 'Cherry', price: 15 });
    });

    it('should sort by price ascending', async () => {
        const user = await createTestUser(setup.testDb.dataSource);
        const token = generateAccessToken(user);

        const response = await request(app.getHttpServer())
            .get('/products')
            .query({ sortBy: 'price', sortOrder: 'ASC' })
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(response.body.data[0].price).toBeLessThan(response.body.data[1].price);
    });

    it('should filter by name search', async () => {
        const user = await createTestUser(setup.testDb.dataSource);
        const token = generateAccessToken(user);

        const response = await request(app.getHttpServer())
            .get('/products')
            .query({ search: 'Apple' })
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].name).toBe('Apple');
    });
});
```

---

## Relationship Testing

```typescript
describe('Relationships', () => {
    it('should include related entities', async () => {
        const user = await createTestUser(setup.testDb.dataSource);
        const product = await createTestProduct(setup.testDb.dataSource, { userId: user.id });
        const token = generateAccessToken(user);

        const response = await request(app.getHttpServer())
            .get(`/products/${product.id}`)
            .query({ include: 'user' })
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(response.body.data.user).toBeDefined();
        expect(response.body.data.user.id).toBe(user.id);
    });

    it('should create with relationships', async () => {
        const user = await createTestUser(setup.testDb.dataSource);
        const category = await createTestCategory(setup.testDb.dataSource);
        const token = generateAccessToken(user);

        const response = await request(app.getHttpServer())
            .post('/products')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: 'Test Product',
                price: 99.99,
                categoryId: category.id,
            })
            .expect(201);

        expect(response.body.data.categoryId).toBe(category.id);
    });
});
```

---

## Related Files

- [supertest-patterns.md](../supertest-patterns.md) - Main patterns guide
- [auth-patterns.md](./auth-patterns.md) - Authentication patterns

---

**Related Skills**: [supertest-patterns](../supertest-patterns.md), [jest-fixtures](../jest-fixtures.md)
