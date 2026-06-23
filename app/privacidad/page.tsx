import LegalShell from '@/app/_components/LegalShell';

export const metadata = {
  title: 'Política de Privacidad · ViralADN',
  description: 'Cómo ViralADN ✕ TOPCUT recopila, usa y protege tus datos.',
};

export default function Privacidad() {
  return (
    <LegalShell title="Política de Privacidad" updated="Junio de 2026">
      <p>
        Esta Política de Privacidad explica cómo <strong>2CLICKS.COM LLC</strong> (“nosotros”) recopila,
        usa, comparte y protege tu información cuando usas <strong>ViralADN ✕ TOPCUT</strong> en
        <strong> viraladn.com</strong> (el “Servicio”). Forma parte de nuestros
        <a href="/terminos"> Términos y Condiciones</a>. Al usar el Servicio, aceptas las prácticas aquí
        descritas.
      </p>

      <h2>1. Datos que recopilamos</h2>
      <ul>
        <li><strong>De tu cuenta:</strong> nombre, correo electrónico y teléfono que proporcionas al registrarte.</li>
        <li><strong>De pago:</strong> los pagos los procesa <strong>Stripe</strong>. <strong>No almacenamos los datos de tu tarjeta</strong>; solo guardamos identificadores de cliente/suscripción y el estado de tu pago.</li>
        <li><strong>De uso:</strong> temas que buscas, enlaces que transcribes, videos que subes para editar, el contenido que generas, y métricas de uso de las funciones.</li>
        <li><strong>Técnicos:</strong> datos de sesión, dirección IP aproximada, tipo de dispositivo/navegador y registros (logs) necesarios para seguridad, prevención de fraude y funcionamiento.</li>
      </ul>

      <h2>2. Cómo y por qué usamos tus datos (bases)</h2>
      <ul>
        <li><strong>Para ejecutar el contrato:</strong> crear y administrar tu cuenta, prestarte las funciones, procesar pagos y renovaciones.</li>
        <li><strong>Por interés legítimo:</strong> seguridad, prevención de fraude y abuso, soporte y mejora del Servicio.</li>
        <li><strong>Por obligación legal:</strong> contabilidad, impuestos y respuesta a requerimientos válidos.</li>
        <li><strong>Con tu consentimiento:</strong> comunicaciones de marketing (cuando aplique), que puedes retirar en cualquier momento.</li>
      </ul>
      <p><strong>No vendemos tus datos personales.</strong></p>

      <h2>3. Pagos</h2>
      <p>
        Los pagos se procesan de forma segura mediante <strong>Stripe</strong>, que actúa como
        procesador y aplica sus propias políticas de privacidad y seguridad (estándar PCI-DSS). Los datos
        de tu tarjeta se manejan directamente con Stripe y no pasan por nuestros servidores.
      </p>

      <h2>4. Proveedores que nos ayudan a operar</h2>
      <p>Compartimos los datos mínimos necesarios con proveedores que prestan partes del Servicio (encargados de tratamiento):</p>
      <ul>
        <li><strong>Stripe</strong> — procesamiento de pagos y suscripciones.</li>
        <li><strong>Supabase</strong> — base de datos y autenticación de cuentas.</li>
        <li><strong>Proveedores de cómputo e IA</strong> — para transcripción, generación de guiones, edición de video y búsqueda. Se les envía solo el contenido necesario para ejecutar la función solicitada.</li>
        <li><strong>Servicio de correo</strong> — para enviarte códigos y notificaciones de cuenta.</li>
        <li><strong>Infraestructura y alojamiento</strong> — para operar la plataforma.</li>
      </ul>
      <p>Estos proveedores procesan los datos por cuenta nuestra, bajo obligaciones de confidencialidad y seguridad. También podemos divulgar datos si la ley lo exige o para proteger derechos, seguridad y prevención de fraude, y en el marco de una eventual fusión o adquisición.</p>

      <h2>5. Videos y contenido que subes</h2>
      <p>
        Cuando subes un video o un enlace para procesarlo, lo usamos únicamente para ejecutar la función
        pedida (por ejemplo, transcribir o editar). El contenido resultante queda disponible para ti.
        Conservamos el material solo el tiempo necesario para prestarte el Servicio y luego puede ser
        eliminado de nuestros sistemas de procesamiento.
      </p>

      <h2>6. Cookies y almacenamiento local</h2>
      <p>
        Usamos cookies y almacenamiento local <strong>estrictamente necesarios</strong> para mantener tu
        sesión iniciada y el funcionamiento de la plataforma, y mínimos datos para seguridad y análisis
        operativo. No usamos esos datos para vender publicidad. Puedes controlar las cookies desde tu
        navegador; deshabilitar las necesarias puede impedir el uso del Servicio.
      </p>

      <h2>7. Retención de datos</h2>
      <p>
        Conservamos tus datos de cuenta mientras tu cuenta esté activa y durante el tiempo necesario para
        cumplir obligaciones legales, contables y de prevención de fraude. Luego se eliminan o anonimizan.
      </p>

      <h2>8. Tus derechos</h2>
      <p>
        Según tu jurisdicción, puedes tener derecho a <strong>acceder, corregir, eliminar, limitar u
        oponerte</strong> al tratamiento de tus datos, a la <strong>portabilidad</strong> y a
        <strong> retirar tu consentimiento</strong>. Para ejercerlos, escribe a
        <strong> hola@viraladn.com</strong> desde el correo de tu cuenta; podremos verificar tu identidad.
      </p>
      <ul>
        <li><strong>Usuarios del EEE / Reino Unido (GDPR):</strong> tienes los derechos anteriores y puedes reclamar ante tu autoridad de protección de datos.</li>
        <li><strong>Usuarios de California (CCPA/CPRA):</strong> tienes derecho a saber, eliminar, corregir y a no ser discriminado por ejercer tus derechos. No vendemos ni “compartimos” datos para publicidad dirigida.</li>
      </ul>

      <h2>9. Marketing y comunicaciones</h2>
      <p>
        Siempre te enviaremos comunicaciones <strong>operativas</strong> sobre tu cuenta (confirmaciones,
        facturación, avisos). Las comunicaciones <strong>promocionales</strong>, si las hubiera, podrás
        rechazarlas con el enlace de baja o escribiéndonos.
      </p>

      <h2>10. Decisiones automatizadas</h2>
      <p>
        Podemos usar reglas automáticas para prevención de fraude y límites de uso. No tomamos decisiones
        que produzcan efectos legales significativos sin posibilidad de revisión humana cuando la ley lo
        requiera.
      </p>

      <h2>11. Seguridad</h2>
      <p>
        Aplicamos medidas razonables para proteger tu información (cifrado en tránsito, control de
        accesos, y proveedores con estándares de seguridad). Ningún sistema es 100% infalible; en caso de
        una brecha que te afecte, actuaremos conforme a la ley aplicable, incluida la notificación cuando
        corresponda.
      </p>

      <h2>12. Menores de edad</h2>
      <p>El Servicio está dirigido a mayores de 18 años. No recopilamos a sabiendas datos de menores; si detectamos uno, eliminaremos la información.</p>

      <h2>13. Transferencias internacionales</h2>
      <p>
        Tus datos pueden procesarse en servidores ubicados en distintos países, incluido Estados Unidos.
        Cuando corresponda, aplicamos salvaguardas adecuadas para esas transferencias. Al usar el
        Servicio, aceptas dicho procesamiento conforme a esta Política.
      </p>

      <h2>14. Cambios a esta Política</h2>
      <p>
        Podemos actualizar esta Política. Publicaremos la versión vigente en esta página con su fecha de
        actualización. El uso continuado del Servicio implica tu aceptación.
      </p>

      <h2>15. Contacto</h2>
      <p>
        Responsable del tratamiento: <strong>2CLICKS.COM LLC</strong>. Consultas de privacidad:
        <strong> hola@viraladn.com</strong> · <a href="https://viraladn.com">viraladn.com</a>
      </p>
    </LegalShell>
  );
}
