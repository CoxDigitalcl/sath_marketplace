import assert from 'node:assert/strict';
import test from 'node:test';
import '../config/db.js';
import { sendCrossContactEmails } from '../services/notificationService.js';

test('payment emails include both contacts and use the Chilean service date and selected time', async () => {
    const sent = [];
    await sendCrossContactEmails({
        bookingId: 'TEST1234', serviceName: 'Servicio de prueba',
        client: { name: 'Cliente', email: 'client@example.test', phone: '111' },
        provider: { name: 'Proveedor', email: 'provider@example.test', phone: '222' },
        booking: { scheduled_date: '2026-11-13T02:00:00Z', selected_times: ['23:00'], amount: 6000 },
        send: async payload => { sent.push(payload); return true; },
    });
    assert.equal(sent.length, 2);
    for (const email of sent) {
        assert.match(email.html, /jueves,? 12 de noviembre de 2026/);
        assert.match(email.html, /23:00/);
        assert.match(email.html, /6\.000/);
        assert.match(email.html, /Servicio de prueba/);
        assert.match(email.html, /custodia/);
    }
    assert.equal(sent[0].to, 'client@example.test');
    assert.match(sent[0].html, /provider@example\.test/);
    assert.equal(sent[1].to, 'provider@example.test');
    assert.match(sent[1].html, /client@example\.test/);
});
