import React from 'react';

const h = React.createElement;

const link = (item, className = 'text-brand-primary hover:underline') => h(
    'a',
    { href: item.href, className },
    item.label
);

const Breadcrumbs = ({ items = [] }) => {
    if (items.length === 0) return null;

    return h(
        'nav',
        { 'aria-label': 'Migas de pan', className: 'mb-6 text-sm text-gray-600' },
        h(
            'ol',
            { className: 'flex flex-wrap items-center gap-2' },
            items.map((item, index) => h(
                'li',
                { key: `${item.href || 'current'}-${index}`, className: 'flex items-center gap-2' },
                index > 0 ? h('span', { 'aria-hidden': 'true' }, '/') : null,
                item.href ? link(item) : h('span', { 'aria-current': 'page' }, item.label)
            ))
        )
    );
};

const CategoryLinks = ({ categories = [] }) => h(
    'section',
    { 'aria-labelledby': 'ssr-categories-heading', className: 'mt-10' },
    h('h2', { id: 'ssr-categories-heading', className: 'text-2xl font-bold text-gray-900' }, 'Explora por categoría'),
    h(
        'ul',
        { className: 'mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3' },
        categories.map((category) => h(
            'li',
            { key: category.href, className: 'rounded-xl border border-gray-200 bg-white p-5 shadow-sm' },
            h('h3', { className: 'text-lg font-semibold text-gray-900' }, link({
                href: category.href,
                label: category.name
            }, 'text-gray-900 hover:text-brand-primary hover:underline')),
            h('p', { className: 'mt-2 text-sm leading-6 text-gray-600' }, category.description)
        ))
    )
);

const ServiceLinks = ({ services = [], emptyMessage = 'No hay servicios públicos disponibles por el momento.' }) => h(
    'section',
    { 'aria-labelledby': 'ssr-services-heading', className: 'mt-10' },
    h('h2', { id: 'ssr-services-heading', className: 'text-2xl font-bold text-gray-900' }, 'Servicios disponibles'),
    services.length === 0
        ? h('p', { className: 'mt-4 text-gray-600' }, emptyMessage)
        : h(
            'ul',
            { className: 'mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3' },
            services.map((service) => h(
                'li',
                { key: service.href, className: 'rounded-xl border border-gray-200 bg-white p-5 shadow-sm' },
                h('article', null,
                    h('h3', { className: 'text-lg font-semibold text-gray-900' }, link({
                        href: service.href,
                        label: service.title
                    }, 'text-gray-900 hover:text-brand-primary hover:underline')),
                    service.description
                        ? h('p', { className: 'mt-2 text-sm leading-6 text-gray-600' }, service.description)
                        : null,
                    service.providerName
                        ? h('p', { className: 'mt-3 text-sm text-gray-600' },
                            'Ofrecido por ',
                            service.providerHref
                                ? link({ href: service.providerHref, label: service.providerName })
                                : service.providerName
                        )
                        : null,
                    h('dl', { className: 'mt-4 space-y-1 text-sm' },
                        service.priceLabel ? h(React.Fragment, null,
                            h('dt', { className: 'inline font-medium text-gray-900' }, 'Precio: '),
                            h('dd', { className: 'inline text-gray-700' }, service.priceLabel),
                            h('br')
                        ) : null,
                        service.scope ? h(React.Fragment, null,
                            h('dt', { className: 'inline font-medium text-gray-900' }, 'Cobertura: '),
                            h('dd', { className: 'inline text-gray-700' }, service.scope)
                        ) : null
                    )
                )
            ))
        )
);

const PageIntro = ({ page }) => h(React.Fragment, null,
    h('h1', { className: 'text-3xl font-bold tracking-tight text-gray-900 md:text-4xl' }, page.heading),
    page.description
        ? h('p', { className: 'mt-4 max-w-3xl text-lg leading-8 text-gray-700' }, page.description)
        : null
);

const HomePage = ({ page }) => h(React.Fragment, null,
    h('section', { className: 'rounded-2xl bg-white p-7 shadow-sm md:p-10' },
        h(PageIntro, { page }),
        h('p', { className: 'mt-6' }, link({ href: '/categories', label: 'Ver todas las categorías' },
            'inline-flex rounded-full bg-brand-primary px-5 py-3 font-semibold text-white'))
    ),
    h(CategoryLinks, { categories: page.categories }),
    h(ServiceLinks, { services: page.services })
);

const CategoriesPage = ({ page }) => h(React.Fragment, null,
    h(PageIntro, { page }),
    h(CategoryLinks, { categories: page.categories })
);

const CategoryPage = ({ page }) => h(React.Fragment, null,
    h(PageIntro, { page }),
    h(ServiceLinks, {
        services: page.services,
        emptyMessage: 'Aún no hay servicios públicos disponibles en esta categoría.'
    }),
    h('p', { className: 'mt-8' }, link({ href: '/categories', label: 'Explorar otras categorías' }))
);

