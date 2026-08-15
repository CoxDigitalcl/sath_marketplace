export const TEMPORARY_POLICY_REVIEW_DEADLINE = '2026-11-15';

export const TEMPORARY_NOTICE = [
    'DOCUMENTO TEMPORAL SUJETO A REVISIÓN DEL DUEÑO DE LA PLATAFORMA.',
    'Debe ser revisado, completado y aprobado por el dueño y por asesoría jurídica antes del 15 de noviembre de 2026.',
    'La identificación legal del operador, su RUT, domicilio y representante legal están pendientes de completar.'
].join(' ');

const termsContent = [
    TEMPORARY_NOTICE,
    '1. Operador y contacto',
    'Servicios a tu Hogar es una plataforma digital de intermediación para publicar, buscar y coordinar servicios. El operador legal de la plataforma deberá completar antes de la revisión final: razón social o nombre, RUT, domicilio y representante legal. Para consultas y reclamos se encuentra disponible soporte@serviciosatuhogar.cl.',
    '2. Aceptación y capacidad',
    'El uso de la plataforma y la creación de una cuenta suponen la aceptación de estos términos. Las personas usuarias declaran tener al menos 18 años y capacidad para contratar. Si no aceptan estas condiciones, no deben utilizar la plataforma.',
    '3. Funcionamiento del marketplace',
    'La plataforma conecta a clientes con proveedores independientes. Cada proveedor es responsable de describir, ofrecer y ejecutar sus servicios con información veraz, precio claro, alcance, disponibilidad y condiciones relevantes. Esta intermediación no limita los derechos irrenunciables que la ley reconoce a consumidores ni las responsabilidades que correspondan al operador o al proveedor.',
    '4. Cuentas y seguridad',
    'La información de registro debe ser exacta y mantenerse actualizada. Cada persona es responsable de resguardar sus credenciales y de informar de inmediato cualquier acceso no autorizado. La plataforma puede solicitar verificaciones razonables para proteger a clientes, proveedores y transacciones.',
    '5. Publicaciones, reservas y precio',
    'Antes de contratar deben mostrarse las características esenciales del servicio, identidad o nombre público del proveedor, precio total informado, forma de pago, cobertura, duración estimada y restricciones relevantes. La reserva queda sujeta a la confirmación indicada en el flujo. Los cambios de alcance o precio deben ser aceptados expresamente por el cliente antes de ejecutarse.',
    '6. Pagos',
    'Los pagos electrónicos pueden ser procesados por Payku u otro proveedor informado en el flujo. La plataforma conserva referencias de transacción y estados necesarios para conciliación y soporte, pero no solicita ni almacena directamente credenciales completas de tarjetas. Los comprobantes y cargos aplicables se informarán conforme al flujo de compra.',
    '7. Retracto, cancelaciones y reembolsos',
    'Los derechos de retracto, cancelación, restitución y reembolso se aplicarán según la Ley N° 19.496 y las condiciones particulares informadas antes de contratar. Cuando proceda el retracto en una contratación electrónica, su ejercicio deberá solicitarse dentro del plazo legal y antes de que el servicio haya comenzado a prestarse, salvo una regla legal más favorable. Ninguna condición de la plataforma elimina derechos irrenunciables del consumidor.',
    '8. Prestación, seguridad y reclamos',
    'Cliente y proveedor deben acordar condiciones de acceso, seguridad y ejecución. No se permiten servicios ilegales, engañosos, peligrosos o que vulneren derechos de terceros. Los problemas deben reportarse a soporte@serviciosatuhogar.cl con los antecedentes disponibles para facilitar su revisión, sin perjuicio de las acciones ante autoridades competentes.',
    '9. Contenido, opiniones y propiedad intelectual',
    'Quien publique textos, imágenes, videos u opiniones declara contar con autorización para ello y concede a la plataforma una licencia no exclusiva limitada a operar y promocionar el marketplace. Las reseñas deben reflejar experiencias reales. Se prohíben contenidos falsos, discriminatorios, difamatorios, ilícitos o que infrinjan propiedad intelectual.',
    '10. Moderación y suspensión',
    'La plataforma puede moderar, pausar o retirar publicaciones y cuentas cuando exista incumplimiento, riesgo, fraude, requerimiento de autoridad o necesidad de proteger a usuarios. Cuando sea razonablemente posible se informará el motivo y se habilitará un canal de revisión.',
    '11. Responsabilidad',
    'Cada parte responde por sus propios actos y obligaciones. La plataforma aplicará medidas razonables de operación y seguridad, pero no garantiza disponibilidad ininterrumpida ni resultados específicos de proveedores independientes. Esta cláusula no excluye responsabilidad por dolo, culpa grave ni obligaciones o derechos que no puedan renunciarse conforme a la ley.',
    '12. Datos personales',
    'El tratamiento de datos personales se rige por la Política de Privacidad publicada en la plataforma y por la legislación chilena aplicable.',
    '13. Cambios y ley aplicable',
    'Las modificaciones materiales se informarán de forma clara y con antelación razonable cuando corresponda. Estos términos se rigen por las leyes de Chile, incluida la Ley N° 19.496 y el Decreto N° 6 de 2021 sobre comercio electrónico. Las controversias se resolverán ante las autoridades y tribunales competentes.',
    '14. Revisión obligatoria',
    'Este texto es una base operativa temporal. El dueño debe completar la identidad legal del operador, validar el modelo contractual, definir reglas finales de cancelación y reembolso y aprobar una versión jurídica definitiva antes del 15 de noviembre de 2026.'
].join('\n\n');

