import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../../src/components/ErrorLogProvider.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
}).outputText;

const mountErrorLog = () => {
    let errors = [];
    let cleanup;
    const listeners = new Map();
    const react = {
        createContext: () => ({ Provider() {} }),
        createElement: () => null,
        useState: () => [errors, (update) => { errors = update(errors); }],
        useCallback: (callback) => callback,
        useEffect: (effect) => { cleanup = effect(); },
    };
    const exports = {};
    vm.runInNewContext(compiled, {
        exports,
        Error,
        window: {
            addEventListener: (name, listener) => listeners.set(name, listener),
            removeEventListener: (name, listener) => {
                if (listeners.get(name) === listener) listeners.delete(name);
            },
        },
        require: (name) => {
            if (name === 'react') return { ...react, default: react };
            if (name === './ErrorLogConsole') return { default() {} };
            throw new Error(`Unexpected import: ${name}`);
        },
    });
    exports.default({ children: null });
    return { listeners, errors: () => errors, unmount: () => cleanup() };
};

const nativeMediaError = (overrides = {}) => ({
    message: "ReferenceError: Can't find variable: EmptyRanges",
    filename: '',
    error: { stack: 'played@\nsyncControl@\nhandleEvent@' },
    ...overrides,
});

test('the known Safari media-controls exception stays out of the platform error panel', () => {
    const log = mountErrorLog();
    let prevented = false;
    log.listeners.get('error')(nativeMediaError({ preventDefault() { prevented = true; } }));
    log.listeners.get('error')(nativeMediaError({ error: {
        stack: 'buffered@\nendTimeForBufferedRangeContainingCurrentTime@\nsyncControl@\nhandleEvent@',
    } }));
    log.listeners.get('error')(nativeMediaError({ error: {
        stack: "ReferenceError: Can't find variable: EmptyRanges\nseekable@[native code]\nsyncControl@[native code]\nhandleEvent@[native code]",
    } }));
    assert.equal(log.errors().length, 0);
    assert.equal(prevented, false, 'the browser should still report its own exception');
    log.unmount();
    assert.equal(log.listeners.size, 0);
});

test('application errors with the same message or an incomplete native trace remain visible', () => {
    const log = mountErrorLog();
    const report = log.listeners.get('error');
    report(nativeMediaError({ filename: 'https://example.test/assets/checkout.js' }));
    report(nativeMediaError({ error: { stack: 'played@https://example.test/assets/checkout.js:1:20\nsyncControl@\nhandleEvent@' } }));
    report(nativeMediaError({ error: { stack: 'syncControl@\nhandleEvent@' } }));
    report(nativeMediaError({ error: null }));
    report(nativeMediaError({ message: "ReferenceError: Can't find variable: paymentResult" }));
    report({ message: 'Failed to fetch payment status', filename: '', error: null });
    assert.equal(log.errors().length, 6);
});

test('payment promise rejections remain visible, including an error with the Safari message', () => {
    const log = mountErrorLog();
    const report = log.listeners.get('unhandledrejection');
    report({ reason: new Error('Payment request failed') });
    const similarError = new Error("Can't find variable: EmptyRanges");
    similarError.stack = 'played@\nsyncControl@\nhandleEvent@';
    report({ reason: similarError });
    report({ reason: 'Gateway unavailable' });
    assert.equal(log.errors().length, 3);
});