const ServicePage = ({ page }) => h(
    'article',
    { className: 'grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]' },
    h('div', null,
        h(PageIntro, { page }),
        h('section', { 'aria-labelledby': 'ssr-service-description', className: 'mt-8 rounded-xl bg-white p-6 shadow-sm' },
            h('h2', { id: 'ssr-service-description', className: 'text-xl font-bold text-gray-900' }, 'Acerca de este servicio'),
            h('p', { className: 'mt-3 whitespace-pre-line leading-7 text-gray-700' }, page.fullDescription)
        ),
        page.provider
            ? h('section', { 'aria-labelledby': 'ssr-provider-heading', className: 'mt-6 rounded-xl bg-white p-6 shadow-sm' },
                h('h2', { id: 'ssr-provider-heading', className: 'text-xl font-bold text-gray-900' }, 'Proveedor verificado'),
                h('p', { className: 'mt-3' }, link({ href: page.provider.href, label: page.provider.name }))
            )
            : null
    ),
    h('aside', { className: 'rounded-xl border border-gray-200 bg-white p-6 shadow-sm' },
        h('h2', { className: 'text-xl font-bold text-gray-900' }, 'Información del servicio'),
        h('dl', { className: 'mt-4 space-y-4' },
            page.priceLabel ? h('div', null,
                h('dt', { className: 'text-sm font-medium text-gray-500' }, 'Precio publicado'),
                h('dd', { className: 'mt-1 text-2xl font-bold text-gray-900' }, page.priceLabel)
            ) : null,
            page.scope ? h('div', null,
                h('dt', { className: 'text-sm font-medium text-gray-500' }, 'Cobertura'),
                h('dd', { className: 'mt-1 text-gray-800' }, page.scope)
            ) : null,
            page.serviceType ? h('div', null,
                h('dt', { className: 'text-sm font-medium text-gray-500' }, 'Modalidad'),
                h('dd', { className: 'mt-1 text-gray-800' }, page.serviceType)
            ) : null
        ),
        h('p', { className: 'mt-6 text-sm leading-6 text-gray-600' },
            'La disponibilidad y el valor final se confirman antes del pago.'
        )
    )
);

const ProviderPage = ({ page }) => h(React.Fragment, null,
    h(PageIntro, { page }),
    h('dl', { className: 'mt-6 flex flex-wrap gap-6 rounded-xl bg-white p-6 shadow-sm' },
        h('div', null,
            h('dt', { className: 'text-sm font-medium text-gray-500' }, 'Verificación'),
            h('dd', { className: 'mt-1 font-semibold text-green-700' }, 'Proveedor verificado')
        ),
        page.scope ? h('div', null,
            h('dt', { className: 'text-sm font-medium text-gray-500' }, 'Cobertura'),
            h('dd', { className: 'mt-1 text-gray-800' }, page.scope)
        ) : null
    ),
    h(ServiceLinks, {
        services: page.services,
        emptyMessage: 'Este proveedor aún no tiene servicios públicos disponibles.'
    })
);

const LegalPage = ({ page }) => h(
    'article',
    { className: 'mx-auto max-w-4xl rounded-xl bg-white p-7 shadow-sm md:p-10' },
    h(PageIntro, { page }),
    page.lastUpdated ? h('p', { className: 'mt-3 text-sm text-gray-500' }, `Última actualización: ${page.lastUpdated}`) : null,
    h('div', { className: 'mt-8 space-y-4 text-gray-700' },
        page.paragraphs.map((paragraph, index) => h('p', { key: index, className: 'leading-7' }, paragraph))
    )
);

const ErrorPage = ({ page }) => h('section', { className: 'rounded-xl bg-white p-8 text-center shadow-sm' },
    h(PageIntro, { page }),
    h('p', { className: 'mt-6' }, link({ href: '/', label: 'Volver al inicio' }))
);

const renderPage = (page) => {
    switch (page.kind) {
        case 'home': return h(HomePage, { page });
        case 'categories': return h(CategoriesPage, { page });
        case 'category': return h(CategoryPage, { page });
        case 'service': return h(ServicePage, { page });
        case 'provider': return h(ProviderPage, { page });
        case 'legal': return h(LegalPage, { page });
        default: return h(ErrorPage, { page });
    }
};

export const PublicSsrView = ({ page }) => h(
    'div',
    { 'data-public-ssr': 'true', 'data-route-id': page.routeId, className: 'min-h-screen bg-gray-50 text-gray-900' },
    h('header', { className: 'border-b border-gray-200 bg-white' },
        h('div', { className: 'container mx-auto flex items-center justify-between px-4 py-5' },
            link({ href: '/', label: 'Servicios a tu Hogar' }, 'text-xl font-bold text-gray-900'),
            h('nav', { 'aria-label': 'Navegación principal', className: 'flex gap-5 text-sm font-medium' },
                link({ href: '/categories', label: 'Categorías' }, 'text-gray-700 hover:text-brand-primary'),
                link({ href: '/login', label: 'Ingresar' }, 'text-gray-700 hover:text-brand-primary')
            )
        )
    ),
    h('main', { className: 'container mx-auto px-4 py-8 md:py-12' },
        h(Breadcrumbs, { items: page.breadcrumbs }),
        renderPage(page)
    ),
    h('footer', { className: 'mt-12 border-t border-gray-200 bg-white' },
        h('div', { className: 'container mx-auto flex flex-wrap gap-5 px-4 py-8 text-sm text-gray-600' },
            link({ href: '/', label: 'Inicio' }, 'hover:text-brand-primary'),
            link({ href: '/categories', label: 'Categorías' }, 'hover:text-brand-primary'),
            page.legalLinks?.map((item) => h(React.Fragment, { key: item.href }, link(item, 'hover:text-brand-primary')))
        )
    )
);

export default PublicSsrView;
