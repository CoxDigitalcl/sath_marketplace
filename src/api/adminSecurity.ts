import { api } from './client';

export class AdminStepUpCancelledError extends Error {
    constructor() {
        super('Confirmación de seguridad cancelada.');
        this.name = 'AdminStepUpCancelledError';
    }
}

const promptForAdminPassword = (): Promise<string> => new Promise((resolve, reject) => {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 p-4';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'admin-step-up-title');

    const form = document.createElement('form');
    form.className = 'w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl';
    form.innerHTML = `
        <h2 id="admin-step-up-title" class="text-lg font-bold text-gray-900">Confirmación de seguridad</h2>
        <p class="mt-2 text-sm text-gray-600">Confirma nuevamente tu contraseña de administrador para continuar.</p>
        <label for="admin-step-up-password" class="mt-5 block text-sm font-medium text-gray-800">Contraseña</label>
        <input id="admin-step-up-password" type="password" autocomplete="current-password" required maxlength="256"
            class="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20">
        <div class="mt-6 flex justify-end gap-3">
            <button type="button" data-cancel class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancelar</button>
            <button type="submit" class="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90">Confirmar</button>
        </div>`;

    const input = form.querySelector<HTMLInputElement>('#admin-step-up-password');
    const cancelButton = form.querySelector<HTMLButtonElement>('[data-cancel]');
    if (!input || !cancelButton) {
        reject(new Error('No fue posible abrir la confirmación de seguridad.'));
        return;
    }

    const cleanup = () => {
        document.removeEventListener('keydown', handleKeyDown);
        overlay.remove();
    };
    const cancel = () => {
        input.value = '';
        cleanup();
        reject(new AdminStepUpCancelledError());
    };
    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') cancel();
    };

    cancelButton.addEventListener('click', cancel);
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const password = input.value;
        input.value = '';
        cleanup();
        if (!password) {
            reject(new AdminStepUpCancelledError());
            return;
        }
        resolve(password);
    });
    overlay.addEventListener('mousedown', (event) => {
        if (event.target === overlay) cancel();
    });
    document.addEventListener('keydown', handleKeyDown);
    overlay.append(form);
    document.body.append(overlay);
    input.focus();
});

export const requestAdminStepUp = async (): Promise<string> => {
    const password = await promptForAdminPassword();
    const response = await api.post('/auth/step-up', { password });
    const token = response.data?.data?.stepUpToken;
    if (typeof token !== 'string' || !token) {
        throw new Error('No fue posible obtener la confirmación de seguridad.');
    }
    return token;
};

export const withAdminStepUp = (token: string) => ({
    'X-Admin-Step-Up': token
});
