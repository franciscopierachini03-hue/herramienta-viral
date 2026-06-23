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
        usa y protege tu información cuando usas <strong>ViralADN ✕ TOPCUT</strong> en
        <strong> viraladn.com</strong>. Al usar el Servicio, aceptas las prácticas aquí descritas.
      </p>

      <h2>1. Datos que recopilamos</h2>
      <ul>
        <li><strong>De tu cuenta:</strong> nombre, correo electrónico y teléfono que proporcionas al registrarte.</li>
        <li><strong>De pago:</strong> los pagos los procesa <strong>Stripe</strong>. <strong>No almacenamos los datos de tu tarjeta</strong>; solo guardamos identificadores y el estado de tu suscripción.</li>
        <li><strong>De uso:</strong> temas que buscas, enlaces que transcribes, videos que subes para editar, y el contenido que generas, para poder prestarte el Servicio.</li>
        <li><strong>Técnicos:</strong> datos básicos de sesión y registros necesarios para seguridad, prevención de fraude y funcionamiento.</li>
      </ul>

      <h2>2. Cómo usamos tus datos</h2>
      <ul>
        <li>Para crear y administrar tu cuenta y suscripción.</li>
        <li>Para prestar las funciones del Servicio (búsquedas, transcripción, generación y edición con IA).</li>
        <li>Para procesar pagos, facturación y renovaciones.</li>
        <li>Para soporte, seguridad, prevención de fraude y mejoras del producto.</li>
        <li>Para enviarte comunicaciones sobre tu cuenta (por ejemplo, confirmaciones y avisos importantes).</li>
      </ul>
      <p>No vendemos tus datos personales a terceros.</p>

      <h2>3. Pagos</h2>
      <p>
        Los pagos se procesan de forma segura mediante <strong>Stripe</strong>, que actúa como
        procesador de pagos y aplica sus propias políticas. Los datos de tu tarjeta se manejan
        directamente con Stripe y no pasan por nuestros servidores.
      </p>

      <h2>4. Proveedores que nos ayudan a operar</h2>
      <p>Compartimos los datos mínimos necesarios con proveedores que prestan partes del Servicio:</p>
      <ul>
        <li><strong>Stripe</strong> — procesamiento de pagos y suscripciones.</li>
        <li><strong>Supabase</strong> — base de datos y autenticación de cuentas.</li>
        <li><strong>Proveedores de cómputo e IA</strong> — para transcripción, generación de guiones, edición de video y búsqueda (por ejemplo, servicios de IA y de procesamiento de video). Se les envía solo el contenido necesario para ejecutar la función que solicitaste.</li>
        <li><strong>Servicio de correo</strong> — para enviarte códigos y notificaciones de cuenta.</li>
      </ul>
      <p>Estos proveedores procesan los datos por cuenta nuestra y bajo sus propias medidas de seguridad.</p>

      <h2>5. Videos y contenido que subes</h2>
      <p>
        Cuando subes un video o un enlace para procesarlo, lo usamos únicamente para ejecutar la función
        pedida (por ejemplo, transcribir o editar). El contenido resultante queda disponible para ti.
        Conservamos el material solo el tiempo necesario para prestarte el Servicio y luego puede ser
        eliminado de nuestros sistemas de procesamiento.
      </p>

      <h2>6. Cookies y sesión</h2>
      <p>
        Usamos cookies y almacenamiento local estrictamente necesarios para mantener tu sesión iniciada
        y el funcionamiento de la plataforma. No usamos esos datos para vender publicidad.
      </p>

      <h2>7. Retención de datos</h2>
      <p>
        Conservamos tus datos de cuenta mientras tu cuenta esté activa y durante el tiempo necesario para
        cumplir obligaciones legales, contables y de prevención de fraude. Luego se eliminan o anonimizan.
      </p>

      <h2>8. Tus derechos</h2>
      <p>
        Puedes solicitar acceder, corregir o eliminar tus datos personales, o cerrar tu cuenta,
        escribiendo a <strong>hola@viraladn.com</strong> desde el correo de tu cuenta. Atenderemos tu
        solicitud conforme a la ley aplicable.
      </p>

      <h2>9. Seguridad</h2>
      <p>
        Aplicamos medidas razonables para proteger tu información (cifrado en tránsito, control de
        accesos y proveedores con estándares de seguridad). Ningún sistema es 100% infalible, pero
        trabajamos para minimizar riesgos.
      </p>

      <h2>10. Menores de edad</h2>
      <p>El Servicio está dirigido a mayores de 18 años. No recopilamos a sabiendas datos de menores.</p>

      <h2>11. Transferencias internacionales</h2>
      <p>
        Tus datos pueden procesarse en servidores ubicados en distintos países (incluido Estados Unidos).
        Al usar el Servicio, aceptas dicho procesamiento conforme a esta Política.
      </p>

      <h2>12. Cambios a esta Política</h2>
      <p>
        Podemos actualizar esta Política. Publicaremos la versión vigente en esta página con su fecha de
        actualización. El uso continuado del Servicio implica tu aceptación.
      </p>

      <h2>13. Contacto</h2>
      <p>
        2CLICKS.COM LLC · <strong>hola@viraladn.com</strong> · <a href="https://viraladn.com">viraladn.com</a>
      </p>
    </LegalShell>
  );
}