const privacyContent = [
    TEMPORARY_NOTICE,
    '1. Responsable y contacto',
    'El responsable del tratamiento deberá completar antes de la revisión final: razón social o nombre, RUT, domicilio y representante legal del operador de Servicios a tu Hogar. Las consultas sobre privacidad y el ejercicio de derechos pueden dirigirse temporalmente a soporte@serviciosatuhogar.cl.',
    '2. Marco aplicable',
    'El tratamiento se realiza conforme a la Ley N° 19.628 vigente y demás normativa chilena aplicable. La Ley N° 21.719 entra en vigor el 1 de diciembre de 2026, por lo que esta política y los procesos internos deben revisarse antes de esa fecha.',
    '3. Datos tratados',
    'Según el uso de la plataforma, pueden tratarse datos de identificación y contacto; datos de cuenta y autenticación; perfil profesional; ubicación y cobertura; publicaciones, imágenes y documentos de verificación; reservas, mensajes, reclamos y reseñas; referencias y estados de pago; información tributaria o de facturación; y datos técnicos como dirección IP, dispositivo, registros de acceso y seguridad.',
    '4. Fuentes',
    'Los datos se obtienen de la persona usuaria, de su interacción con la plataforma, de la contraparte de una reserva, de proveedores tecnológicos y de fuentes públicas o autoridades cuando exista una base legítima.',
    '5. Finalidades',
    'Los datos se utilizan para crear y administrar cuentas; publicar y buscar servicios; coordinar reservas; procesar y conciliar pagos; verificar proveedores; prevenir fraude y abuso; atender soporte y reclamos; cumplir obligaciones legales, tributarias y de seguridad; mejorar el servicio; y enviar comunicaciones operativas. Las comunicaciones promocionales se gestionarán conforme a las preferencias y reglas aplicables.',
    '6. Información pública y privada',
    'Solo los campos necesarios del perfil y de las publicaciones se muestran públicamente. Datos de contacto directo, documentos de identidad, información de pago, antecedentes internos de moderación y registros de seguridad no deben exponerse públicamente, salvo autorización expresa o deber legal.',
    '7. Destinatarios y encargados',
    'Los datos pueden compartirse en la medida necesaria con la contraparte de una reserva; Payku u otros procesadores de pago informados; proveedores de hosting, correo, analítica, seguridad y soporte; prestadores de facturación o contabilidad; asesores sujetos a confidencialidad; y autoridades cuando exista obligación legal. No se autoriza a estos terceros a utilizar los datos para fines incompatibles con el servicio.',
    '8. Conservación',
    'Los datos se conservarán durante la vigencia de la cuenta y por los plazos necesarios para cumplir la finalidad, resolver disputas, prevenir fraude y atender obligaciones legales. El dueño debe aprobar una tabla definitiva de conservación y eliminación por categoría de dato antes de la revisión final.',
    '9. Seguridad',
    'La plataforma aplica controles razonables de acceso, autenticación, registro, respaldo y protección de archivos. Ningún sistema es infalible; los incidentes se investigarán y se comunicarán cuando corresponda conforme a la ley.',
    '10. Derechos de las personas',
    'Las personas pueden solicitar información sobre sus datos y, cuando corresponda, acceso, rectificación, eliminación, bloqueo u oposición conforme a la legislación vigente. La solicitud debe enviarse a soporte@serviciosatuhogar.cl e incluir antecedentes suficientes para verificar identidad y responder de forma segura.',
    '11. Sesiones y almacenamiento técnico',
    'La plataforma puede utilizar cookies o almacenamiento local estrictamente necesarios para sesión, seguridad, preferencias y funcionamiento. Si se incorporan herramientas no esenciales de medición o publicidad, deberán informarse y configurarse con los controles de consentimiento aplicables.',
    '12. Niños, niñas y adolescentes',
    'La plataforma no está dirigida a menores de 18 años ni busca tratar sus datos directamente. Si se detecta una cuenta de una persona menor, podrá suspenderse y eliminarse la información conforme a la ley y a las medidas de verificación disponibles.',
    '13. Cambios',
    'Las actualizaciones materiales de esta política se publicarán con su fecha y versión y se informarán por medios razonables cuando corresponda.',
    '14. Revisión obligatoria',
    'Este texto es una base temporal. El dueño debe completar la identidad del responsable, confirmar las bases de licitud, los encargados y transferencias, los plazos de conservación, el procedimiento de derechos y el plan de adecuación a la Ley N° 21.719 antes del 15 de noviembre de 2026.'
].join('\n\n');

export const TEMPORARY_LEGAL_POLICIES = Object.freeze([
    Object.freeze({
        id: 'terms-temporary-2026-08',
        title: 'Términos y Condiciones de Uso',
        slug: 'terminos-y-condiciones-de-uso',
        content: termsContent,
        target: 'global',
        lastUpdated: '2026-08-15',
        version: '0.1-temporal',
        isRequired: true,
        isActive: true,
        isTemporary: true,
        reviewDeadline: TEMPORARY_POLICY_REVIEW_DEADLINE
    }),
    Object.freeze({
        id: 'privacy-temporary-2026-08',
        title: 'Política de Privacidad',
        slug: 'politica-de-privacidad',
        content: privacyContent,
        target: 'global',
        lastUpdated: '2026-08-15',
        version: '0.1-temporal',
        isRequired: true,
        isActive: true,
        isTemporary: true,
        reviewDeadline: TEMPORARY_POLICY_REVIEW_DEADLINE
    })
]);
