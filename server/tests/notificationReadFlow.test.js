import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { pool } from '../config/db.js';
import { markAllAsRead, markAsRead } from '../controllers/notificationController.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');

const createResponse = () => ({
    statusCode: 200,
    body: null,
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(body) {
        this.body = body;
        return this;
    }
});

test('marks one owned notification as read and returns the updated record', async (t) => {
    const originalQuery = pool.query;
    const calls = [];
    t.after(() => { pool.query = originalQuery; });
    pool.query = async (sql, params) => {
        calls.push({ sql, params });
        return { rowCount: 1, rows: [{ id: 'notification-1', is_read: true }] };
    };

    const response = createResponse();
    let forwardedError = null;
    await markAsRead(
        { user: { id: 'user-1' }, params: { id: 'notification-1' } },
        response,
        (error) => { forwardedError = error; }
    );

    assert.equal(forwardedError, null);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, {
        status: 'success',
        notification: { id: 'notification-1', is_read: true }
    });
    assert.deepEqual(calls[0].params, ['notification-1', 'user-1']);
    assert.match(calls[0].sql, /RETURNING id, is_read/);
});

test('does not report success when the notification is outside the user scope', async (t) => {
    const originalQuery = pool.query;
    t.after(() => { pool.query = originalQuery; });
    pool.query = async () => ({ rowCount: 0, rows: [] });

    const response = createResponse();
    await markAsRead(
        { user: { id: 'user-1' }, params: { id: 'missing' } },
        response,
        (error) => { throw error; }
    );

    assert.equal(response.statusCode, 404);
    assert.equal(response.body.code, 'NOTIFICATION_NOT_FOUND');
});

test('marks all unread notifications and reports the affected count', async (t) => {
    const originalQuery = pool.query;
    let queryParams;
    t.after(() => { pool.query = originalQuery; });
    pool.query = async (_sql, params) => {
        queryParams = params;
        return { rowCount: 3, rows: [{ id: '1' }, { id: '2' }, { id: '3' }] };
    };

    const response = createResponse();
    await markAllAsRead(
        { user: { id: 'user-1' } },
        response,
        (error) => { throw error; }
    );

    assert.deepEqual(queryParams, ['user-1']);
    assert.deepEqual(response.body, { status: 'success', updatedCount: 3 });
});

test('frontend sends valid JSON bodies and exposes mutation failures', async () => {
    const source = await fs.readFile(
        path.join(root, 'src/components/common/NotificationDropdown.tsx'),
        'utf8'
    );

    assert.match(source, /api\.patch\(`\/notifications\/\$\{id\}\/read`, \{\}\)/);
    assert.match(source, /api\.patch\('\/notifications\/read-all', \{\}\)/);
    assert.match(source, /toast\.error\('No se pudo marcar la notificación como leída/);
    assert.match(source, /toast\.error\('No se pudieron marcar las notificaciones como leídas/);
});
