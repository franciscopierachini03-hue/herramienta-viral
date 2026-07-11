import TrialViralAdn from '../unete/TrialViralAdn';

// /adama — página de pago de la comunidad ADAMA (Regina). Cada venta queda
// etiquetada con canal 'adama' en Stripe (cuenta Elevation), sin ?canal=.
// /ADAMA (mayúsculas) redirige acá vía middleware.
export default function Adama() {
  return <TrialViralAdn canalDefault="adama" comunidad="ADAMA" />;
}
